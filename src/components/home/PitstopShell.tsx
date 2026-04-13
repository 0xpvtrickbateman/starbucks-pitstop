"use client";

import dynamic from "next/dynamic";
import { Compass, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { SearchBar } from "@/components/layout/SearchBar";
import { MapControls } from "@/components/map/MapControls";
import { StoreDetailPanel } from "@/components/store/StoreDetailPanel";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { resolveSearchCandidates } from "@/lib/search-discovery";
import { getStoreLoadStrategy } from "@/lib/store-load-strategy";
import type {
  SearchCandidate,
  SearchPhase,
  StoreDetailData,
  StoreSummary,
  ReportedCodeSummary,
} from "@/components/home/types";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useMapStore } from "@/stores/mapStore";
import type {
  CodesResponse,
  LocationsResponse,
  PublicCode,
  PublicStore,
  VoteResponse,
} from "@/types";

const StoreMap = dynamic(
  () => import("@/components/map/StoreMap").then((module) => module.StoreMap),
  {
  ssr: false,
  loading: () => (
    <div className="map-frame relative min-h-[24rem] rounded-[2rem] border border-white/50 sm:min-h-[30rem] lg:min-h-[48rem]" />
  ),
  },
);

function toCodeHealth(store: PublicStore): StoreSummary["codeHealth"] {
  if (store.codeSummary.activeCodeCount >= 2) {
    return "mixed";
  }

  if (store.codeSummary.activeCodeCount >= 1) {
    return "confident";
  }

  return "empty";
}

function toCodeHealthFromCodes(codes: PublicCode[]): StoreSummary["codeHealth"] {
  const activeCount = codes.filter((code) => code.isActive).length;

  if (activeCount >= 2) {
    return "mixed";
  }

  if (activeCount >= 1) {
    return "confident";
  }

  return "empty";
}

function toReportedCodeSummaries(codes: PublicCode[]): ReportedCodeSummary[] {
  const ordered = [...codes].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return Number(right.isActive) - Number(left.isActive);
    }

    if (left.confidenceScore !== right.confidenceScore) {
      return right.confidenceScore - left.confidenceScore;
    }

    return right.createdAt.localeCompare(left.createdAt);
  });

  const topActiveId = ordered.find((code) => code.isActive)?.id ?? null;

  return ordered.map((code) => ({
    id: code.id,
    display: code.codeDisplay,
    normalized: code.codeDisplay,
    upvotes: code.upvotes,
    downvotes: code.downvotes,
    confidenceScore: code.confidenceScore,
    isActive: code.isActive,
    isTop: code.id === topActiveId,
  }));
}

function formatLastUpdatedLabel(codes: PublicCode[]) {
  const timestamps = codes
    .map((code) => Date.parse(code.updatedAt))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return `Updated ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Math.max(...timestamps)))}`;
}

function toStoreDetail(store: PublicStore): StoreDetailData {
  return {
    id: store.id,
    name: store.name,
    address: store.address,
    city: store.city,
    state: store.state,
    zip: store.zip,
    latitude: store.latitude,
    longitude: store.longitude,
    distanceMiles: store.distanceMiles,
    hoursLabel: null,
    isOpen: null,
    ownershipType: store.ownershipType,
    storeType: store.storeType,
    featureNames: store.features,
    activeCodeCount: store.codeSummary.activeCodeCount,
    codeHealth: toCodeHealth(store),
    codes: toReportedCodeSummaries(store.codes),
    inactiveCodeCount: store.inactiveCodeCount,
    lastUpdatedLabel: formatLastUpdatedLabel(store.codes),
  };
}

function applyCodesToStore(
  store: StoreDetailData,
  codes: PublicCode[],
): StoreDetailData {
  return {
    ...store,
    codes: toReportedCodeSummaries(codes),
    activeCodeCount: codes.filter((code) => code.isActive).length,
    inactiveCodeCount: codes.filter((code) => !code.isActive).length,
    codeHealth: toCodeHealthFromCodes(codes),
    lastUpdatedLabel: formatLastUpdatedLabel(codes),
  };
}

