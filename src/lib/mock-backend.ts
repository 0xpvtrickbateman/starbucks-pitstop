import { createHmac, randomUUID } from "node:crypto";

import { haversineMiles, type BoundingBox } from "@/lib/map";
import { calculateWilsonScore, shouldDeactivateCompetingCodes } from "@/lib/scoring";
import { normalizeCodeInput } from "@/lib/crypto";
import { getRestroomEntryType } from "@/lib/restroom-entry";
import type { PublicCode, PublicStore, StoreCodeSummary } from "@/types";

interface MockCodeRecord extends PublicCode {
  codeNormalized: string;
}

interface MockStoreRecord {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  ownershipType: string | null;
  storeType: string | null;
  features: string[];
  codes: MockCodeRecord[];
}

interface MockState {
  stores: Map<string, MockStoreRecord>;
  votes: Set<string>;
}

interface MockStoreSeed
  extends Omit<MockStoreRecord, "codes"> {
  codes: Array<{
    id: string;
    codeDisplay: string;
    isActive: boolean;
    deactivatedReason: string | null;
    upvotes: number;
    downvotes: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

const LOCAL_MOCK_DEVICE_SECRET = "starbucks-pitstop-local-mock";

const MOCK_STORE_SEEDS: MockStoreSeed[] = [
  {
    id: "store-roosevelt-seattle",
    name: "Starbucks Roosevelt",
    address: "123 Roosevelt Way NE",
    city: "Seattle",
    state: "WA",
    zip: "98105",
    latitude: 47.6616,
    longitude: -122.317,
    ownershipType: "CO",
    storeType: "cafe",
    features: ["Restroom likely", "Cafe"],
    codes: [
      {
        id: "0f312a91-5272-4c0d-a9ec-9ab4f43bbd3e",
        codeDisplay: "4839",
        isActive: true,
        deactivatedReason: null,
        upvotes: 4,
        downvotes: 1,
        createdAt: "2026-04-08T01:00:00.000Z",
        updatedAt: "2026-04-08T02:00:00.000Z",
      },
      {
        id: "76b5a654-a88d-4e13-a37b-ea857583d8bc",
        codeDisplay: "1111",
        isActive: false,
        deactivatedReason: "superseded",
        upvotes: 1,
        downvotes: 6,
        createdAt: "2026-04-01T01:00:00.000Z",
        updatedAt: "2026-04-02T01:00:00.000Z",
      },
    ],
  },
  {
    id: "store-camelback-phoenix",
    name: "Starbucks Camelback",
    address: "1940 E Camelback Rd",
    city: "Phoenix",
    state: "AZ",
    zip: "85016",
    latitude: 33.5092,
    longitude: -112.0398,
    ownershipType: "CO",
    storeType: "cafe",
    features: ["Restroom likely", "Drive-thru"],
    codes: [],
  },
  {
    id: "store-south-congress-austin",
    name: "Starbucks South Congress",
    address: "1400 S Congress Ave",
    city: "Austin",
    state: "TX",
    zip: "78704",
    latitude: 30.2494,
    longitude: -97.7495,
    ownershipType: "CO",
    storeType: "urban-inline",
    features: ["Restroom likely", "Cafe"],
    codes: [
      {
        id: "88cd0994-f72f-4433-a0dd-5d6b24ee92ad",
        codeDisplay: "2580",
        isActive: true,
        deactivatedReason: null,
        upvotes: 7,
        downvotes: 1,
        createdAt: "2026-04-05T18:10:00.000Z",
        updatedAt: "2026-04-08T04:42:00.000Z",
      },
    ],
  },
  {
    id: "store-williamsburg-brooklyn",
    name: "Starbucks Williamsburg",
    address: "405 Berry St",
    city: "Brooklyn",
    state: "NY",
    zip: "11249",
    latitude: 40.7184,
    longitude: -73.9583,
    ownershipType: "CO",
    storeType: "cafe",
    features: ["Restroom likely", "Cafe"],
    codes: [
      {
        id: "3b7a97d2-d9b7-4643-afbe-f6d07dc1db14",
        codeDisplay: "9081",
        isActive: true,
        deactivatedReason: null,
        upvotes: 9,
        downvotes: 2,
        createdAt: "2026-04-06T09:15:00.000Z",
        updatedAt: "2026-04-08T05:30:00.000Z",
      },
      {
        id: "0f9ff542-f46b-474e-a7c6-4cad8851d699",
        codeDisplay: "1357",
        isActive: true,
        deactivatedReason: null,
        upvotes: 4,
        downvotes: 3,
        createdAt: "2026-04-07T13:30:00.000Z",
        updatedAt: "2026-04-08T04:55:00.000Z",
      },
    ],
  },
];

function buildStoreCodeSummary(codes: PublicCode[]): StoreCodeSummary {
  const activeCodes = codes.filter((code) => code.isActive);
  const topCode = [...activeCodes].sort(
    (left, right) => right.confidenceScore - left.confidenceScore,
  )[0];

  return {
    activeCodeCount: activeCodes.length,
    hasCodes: activeCodes.length > 0,
    hasConflict: activeCodes.length > 1,
    topCode: topCode
      ? {
          id: topCode.id,
          codeDisplay: topCode.codeDisplay,
          confidenceScore: topCode.confidenceScore,
        }
      : null,
  };
}

function toMockCodeRecord(
  storeId: string,
  code: MockStoreSeed["codes"][number],
): MockCodeRecord {
  const entryType = getRestroomEntryType(code.codeDisplay);
  const { display, normalized } = normalizeCodeInput(code.codeDisplay, entryType);

  return {
    id: code.id,
    storeId,
    codeDisplay: display,
    codeNormalized: normalized,
    isActive: code.isActive,
    deactivatedReason: code.deactivatedReason,
    upvotes: code.upvotes,
    downvotes: code.downvotes,
    confidenceScore: calculateWilsonScore(code.upvotes, code.downvotes),
    createdAt: code.createdAt,
    updatedAt: code.updatedAt,
  };
}

function orderCodes(codes: MockCodeRecord[]) {
  return [...codes].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return Number(right.isActive) - Number(left.isActive);
    }

    if (left.confidenceScore !== right.confidenceScore) {
      return right.confidenceScore - left.confidenceScore;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });
}

