#!/usr/bin/env tsx

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

// Load .env.local the same way the Next.js runtime does so operators can run
// `npm run sync-stores` without manually sourcing the file. Must run before
// any code that reads process.env (notably DEFAULT_OPTIONS.dryRun below).
loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

import {
  AIRPORT_PATTERNS,
  CAMPUS_PATTERNS,
  classifyStore,
  EMBEDDED_LOCATION_PATTERNS,
  fetchLocationsByCoordinates,
  fetchLocationsByPlace,
  GROCERY_PATTERNS,
  HEALTHCARE_PATTERNS,
  HOTEL_PATTERNS,
  matchesAnyPattern,
  PICKUP_ONLY_PATTERNS,
  STADIUM_PATTERNS,
  toSyncStoreRecord,
  uniqueSorted,
} from "@/lib/starbucks-api";
import type {
  StarbucksLocationResult,
  StoreExclusionReason,
  SyncStoreRecord,
} from "@/types";

type RegionName = "lower48" | "alaska" | "hawaii";
type SyncSource = "official" | "overture" | "auto";

const execFileAsync = promisify(execFile);

interface RegionConfig {
  name: RegionName;
  west: number;
  south: number;
  east: number;
  north: number;
  step: number;
  minStep: number;
}

interface CellTask {
  region: RegionName;
  west: number;
  south: number;
  east: number;
  north: number;
  depth: number;
}

interface ObservedStore {
  result: StarbucksLocationResult;
  observedCount: number;
  minObservedDistance: number;
}

interface SyncOptions {
  dryRun: boolean;
  concurrency: number;
  delayMs: number;
  denseThreshold: number;
  regions: RegionName[];
  source: SyncSource;
  reuseExport: boolean;
  maxBaseCells?: number;
  progressEvery: number;
}

interface SyncStats {
  queriesStarted: number;
  queriesCompleted: number;
  rawResultsFetched: number;
  denseCellsSubdivided: number;
  maxDepthReached: number;
  failures: number;
}

interface OvertureStarbucksRow {
  overture_id: string;
  name: string | null;
  brand_name: string | null;
  primary_category: string | null;
  basic_category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  operating_status: string | null;
  websites: string[];
  phones: string[];
  xmin: number | null;
  xmax: number | null;
  ymin: number | null;
  ymax: number | null;
}

const REGION_CONFIGS: Record<RegionName, RegionConfig> = {
  lower48: {
    name: "lower48",
    west: -125,
    south: 24.4,
    east: -66.5,
    north: 49.5,
    step: 0.4,
    minStep: 0.05,
  },
  alaska: {
    name: "alaska",
    west: -170,
    south: 51,
    east: -130,
    north: 72,
    step: 0.5,
    minStep: 0.0625,
  },
  hawaii: {
    name: "hawaii",
    west: -160.6,
    south: 18.7,
    east: -154.4,
    north: 22.5,
    step: 0.25,
    minStep: 0.03125,
  },
};

const DEFAULT_OPTIONS: SyncOptions = {
  dryRun: !(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ),
  concurrency: 4,
  delayMs: 75,
  denseThreshold: 48,
  regions: ["lower48", "alaska", "hawaii"],
  source: "auto",
  reuseExport: false,
  progressEvery: 100,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]): SyncOptions {
  const options = { ...DEFAULT_OPTIONS };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--upsert") {
      options.dryRun = false;
      continue;
    }

    if (arg.startsWith("--concurrency=")) {
      options.concurrency = Number(arg.split("=")[1]) || options.concurrency;
      continue;
    }

    if (arg.startsWith("--delay-ms=")) {
      options.delayMs = Number(arg.split("=")[1]) || options.delayMs;
      continue;
    }

    if (arg.startsWith("--dense-threshold=")) {
      options.denseThreshold =
        Number(arg.split("=")[1]) || options.denseThreshold;
      continue;
    }

    if (arg.startsWith("--regions=")) {
      const regions = arg
        .split("=")[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean) as RegionName[];

      if (regions.length > 0) {
        options.regions = regions;
      }

      continue;
    }

    if (arg.startsWith("--source=")) {
      const source = arg.split("=")[1] as SyncSource;

      if (source === "official" || source === "overture" || source === "auto") {
        options.source = source;
      }

      continue;
    }

    if (arg === "--reuse-export") {
      options.reuseExport = true;
      continue;
    }

    if (arg.startsWith("--max-base-cells=")) {
      const parsed = Number(arg.split("=")[1]);

      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxBaseCells = parsed;
      }

      continue;
    }

    if (arg.startsWith("--progress-every=")) {
      options.progressEvery =
        Number(arg.split("=")[1]) || options.progressEvery;
    }
  }

  return options;
}