function mergeStores(current: StoreDetailData[], incoming: StoreDetailData[]) {
  const merged = new Map(current.map((store) => [store.id, store]));

  for (const store of incoming) {
    merged.set(store.id, store);
  }

  return Array.from(merged.values());
}

async function loadStores(viewport: {
  latitude: number;
  longitude: number;
  zoom: number;
}, bbox: string | null) {
  const strategy = getStoreLoadStrategy(viewport, bbox);

  if (strategy.mode === "deferred") {
    return {
      stores: [] as StoreDetailData[],
      mode: strategy.mode,
    };
  }

  const url = new URL("/api/locations", window.location.origin);

  if (strategy.mode === "bbox") {
    url.searchParams.set("bbox", strategy.query.bbox);
    url.searchParams.set("limit", String(strategy.query.limit));
  } else {
    url.searchParams.set("lat", strategy.query.latitude.toFixed(5));
    url.searchParams.set("lng", strategy.query.longitude.toFixed(5));
    url.searchParams.set("radius", String(strategy.query.radius));
    url.searchParams.set("limit", String(strategy.query.limit));
  }

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as
    | LocationsResponse
    | {
        error?: string;
      };
  const errorMessage = "error" in payload ? payload.error : undefined;

  if (!response.ok) {
    throw new Error(errorMessage ?? "Unable to load stores for this view.");
  }

  if (!("stores" in payload) || !Array.isArray(payload.stores)) {
    return {
      stores: [] as StoreDetailData[],
      mode: strategy.mode,
    };
  }

  return {
    stores: payload.stores.map(toStoreDetail),
    mode: strategy.mode,
  };
}

async function geocodeSearch(query: string) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return null;
  }

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("country", "us");
  url.searchParams.set("types", "address,postcode,place,locality,neighborhood");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", mapboxToken);

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    features?: Array<{
      geometry?: {
        coordinates?: [number, number];
      };
      properties?: {
        full_address?: string;
        name?: string;
      };
    }>;
  };

  const feature = payload.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (!feature || !coordinates || coordinates.length < 2) {
    return null;
  }

  return {
    longitude: coordinates[0],
    latitude: coordinates[1],
    label:
      feature.properties?.full_address ??
      feature.properties?.name ??
      query,
  };
}