function createMockState(): MockState {
  const stores = new Map<string, MockStoreRecord>();

  for (const seed of MOCK_STORE_SEEDS) {
    stores.set(seed.id, {
      ...seed,
      codes: orderCodes(seed.codes.map((code) => toMockCodeRecord(seed.id, code))),
    });
  }

  return {
    stores,
    votes: new Set(),
  };
}

function getGlobalState() {
  const globalState = globalThis as typeof globalThis & {
    __STARBUCKS_PITSTOP_LOCAL_MOCK__?: MockState;
  };

  if (!globalState.__STARBUCKS_PITSTOP_LOCAL_MOCK__) {
    globalState.__STARBUCKS_PITSTOP_LOCAL_MOCK__ = createMockState();
  }

  return globalState.__STARBUCKS_PITSTOP_LOCAL_MOCK__;
}

function toPublicCode(code: MockCodeRecord): PublicCode {
  return {
    id: code.id,
    storeId: code.storeId,
    codeDisplay: code.codeDisplay,
    isActive: code.isActive,
    deactivatedReason: code.deactivatedReason,
    upvotes: code.upvotes,
    downvotes: code.downvotes,
    confidenceScore: code.confidenceScore,
    createdAt: code.createdAt,
    updatedAt: code.updatedAt,
  };
}

function toPublicStore(
  store: MockStoreRecord,
  distanceMiles: number | null,
): PublicStore {
  const codes = orderCodes(store.codes).map(toPublicCode);

  return {
    id: store.id,
    name: store.name,
    address: store.address,
    city: store.city,
    state: store.state,
    zip: store.zip,
    latitude: store.latitude,
    longitude: store.longitude,
    ownershipType: store.ownershipType,
    storeType: store.storeType,
    features: store.features,
    distanceMiles,
    codeSummary: buildStoreCodeSummary(codes),
    codes,
    inactiveCodeCount: codes.filter((code) => !code.isActive).length,
  };
}

function findStoreByCodeId(codeId: string) {
  const state = getGlobalState();

  for (const store of state.stores.values()) {
    const code = store.codes.find((candidate) => candidate.id === codeId);

    if (code) {
      return {
        store,
        code,
      };
    }
  }

  return null;
}