function createBaseCells(region: RegionConfig) {
  const cells: CellTask[] = [];

  for (let south = region.south; south < region.north; south += region.step) {
    const north = Math.min(south + region.step, region.north);

    for (let west = region.west; west < region.east; west += region.step) {
      const east = Math.min(west + region.step, region.east);

      cells.push({
        region: region.name,
        west,
        south,
        east,
        north,
        depth: 0,
      });
    }
  }

  return cells;
}

function subdivideCell(task: CellTask) {
  const midLng = (task.west + task.east) / 2;
  const midLat = (task.south + task.north) / 2;

  return [
    {
      region: task.region,
      west: task.west,
      south: task.south,
      east: midLng,
      north: midLat,
      depth: task.depth + 1,
    },
    {
      region: task.region,
      west: midLng,
      south: task.south,
      east: task.east,
      north: midLat,
      depth: task.depth + 1,
    },
    {
      region: task.region,
      west: task.west,
      south: midLat,
      east: midLng,
      north: task.north,
      depth: task.depth + 1,
    },
    {
      region: task.region,
      west: midLng,
      south: midLat,
      east: task.east,
      north: task.north,
      depth: task.depth + 1,
    },
  ];
}

function getCellCenter(task: CellTask) {
  return {
    lat: (task.south + task.north) / 2,
    lng: (task.west + task.east) / 2,
  };
}