function buildLocalSearchMatches(query: string, stores: StoreDetailData[]) {
  const normalizedQuery = query.toLowerCase();

  return stores.filter((store) => {
    const haystack = [
      store.name,
      store.address,
      store.city,
      store.state,
      store.zip,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

function StartNearbyTeaser({
  onNearMe,
  statusMessage,
}: {
  onNearMe: () => void;
  statusMessage: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-functional text-[0.62rem] tracking-[0.3em] text-brand-primary-dark/65">
          START NEARBY
        </p>
        <h3 className="mt-2 font-display text-[1.45rem] leading-tight text-brand-primary-dark">
          Find a Starbucks in one move.
        </h3>
        <p className="mt-2 text-[0.9rem] leading-6 text-text-secondary">
          Use your location or search by city, ZIP, address, or store name.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[1.3rem] border border-brand-primary/10 bg-white/78 px-4 py-3">
        <div>
          <p className="text-[0.8rem] font-medium text-brand-primary-dark">
            {statusMessage}
          </p>
          <p className="mt-1 text-[0.75rem] text-text-secondary">
            Map, codes, and detail history will open here.
          </p>
        </div>
        <button
          type="button"
          onClick={onNearMe}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-[0.8rem] font-semibold text-white shadow-[0_16px_30px_rgba(22,54,46,0.18)] transition hover:bg-brand-primary-dark"
        >
          <Compass className="h-4 w-4" />
          Use my location
        </button>
      </div>
    </div>
  );
}

function SelectedStoreTeaser({
  store,
  onOpen,
}: {
  store: StoreDetailData;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-[1.4rem] border border-brand-primary/10 bg-white/82 px-4 py-4">
        <p className="font-functional text-[0.62rem] tracking-[0.3em] text-brand-primary-dark/65">
          SELECTED LOCATION
        </p>
        <h3 className="mt-2 font-display text-[1.35rem] leading-tight text-brand-primary-dark">
          {store.name}
        </h3>
        <p className="mt-2 text-[0.85rem] leading-6 text-text-secondary">
          {store.address}, {store.city}, {store.state} {store.zip}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-brand-primary/10 bg-white/90 px-3 py-1.5 text-[0.72rem] font-semibold text-brand-primary-dark">
            {store.activeCodeCount
              ? `${store.activeCodeCount} active code${store.activeCodeCount === 1 ? "" : "s"}`
              : "No active code yet"}
          </span>
          {store.lastUpdatedLabel ? (
            <span className="inline-flex rounded-full border border-brand-primary/10 bg-white/90 px-3 py-1.5 text-[0.72rem] text-text-secondary">
              {store.lastUpdatedLabel}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-3 text-[0.82rem] font-semibold text-white shadow-[0_16px_30px_rgba(22,54,46,0.18)] transition hover:bg-brand-primary-dark"
      >
        <Sparkles className="h-4 w-4" />
        Open full details
      </button>
    </div>
  );
}

export function PitstopShell() {
  const [stores, setStores] = useState<StoreDetailData[]>([]);
  const [boundsQuery, setBoundsQuery] = useState<string | null>(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      ? null
      : "-125.000000,24.500000,-66.500000,49.500000",
  );
  const [searchPhase, setSearchPhase] = useState<SearchPhase>("idle");
  const [searchResults, setSearchResults] = useState<SearchCandidate[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [mapStatusMessage, setMapStatusMessage] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready">(
    "idle",
  );

  const viewport = useMapStore((state) => state.viewport);
  const searchQuery = useMapStore((state) => state.searchQuery);
  const selectedStoreId = useMapStore((state) => state.selectedStoreId);
  const panelMode = useMapStore((state) => state.panelMode);
  const setViewport = useMapStore((state) => state.setViewport);
  const setSearchQuery = useMapStore((state) => state.setSearchQuery);
  const setSelectedStoreId = useMapStore((state) => state.setSelectedStoreId);
  const setPanelMode = useMapStore((state) => state.setPanelMode);
  const recenter = useMapStore((state) => state.recenter);
  const clearSelection = useMapStore((state) => state.clearSelection);

  const { position, status, error, requestLocation } = useGeolocation({
    autoRequest: false,
  });

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  );

  useEffect(() => {
    if (!position) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setViewport({
        latitude: position.latitude,
        longitude: position.longitude,
        zoom: 11.6,
      });
      setStatusMessage("Centered near your location.");
      setSearchPhase("place");
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [position, setViewport]);

  useEffect(() => {
    if (status === "requesting") {
      setStatusMessage("Finding you...");
      return;
    }

    if (status === "denied") {
      setStatusMessage(error ?? "Location denied. Defaulting to the U.S. view.");
    }
  }, [error, status]);

  const viewportLatitude = viewport.latitude;
  const viewportLongitude = viewport.longitude;
  const viewportZoom = viewport.zoom;

  useEffect(() => {
    let active = true;

    const timeout = window.setTimeout(async () => {
      setLoadStatus("loading");
      try {
        const { stores: nextStores, mode } = await loadStores(
          {
            latitude: viewportLatitude,
            longitude: viewportLongitude,
            zoom: viewportZoom,
          },
          boundsQuery,
        );

        if (!active) {
          return;
        }

        if (mode === "deferred") {
          setStores((current) =>
            selectedStoreId
              ? current.filter((store) => store.id === selectedStoreId)
              : [],
          );
          setLoadStatus("ready");
          setMapStatusMessage("Zoom in to load stores across the visible map.");
          return;
        }

        setStores((current) => {
          if (!selectedStoreId) {
            return nextStores;
          }

          const preservedSelection = current.find(
            (store) => store.id === selectedStoreId,
          );

          if (
            !preservedSelection ||
            nextStores.some((store) => store.id === selectedStoreId)
          ) {
            return nextStores;
          }

          return mergeStores(nextStores, [preservedSelection]);
        });
        setLoadStatus("ready");

        if (nextStores.length === 0 && !selectedStoreId) {
          setMapStatusMessage(
            mode === "bbox"
              ? "No qualifying stores are loaded in this view yet."
              : "No nearby qualifying stores are loaded yet.",
          );
        } else if (nextStores.length > 0) {
          setMapStatusMessage(
            mode === "bbox"
              ? `${nextStores.length} qualifying store${nextStores.length === 1 ? "" : "s"} loaded in view.`
              : `${nextStores.length} nearby qualifying store${nextStores.length === 1 ? "" : "s"} loaded.`,
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadStatus("ready");
        setStores([]);
        setMapStatusMessage(
          error instanceof Error
            ? error.message
            : "Unable to load stores right now.",
        );
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    boundsQuery,
    selectedStoreId,
    viewportLatitude,
    viewportLongitude,
    viewportZoom,
  ]);

  function focusStore(store: StoreSummary, nextMessage: string) {
    setSearchResults([]);
    setSelectedResultId(store.id);
    setSearchPhase("exact");
    setSelectedStoreId(store.id);
    setPanelMode("open");
    setViewport({
      latitude: store.latitude,
      longitude: store.longitude,
      zoom: Math.max(viewport.zoom, 13),
    });
    setStatusMessage(nextMessage);
  }

  const handleSearch = async (value: string) => {
    const query = value.trim();
    setSearchQuery(query);
    setSelectedResultId(null);
    setSearchResults([]);

    if (!query) {
      setSearchPhase("idle");
      setStatusMessage("Search by city, ZIP, address, or store name.");
      return;
    }

    const localResolution = resolveSearchCandidates(
      query,
      buildLocalSearchMatches(query, stores),
    );

    if (localResolution.phase === "exact" && localResolution.selectedStore) {
      focusStore(localResolution.selectedStore, `Jumped to ${localResolution.selectedStore.name}.`);
      return;
    }

    if (localResolution.phase === "results" && localResolution.candidates.length > 0) {
      clearSelection();
      setPanelMode(localResolution.panelMode);
      setSearchPhase("results");
      setSearchResults(localResolution.candidates);
      setSelectedResultId(localResolution.selectedResultId);
      setStatusMessage("Choose the closest matching Starbucks.");
      return;
    }

    setSearchPhase("searching");
    setStatusMessage(`Searching for ${query}...`);

    try {
      const url = new URL("/api/search", window.location.origin);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "6");

      const response = await fetch(url, { cache: "no-store" });
      const payload = (await response.json()) as
        | {
            stores?: PublicStore[];
            error?: string;
          }
        | undefined;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Search failed.");
      }

      const results = Array.isArray(payload?.stores)
        ? payload.stores.map(toStoreDetail)
        : [];

      if (results.length > 0) {
        setStores((current) => mergeStores(current, results));
        const remoteResolution = resolveSearchCandidates(query, results);

        if (remoteResolution.phase === "exact" && remoteResolution.selectedStore) {
          focusStore(remoteResolution.selectedStore, `Jumped to ${remoteResolution.selectedStore.name}.`);
          return;
        }

        clearSelection();
        setPanelMode(remoteResolution.panelMode);
        setSearchPhase("results");
        setSearchResults(remoteResolution.candidates);
        setSelectedResultId(remoteResolution.selectedResultId);
        setStatusMessage("Multiple stores matched. Pick the one you want.");
        return;
      }

      const geocoded = await geocodeSearch(query);

      if (geocoded) {
        clearSelection();
        setSearchPhase("place");
        setSearchResults([]);
        setPanelMode("peek");
        setViewport({
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          zoom: Math.max(viewport.zoom, 10.5),
        });
        setStatusMessage(
          `Moved the map to ${geocoded.label}. Zoom in to load nearby stores.`,
        );
        return;
      }

      setSearchPhase("empty");
      setStatusMessage("No qualifying store or place match found.");
    } catch (error) {
      setSearchPhase("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Search failed right now.",
      );
    }
  };

  const handleNearMe = () => {
    requestLocation();
    setSearchResults([]);
    setSelectedResultId(null);
    setStatusMessage("Finding you...");
    setPanelMode("peek");
  };

  const handleRecenter = () => {
    if (position) {
      recenter({
        latitude: position.latitude,
        longitude: position.longitude,
        zoom: 11.6,
      });
      setStatusMessage("Back near your saved location.");
      return;
    }

    recenter({
      latitude: 39.8283,
      longitude: -98.5795,
      zoom: 3.5,
    });
    setStatusMessage("Back to the nationwide view.");
  };

  const mapStatus =
    status === "granted"
      ? "Location locked."
      : status === "denied"
        ? error ?? "Location denied. Defaulting to the U.S. view."
        : status === "requesting"
          ? "Finding you..."
          : "Search the U.S. map or use your location.";

  const trustItems = [
    {
      label: "Anonymous by design",
      icon: ShieldCheck,
    },
    {
      label: "Conservative filtering",
      icon: Sparkles,
    },
  ];

  const mobilePeekContent = selectedStore ? (
    <SelectedStoreTeaser
      store={selectedStore}
      onOpen={() => setPanelMode("open")}
    />
  ) : (
    <StartNearbyTeaser
      onNearMe={handleNearMe}
      statusMessage={statusMessage ?? mapStatusMessage ?? mapStatus}
    />
  );

  async function submitCode(code: string) {
    if (!selectedStore) {
      throw new Error("Choose a store before submitting a code.");
    }

    const deviceId = getOrCreateDeviceId();

    if (!deviceId) {
      throw new Error("This browser could not create an anonymous device ID.");
    }

    const response = await fetch("/api/codes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        storeId: selectedStore.id,
        code,
        deviceId,
      }),
    });

    const payload = (await response.json()) as
      | CodesResponse
      | {
          error?: string;
        };
    const errorMessage = "error" in payload ? payload.error : undefined;

    if (!response.ok || !("codes" in payload)) {
      throw new Error(errorMessage ?? "Unable to submit a code right now.");
    }

    setStores((current) =>
      current.map((store) =>
        store.id === selectedStore.id
          ? applyCodesToStore(store, payload.codes)
          : store,
      ),
    );

    return payload.existing
      ? "That code was already on file, so I refreshed the current vote state."
      : "Code saved. Thanks for helping the next person.";
  }

  async function voteOnCode(codeId: string, vote: "up" | "down") {
    if (!selectedStore) {
      throw new Error("Choose a store before voting.");
    }

    const deviceId = getOrCreateDeviceId();

    if (!deviceId) {
      throw new Error("This browser could not create an anonymous device ID.");
    }

    const response = await fetch("/api/votes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        codeId,
        voteType: vote,
        deviceId,
      }),
    });

    const payload = (await response.json()) as
      | VoteResponse
      | {
          error?: string;
        };
    const errorMessage = "error" in payload ? payload.error : undefined;

    if (!response.ok || !("codes" in payload)) {
      throw new Error(errorMessage ?? "Unable to save that vote right now.");
    }

    setStores((current) =>
      current.map((store) =>
        store.id === selectedStore.id
          ? applyCodesToStore(store, payload.codes)
          : store,
      ),
    );

    return vote === "up"
      ? "Marked as still working."
      : "Marked as not working.";
  }

  return (
    <div className="flex h-dvh min-h-dvh flex-col">
      <Navbar />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-3 px-[var(--space-page)] pb-[var(--space-page)] pt-3 lg:flex-row lg:gap-4">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            <div className="space-y-2">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={handleSearch}
                onNearMe={handleNearMe}
                onResultSelect={(storeId) => {
                  const match = stores.find((store) => store.id === storeId);

                  if (!match) {
                    return;
                  }

                  focusStore(match, `Showing ${match.name}.`);
                }}
                results={searchResults}
                selectedResultId={selectedResultId}
                searchState={searchPhase}
                onClear={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setSelectedResultId(null);
                  setSearchPhase("idle");
                  setStatusMessage("Search cleared.");
                }}
                statusText={
                  searchPhase === "searching"
                    ? "Searching..."
                    : statusMessage ?? mapStatusMessage ?? mapStatus
                }
              />

              <div className="flex flex-wrap items-center gap-2">
                {trustItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <span
                      key={item.label}
                      className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/72 px-3 py-1.5 text-[0.72rem] font-medium text-text-secondary shadow-[0_10px_24px_rgba(22,54,46,0.08)] backdrop-blur-md"
                    >
                      <Icon className="h-3.5 w-3.5 text-brand-primary-dark" />
                      {item.label}
                    </span>
                  );
                })}
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-accent/15 bg-brand-accent/10 px-3 py-1.5 text-[0.72rem] font-medium text-brand-primary-dark">
                  Map-first lookup
                </span>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(180deg,rgba(31,74,61,0.03),transparent_42%)]" />
              <StoreMap
                stores={stores}
                selectedStoreId={selectedStoreId}
                viewport={viewport}
                onViewportChange={setViewport}
                onBoundsChange={setBoundsQuery}
                panelMode={panelMode}
                onStoreSelect={(storeId) => {
                  const match = stores.find((store) => store.id === storeId);
                  setSearchResults([]);
                  setSelectedResultId(storeId);
                  setSearchPhase("exact");

                  if (match) {
                    setStatusMessage(`Viewing ${match.name}.`);
                  }

                  setSelectedStoreId(storeId);
                  setPanelMode("open");
                }}
                onViewportCommit={() => {
                  if (!selectedStoreId) {
                    setPanelMode("peek");
                  }
                }}
                onMapReady={() => {
                  if (!selectedStoreId) {
                    setPanelMode("peek");
                  }
                }}
                mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              />

              <MapControls
                onZoomIn={() => {
                  setViewport({ zoom: viewport.zoom + 0.75 });
                }}
                onZoomOut={() => {
                  setViewport({ zoom: Math.max(2, viewport.zoom - 0.75) });
                }}
                onRecenter={handleRecenter}
                statusText={
                  loadStatus === "loading"
                    ? "Synchronizing map data..."
                    : mapStatusMessage ?? undefined
                }
              />

              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 hidden md:block lg:hidden">
                <div className="surface-card max-w-[18rem] rounded-[1.4rem] px-4 py-3">
                  <p className="font-functional text-[0.62rem] tracking-[0.28em] text-brand-primary-dark/65">
                    QUICK LOOKUP
                  </p>
                  <p className="mt-2 text-[0.82rem] leading-6 text-text-secondary">
                    Search above or tap a pin. The detail sheet stays compact
                    until you open a location.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <StoreDetailPanel
            store={selectedStore}
            open={panelMode !== "collapsed"}
            variant="sidebar"
            onSubmitCode={submitCode}
            onVote={voteOnCode}
            onClose={clearSelection}
          />
        </div>
      </main>

      <StoreDetailPanel
        store={selectedStore}
        open={panelMode !== "collapsed"}
        sheetState={panelMode}
        variant="sheet"
        peekContent={mobilePeekContent}
        onSubmitCode={submitCode}
        onVote={voteOnCode}
        onToggle={() => {
          setPanelMode(panelMode === "open" ? "peek" : "open");
        }}
        onSheetStateChange={setPanelMode}
        onClose={() => {
          clearSelection();
          setPanelMode("collapsed");
        }}
      />
    </div>
  );
}