function refreshCompetition(store: MockStoreRecord, updatedAt: string) {
  for (const code of store.codes) {
    code.confidenceScore = calculateWilsonScore(code.upvotes, code.downvotes);
  }

  const { losersToDeactivate } = shouldDeactivateCompetingCodes(store.codes);

  for (const code of store.codes) {
    if (!losersToDeactivate.includes(code.id)) {
      continue;
    }

    code.isActive = false;
    code.deactivatedReason = "superseded";
    code.updatedAt = updatedAt;
  }

  store.codes = orderCodes(store.codes);
}

export function hashLocalMockDeviceId(deviceId: string) {
  return createHmac("sha256", LOCAL_MOCK_DEVICE_SECRET)
    .update(deviceId)
    .digest("hex");
}

export function resetLocalMockState() {
  const globalState = globalThis as typeof globalThis & {
    __STARBUCKS_PITSTOP_LOCAL_MOCK__?: MockState;
  };

  globalState.__STARBUCKS_PITSTOP_LOCAL_MOCK__ = createMockState();
}

export function fetchMockStoresByBoundingBox(box: BoundingBox, limit = 500) {
  const state = getGlobalState();

  return Array.from(state.stores.values())
    .filter(
      (store) =>
        store.longitude >= box.west &&
        store.longitude <= box.east &&
        store.latitude >= box.south &&
        store.latitude <= box.north,
    )
    .slice(0, limit)
    .map((store) => toPublicStore(store, null));
}

export function fetchMockStoresByRadius(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  limit = 100,
) {
  const state = getGlobalState();

  return Array.from(state.stores.values())
    .map((store) => ({
      store,
      distanceMiles: haversineMiles(
        latitude,
        longitude,
        store.latitude,
        store.longitude,
      ),
    }))
    .filter((candidate) => candidate.distanceMiles <= radiusMiles)
    .sort((left, right) => left.distanceMiles - right.distanceMiles)
    .slice(0, limit)
    .map((candidate) => toPublicStore(candidate.store, candidate.distanceMiles));
}

export function searchMockStores(query: string, limit = 10) {
  const normalizedQuery = query.trim().toLowerCase();
  const state = getGlobalState();

  return Array.from(state.stores.values())
    .filter((store) =>
      [
        store.name,
        store.address,
        store.city,
        store.state,
        store.zip,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    )
    .slice(0, limit)
    .map((store) => toPublicStore(store, null));
}

export function fetchMockStoreById(storeId: string) {
  const store = getGlobalState().stores.get(storeId);
  return store ? toPublicStore(store, null) : null;
}

export function submitMockCode(options: {
  storeId: string;
  codeDisplay: string;
  codeNormalized: string;
}) {
  const state = getGlobalState();
  const store = state.stores.get(options.storeId);

  if (!store) {
    throw new Error("Store not found");
  }

  const existing = store.codes.find(
    (code) => code.codeNormalized === options.codeNormalized,
  );

  if (!existing) {
    const nowIso = new Date().toISOString();

    store.codes = orderCodes([
      {
        id: randomUUID(),
        storeId: store.id,
        codeDisplay: options.codeDisplay,
        codeNormalized: options.codeNormalized,
        isActive: true,
        deactivatedReason: null,
        upvotes: 0,
        downvotes: 0,
        confidenceScore: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      ...store.codes,
    ]);
  }

  return {
    existing: Boolean(existing),
    codes: toPublicStore(store, null).codes,
  };
}

export function submitMockVote(options: {
  codeId: string;
  voteType: "up" | "down";
  voterHash: string;
}) {
  const duplicateKey = `${options.codeId}:${options.voterHash}`;
  const state = getGlobalState();

  if (state.votes.has(duplicateKey)) {
    throw new Error("duplicate_vote");
  }

  const target = findStoreByCodeId(options.codeId);

  if (!target) {
    throw new Error("Code not found");
  }

  state.votes.add(duplicateKey);

  if (options.voteType === "up") {
    target.code.upvotes += 1;
  } else {
    target.code.downvotes += 1;
  }

  const nowIso = new Date().toISOString();
  target.code.updatedAt = nowIso;
  refreshCompetition(target.store, nowIso);

  return {
    storeId: target.store.id,
    codes: toPublicStore(target.store, null).codes,
  };
}