function shouldSubdivide(
  task: CellTask,
  resultCount: number,
  denseThreshold: number,
) {
  const region = REGION_CONFIGS[task.region];
  const width = Math.abs(task.east - task.west);
  const height = Math.abs(task.north - task.south);

  return (
    resultCount >= denseThreshold &&
    width / 2 >= region.minStep &&
    height / 2 >= region.minStep
  );
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

async function upsertStores(rows: SyncStoreRecord[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase env vars are missing. Provide NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or run with --dry-run.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  for (const batch of chunk(rows, 250)) {
    const { error } = await supabase.from("stores").upsert(batch, {
      onConflict: "id",
    });

    if (error) {
      throw error;
    }
  }
}

async function writeJsonReport(report: Record<string, unknown>) {
  const reportDirectory = path.join(process.cwd(), "docs", "research");
  const reportPath = path.join(reportDirectory, "latest-store-sync-report.json");

  await mkdir(reportDirectory, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return reportPath;
}

function incrementCount(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeAddressFragment(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .split(",")[0]
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bhighway\b/g, "hwy")
    .replace(/\bparkway\b/g, "pkwy")
    .replace(/\blane\b/g, "ln")
    .replace(/\bterrace\b/g, "ter")
    .replace(/\b(place|plaza|center|centre|suite|ste|unit|space)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

function buildCoordinateKey(row: OvertureStarbucksRow) {
  if (
    row.xmin === null ||
    row.xmax === null ||
    row.ymin === null ||
    row.ymax === null
  ) {
    return null;
  }

  const lng = ((row.xmin + row.xmax) / 2).toFixed(3);
  const lat = ((row.ymin + row.ymax) / 2).toFixed(3);

  return [lat, lng, normalizeToken(row.city), normalizeToken(row.state)].join("|");
}

function extractOfficialStoreIdFromWebsites(websites: string[]) {
  for (const website of websites) {
    const match = website.match(/store(?:-locator)?\/store\/([0-9]+)/i);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractWebsiteSlug(websites: string[]) {
  for (const website of websites) {
    const match = website.match(/store(?:-locator)?\/store\/[0-9]+\/([^/?#]+)/i);

    if (match?.[1]) {
      return match[1].replace(/[-_]+/g, " ");
    }
  }

  return null;
}

function scoreOvertureRow(row: OvertureStarbucksRow) {
  const storeId = extractOfficialStoreIdFromWebsites(row.websites);

  let score = 0;

  if (storeId) {
    score += 100;
  }

  if (row.brand_name?.toLowerCase() === "starbucks") {
    score += 20;
  }

  if (row.operating_status === "open") {
    score += 10;
  }

  if (row.address) {
    score += 5;
  }

  if (row.phones.length > 0) {
    score += 5;
  }

  if (row.websites.some((website) => website.includes("starbucks.com/store"))) {
    score += 5;
  }

  if (row.name?.toLowerCase() === "starbucks") {
    score += 2;
  }

  return score;
}

function dedupeOvertureRows(rows: OvertureStarbucksRow[]) {
  const officialIndex = new Map<string, string>();
  const softIndex = new Map<string, string>();
  const canonical = new Map<
    string,
    {
      row: OvertureStarbucksRow;
      storeId: string | null;
      slug: string | null;
    }
  >();
  const sortedRows = [...rows].sort((left, right) => scoreOvertureRow(right) - scoreOvertureRow(left));

  for (const row of sortedRows) {
    const storeId = extractOfficialStoreIdFromWebsites(row.websites);
    const addressKey = [
      normalizeAddressFragment(row.address),
      normalizeToken(row.city),
      normalizeToken(row.state),
    ]
      .filter(Boolean)
      .join("|");
    const phoneKey = (() => {
      const normalizedPhone = normalizePhone(row.phones[0]);

      if (normalizedPhone.length < 10) {
        return null;
      }

      return [normalizedPhone, normalizeToken(row.city), normalizeToken(row.state)].join("|");
    })();
    const coordinateKey = buildCoordinateKey(row);

    let canonicalKey: string | undefined;

    if (storeId) {
      canonicalKey = officialIndex.get(storeId);
    } else {
      canonicalKey =
        (addressKey ? softIndex.get(`address:${addressKey}`) : undefined) ??
        (phoneKey ? softIndex.get(`phone:${phoneKey}`) : undefined) ??
        (coordinateKey ? softIndex.get(`coord:${coordinateKey}`) : undefined);
    }

    const nextCanonicalKey =
      canonicalKey ??
      (storeId
        ? `store:${storeId}`
        : `fallback:${addressKey || phoneKey || row.overture_id}`);
    const existing = canonical.get(nextCanonicalKey);

    if (!existing) {
      canonical.set(nextCanonicalKey, {
        row,
        storeId,
        slug: extractWebsiteSlug(row.websites),
      });
    } else if (scoreOvertureRow(row) > scoreOvertureRow(existing.row)) {
      canonical.set(nextCanonicalKey, {
        row,
        storeId: existing.storeId ?? storeId,
        slug: extractWebsiteSlug(row.websites) ?? existing.slug,
      });
    }

    const finalRecord = canonical.get(nextCanonicalKey)!;

    if (finalRecord.storeId) {
      officialIndex.set(finalRecord.storeId, nextCanonicalKey);
    }

    if (addressKey) {
      softIndex.set(`address:${addressKey}`, nextCanonicalKey);
    }

    if (phoneKey) {
      softIndex.set(`phone:${phoneKey}`, nextCanonicalKey);
    }

    if (coordinateKey) {
      softIndex.set(`coord:${coordinateKey}`, nextCanonicalKey);
    }
  }

  return [...canonical.entries()].map(([key, record]) => ({
    key,
    storeId: record.storeId,
    slug: record.slug,
    row: record.row,
  }));
}

function classifyOvertureRow(
  row: OvertureStarbucksRow,
  officialStoreId: string | null,
) {
  const slug = extractWebsiteSlug(row.websites);
  const searchText = [
    row.name,
    row.brand_name,
    row.address,
    row.city,
    row.state,
    slug,
    ...row.websites,
  ]
    .filter(Boolean)
    .join(" ");
  const notes: string[] = [];

  if (!officialStoreId) {
    notes.push(
      "Excluded fallback candidate without an official Starbucks store-locator ID in the source URLs.",
    );

    return {
      isExcluded: true,
      exclusionReason: "ambiguous-format" as StoreExclusionReason,
      storeType: "unknown",
      features: uniqueSorted([
        row.primary_category ?? "",
        row.basic_category ?? "",
        row.operating_status ?? "",
      ]),
      notes,
    };
  }

  if (row.operating_status && row.operating_status !== "open") {
    notes.push(`Excluded non-open Overture record (${row.operating_status}).`);

    return {
      isExcluded: true,
      exclusionReason: "ambiguous-format" as StoreExclusionReason,
      storeType: "unknown",
      features: uniqueSorted([
        row.primary_category ?? "",
        row.basic_category ?? "",
        row.operating_status,
      ]),
      notes,
    };
  }

  const exclusionChecks: Array<[StoreExclusionReason, RegExp[], string]> = [
    ["pickup-only", PICKUP_ONLY_PATTERNS, "Excluded pickup-only fallback candidate."],
    ["airport", AIRPORT_PATTERNS, "Excluded airport fallback candidate."],
    ["grocery", GROCERY_PATTERNS, "Excluded grocery/big-box fallback candidate."],
    ["hotel", HOTEL_PATTERNS, "Excluded hotel fallback candidate."],
    ["hospital", HEALTHCARE_PATTERNS, "Excluded healthcare/secure-access fallback candidate."],
    ["campus", CAMPUS_PATTERNS, "Excluded campus fallback candidate."],
    ["stadium", STADIUM_PATTERNS, "Excluded stadium/event fallback candidate."],
  ];

  for (const [reason, patterns, message] of exclusionChecks) {
    if (matchesAnyPattern(searchText, patterns)) {
      notes.push(message);

      return {
        isExcluded: true,
        exclusionReason: reason,
        storeType: "unknown",
        features: uniqueSorted([
          row.primary_category ?? "",
          row.basic_category ?? "",
          row.operating_status ?? "",
        ]),
        notes,
      };
    }
  }

  if (matchesAnyPattern(searchText, EMBEDDED_LOCATION_PATTERNS)) {
    notes.push("Excluded embedded-office or embedded-retail fallback candidate.");

    return {
      isExcluded: true,
      exclusionReason: "embedded-office" as StoreExclusionReason,
      storeType: "unknown",
      features: uniqueSorted([
        row.primary_category ?? "",
        row.basic_category ?? "",
        row.operating_status ?? "",
      ]),
      notes,
    };
  }

  notes.push(
    "Included Overture fallback candidate with no explicit exclusion signal. Ownership and amenities are unverified in this source.",
  );

  return {
    isExcluded: false,
    exclusionReason: null,
    storeType: "unknown",
    features: uniqueSorted([
      row.primary_category ?? "",
      row.basic_category ?? "",
      row.operating_status ?? "",
      extractOfficialStoreIdFromWebsites(row.websites) ? "official-store-url" : "",
    ]),
    notes,
  };
}

function toOvertureSyncRow(
  record: ReturnType<typeof dedupeOvertureRows>[number],
  lastSyncedAt: string,
) {
  const { row, storeId, slug } = record;
  const classification = classifyOvertureRow(row, storeId);
  const longitude =
    row.xmin !== null && row.xmax !== null ? (row.xmin + row.xmax) / 2 : null;
  const latitude =
    row.ymin !== null && row.ymax !== null ? (row.ymin + row.ymax) / 2 : null;

  if (latitude === null || longitude === null) {
    throw new Error(`Overture row ${row.overture_id} is missing coordinate bounds`);
  }

  return {
    row: {
      id: storeId ?? `overture:${row.overture_id}`,
      name: row.name ?? row.brand_name ?? "Starbucks",
      street1: row.address ?? "Unknown address",
      city: row.city ?? "Unknown city",
      state: row.state ?? "Unknown state",
      zip: row.zip ?? "00000",
      latitude,
      longitude,
      ownership_type: null,
      store_type: classification.storeType,
      features: classification.features,
      is_company_operated: null,
      is_excluded: classification.isExcluded,
      exclusion_reason: classification.exclusionReason,
      source_payload: {
        source: "overture",
        overtureId: row.overture_id,
        officialStoreId: storeId,
        officialSlug: slug,
        websites: row.websites,
        phones: row.phones,
        operatingStatus: row.operating_status,
        primaryCategory: row.primary_category,
        basicCategory: row.basic_category,
        raw: row,
        classificationNotes: classification.notes,
      },
      last_synced_at: lastSyncedAt,
    } satisfies SyncStoreRecord,
    classification,
  };
}

async function exportOvertureRows(release: string, reuseExport: boolean) {
  const outputPath = path.join(
    process.cwd(),
    "docs",
    "research",
    "latest-overture-starbucks-us.json",
  );

  await mkdir(path.dirname(outputPath), { recursive: true });

  if (!reuseExport) {
    await execFileAsync("python3", [
      path.join(process.cwd(), "scripts", "export-overture-starbucks.py"),
      "--release",
      release,
      "--output",
      outputPath,
    ]);
  } else {
    await access(outputPath);
  }

  const file = await readFile(outputPath, "utf8");
  const parsed = file
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        JSON.parse(line) as Omit<OvertureStarbucksRow, "websites" | "phones"> & {
          websites?: string[] | null;
          phones?: string[] | null;
        },
    );

  return {
    outputPath,
    rows: parsed.map((row) => ({
      ...row,
      websites: row.websites ?? [],
      phones: row.phones ?? [],
    })),
  };
}

async function resolveSource(options: SyncOptions) {
  if (options.source === "official" || options.source === "overture") {
    return {
      source: options.source,
      blocker: null as string | null,
    };
  }

  try {
    await fetchLocationsByPlace("Boston, MA");

    return {
      source: "official" as const,
      blocker: null,
    };
  } catch (error) {
    return {
      source: "overture" as const,
      blocker: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runOfficialSync(
  options: SyncOptions,
  sourceBlocker: string | null,
) {
  const stats: SyncStats = {
    queriesStarted: 0,
    queriesCompleted: 0,
    rawResultsFetched: 0,
    denseCellsSubdivided: 0,
    maxDepthReached: 0,
    failures: 0,
  };

  const baseCells = options.regions.flatMap((regionName) =>
    createBaseCells(REGION_CONFIGS[regionName]),
  );

  const queuedCells = options.maxBaseCells
    ? baseCells.slice(0, options.maxBaseCells)
    : baseCells;
  const queue = [...queuedCells];
  const observedStores = new Map<string, ObservedStore>();
  const failures: Array<Record<string, unknown>> = [];
  const syncStartedAt = new Date();

  console.log(
    JSON.stringify(
      {
        message: "Starting Starbucks store sync",
        source: "official",
        sourceBlocker,
        dryRun: options.dryRun,
        baseCellCount: queuedCells.length,
        regions: options.regions,
        concurrency: options.concurrency,
        delayMs: options.delayMs,
        denseThreshold: options.denseThreshold,
      },
      null,
      2,
    ),
  );

  async function worker(workerId: number) {
    while (true) {
      const task = queue.shift();

      if (!task) {
        return;
      }

      const { lat, lng } = getCellCenter(task);

      try {
        stats.queriesStarted += 1;
        stats.maxDepthReached = Math.max(stats.maxDepthReached, task.depth);

        const results = await fetchLocationsByCoordinates(lat, lng);
        stats.queriesCompleted += 1;
        stats.rawResultsFetched += results.length;

        for (const result of results) {
          const existing = observedStores.get(result.store.id);

          if (existing) {
            const shouldReplaceResult =
              result.distance < existing.minObservedDistance;
            existing.observedCount += 1;
            existing.minObservedDistance = Math.min(
              existing.minObservedDistance,
              result.distance,
            );

            if (shouldReplaceResult) {
              existing.result = result;
            }

            continue;
          }

          observedStores.set(result.store.id, {
            result,
            observedCount: 1,
            minObservedDistance: result.distance,
          });
        }

        if (shouldSubdivide(task, results.length, options.denseThreshold)) {
          stats.denseCellsSubdivided += 1;
          queue.push(...subdivideCell(task));
        }

        if (stats.queriesCompleted % options.progressEvery === 0) {
          console.log(
            JSON.stringify(
              {
                message: "Sync progress",
                workerId,
                queriesCompleted: stats.queriesCompleted,
                queueRemaining: queue.length,
                uniqueStoresObserved: observedStores.size,
                denseCellsSubdivided: stats.denseCellsSubdivided,
              },
              null,
              2,
            ),
          );
        }
      } catch (error) {
        stats.failures += 1;

        failures.push({
          region: task.region,
          task,
          lat,
          lng,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (options.delayMs > 0) {
          await sleep(options.delayMs);
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: options.concurrency }, (_, index) => worker(index + 1)),
  );

  const lastSyncedAt = new Date().toISOString();
  const allRows = [...observedStores.values()].map(({ result, observedCount, minObservedDistance }) => {
    const classification = classifyStore(result.store);

    return {
      row: toSyncStoreRecord(
        result.store,
        classification,
        {
          observedCount,
          minObservedDistance,
          lastLocationResult: result,
        },
        lastSyncedAt,
      ),
      classification,
    };
  });

  const includedRows = allRows.filter((entry) => !entry.classification.isExcluded);
  const excludedRows = allRows.filter((entry) => entry.classification.isExcluded);
  const excludedByReason: Record<string, number> = {};
  const includedByType: Record<string, number> = {};

  for (const entry of excludedRows) {
    incrementCount(
      excludedByReason,
      entry.classification.exclusionReason ?? "unknown",
    );
  }

  for (const entry of includedRows) {
    incrementCount(includedByType, entry.classification.storeType);
  }

  if (!options.dryRun) {
    await upsertStores(allRows.map((entry) => entry.row));
  }

  const syncEndedAt = new Date();
  const report = {
    syncStartedAt: syncStartedAt.toISOString(),
    syncEndedAt: syncEndedAt.toISOString(),
    elapsedMs: syncEndedAt.getTime() - syncStartedAt.getTime(),
    dryRun: options.dryRun,
    source: "official",
    sourceBlocker,
    endpoint: "https://www.starbucks.com/apiproxy/v1/locations",
    requestContract: {
      headers: {
        accept: "application/json",
        "x-requested-with": "XMLHttpRequest",
      },
      coordinateLookup: "?lat={lat}&lng={lng}",
      denseThreshold: options.denseThreshold,
    },
    options,
    stats,
    counts: {
      baseCells: queuedCells.length,
      totalFetched: stats.rawResultsFetched,
      uniqueStores: allRows.length,
      includedStores: includedRows.length,
      excludedStores: excludedRows.length,
    },
    includedByType,
    excludedByReason,
    includedSamples: includedRows.slice(0, 20).map((entry) => ({
      id: entry.row.id,
      name: entry.row.name,
      city: entry.row.city,
      state: entry.row.state,
      storeType: entry.row.store_type,
      features: entry.row.features.slice(0, 8),
    })),
    excludedSamples: excludedRows.slice(0, 30).map((entry) => ({
      id: entry.row.id,
      name: entry.row.name,
      city: entry.row.city,
      state: entry.row.state,
      exclusionReason: entry.row.exclusion_reason,
      notes: (entry.row.source_payload.classificationNotes as string[]).slice(0, 3),
    })),
    failures: failures.slice(0, 100),
  };

  const reportPath = await writeJsonReport(report);

  console.log(
    JSON.stringify(
      {
        message: "Starbucks store sync finished",
        dryRun: options.dryRun,
        reportPath,
        counts: report.counts,
        includedByType,
        excludedByReason,
        failureCount: failures.length,
      },
      null,
      2,
    ),
  );
}

async function runOvertureSync(
  options: SyncOptions,
  sourceBlocker: string | null,
) {
  const syncStartedAt = new Date();
  const release = process.env.OVERTURE_RELEASE ?? "2026-02-18.0";
  const { rows, outputPath } = await exportOvertureRows(release, options.reuseExport);
  const dedupedRows = dedupeOvertureRows(rows);
  const lastSyncedAt = new Date().toISOString();
  const allRows = dedupedRows.map((record) => toOvertureSyncRow(record, lastSyncedAt));
  const includedRows = allRows.filter((entry) => !entry.classification.isExcluded);
  const excludedRows = allRows.filter((entry) => entry.classification.isExcluded);
  const excludedByReason: Record<string, number> = {};
  const includedByType: Record<string, number> = {};

  for (const entry of excludedRows) {
    incrementCount(
      excludedByReason,
      entry.classification.exclusionReason ?? "unknown",
    );
  }

  for (const entry of includedRows) {
    incrementCount(includedByType, entry.classification.storeType);
  }

  if (!options.dryRun) {
    await upsertStores(allRows.map((entry) => entry.row));
  }

  const syncEndedAt = new Date();
  const report = {
    syncStartedAt: syncStartedAt.toISOString(),
    syncEndedAt: syncEndedAt.toISOString(),
    elapsedMs: syncEndedAt.getTime() - syncStartedAt.getTime(),
    dryRun: options.dryRun,
    source: "overture",
    sourceBlocker,
    release,
    dataset: "Overture Maps places",
    exportPath: outputPath,
    counts: {
      rawRows: rows.length,
      uniqueStores: allRows.length,
      includedStores: includedRows.length,
      excludedStores: excludedRows.length,
    },
    includedByType,
    excludedByReason,
    includedSamples: includedRows.slice(0, 20).map((entry) => ({
      id: entry.row.id,
      name: entry.row.name,
      city: entry.row.city,
      state: entry.row.state,
      storeType: entry.row.store_type,
      features: entry.row.features,
    })),
    excludedSamples: excludedRows.slice(0, 30).map((entry) => ({
      id: entry.row.id,
      name: entry.row.name,
      city: entry.row.city,
      state: entry.row.state,
      exclusionReason: entry.row.exclusion_reason,
      notes: (entry.row.source_payload.classificationNotes as string[]).slice(0, 3),
    })),
  };

  const reportPath = await writeJsonReport(report);

  console.log(
    JSON.stringify(
      {
        message: "Overture fallback sync finished",
        dryRun: options.dryRun,
        reportPath,
        exportPath: outputPath,
        counts: report.counts,
        includedByType,
        excludedByReason,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { source, blocker } = await resolveSource(options);

  if (source === "official") {
    await runOfficialSync(options, blocker);
    return;
  }

  await runOvertureSync(options, blocker);
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        message: "Store sync failed",
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
