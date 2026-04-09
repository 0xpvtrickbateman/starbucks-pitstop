"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { SearchBar } from "@/components/layout/SearchBar";
import { MapControls } from "@/components/map/MapControls";
import { StoreDetailPanel } from "@/components/store/StoreDetailPanel";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type {
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
    <div className="map-frame relative min-h-[48rem] rounded-[2rem] border border-white/50" />
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
  const url = new URL("/api/locations", window.location.origin);

  if (bbox) {
    url.searchParams.set("bbox", bbox);
    url.searchParams.set("limit", "500");
  } else {
    const radius = Math.max(2, Math.min(25, Math.round(18 - viewport.zoom)));
    url.searchParams.set("lat", viewport.latitude.toFixed(5));
    url.searchParams.set("lng", viewport.longitude.toFixed(5));
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("limit", "100");
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
    return [] as StoreDetailData[];
  }

  return payload.stores.map(toStoreDetail);
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

export function PitstopShell() {
  const [stores, setStores] = useState<StoreDetailData[]>([]);
  const [boundsQuery, setBoundsQuery] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
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
    requestLocation();
  }, [requestLocation]);

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
      setSearchStatus("Centered near your location.");
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [position, setViewport]);

  const viewportLatitude = viewport.latitude;
  const viewportLongitude = viewport.longitude;
  const viewportZoom = viewport.zoom;

  useEffect(() => {
    let active = true;

    const timeout = window.setTimeout(async () => {
      setLoadStatus("loading");
      try {
        const nextStores = await loadStores(
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
          setSearchStatus("No qualifying stores are loaded in this view yet.");
        } else if (nextStores.length > 0) {
          setSearchStatus(
            `${nextStores.length} qualifying store${nextStores.length === 1 ? "" : "s"} loaded in view.`,
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setLoadStatus("ready");
        setStores([]);
        setSearchStatus(
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

  const handleSearch = async (value: string) => {
    const query = value.trim();
    setSearchQuery(query);

    if (!query) {
      setSearchStatus("Search by city, ZIP, address, or store name.");
      return;
    }

    const match = stores.find((store) => {
      const haystack = [
        store.name,
        store.address,
        store.city,
        store.state,
        store.zip,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query.toLowerCase());
    });

    if (match) {
      setSelectedStoreId(match.id);
      setViewport({
        latitude: match.latitude,
        longitude: match.longitude,
        zoom: Math.max(viewport.zoom, 13),
      });
      setSearchStatus(`Jumped to ${match.name}.`);
      return;
    }

    setSearchStatus(`Searching for ${query}...`);

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
        const [first] = results;
        setStores((current) => mergeStores(current, results));
        setSelectedStoreId(first.id);
        setPanelMode("open");
        setViewport({
          latitude: first.latitude,
          longitude: first.longitude,
          zoom: Math.max(viewport.zoom, 13),
        });
        setSearchStatus(`Jumped to ${first.name}.`);
        return;
      }

      const geocoded = await geocodeSearch(query);

      if (geocoded) {
        clearSelection();
        setPanelMode("peek");
        setViewport({
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
          zoom: Math.max(viewport.zoom, 10.5),
        });
        setSearchStatus(
          `Moved the map to ${geocoded.label}. Zoom in to load nearby stores.`,
        );
        return;
      }

      setSearchStatus("No qualifying store or place match found.");
    } catch (error) {
      setSearchStatus(
        error instanceof Error ? error.message : "Search failed right now.",
      );
    }
  };

  const handleNearMe = () => {
    requestLocation();
    setPanelMode("peek");
  };

  const handleRecenter = () => {
    if (position) {
      recenter({
        latitude: position.latitude,
        longitude: position.longitude,
        zoom: 11.6,
      });
      return;
    }

    recenter({
      latitude: 39.8283,
      longitude: -98.5795,
      zoom: 3.5,
    });
  };

  const mapStatus =
    status === "granted"
      ? "Location locked."
      : status === "denied"
        ? error ?? "Location denied. Defaulting to the U.S. view."
        : status === "requesting"
          ? "Finding you..."
          : "Search the U.S. map.";

  const selectedStoreStatus =
    selectedStore?.lastUpdatedLabel ?? searchStatus ?? mapStatus;

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
    <div className="flex min-h-dvh flex-col">
      <Navbar />

      <main className="relative flex-1 overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col gap-4 px-[var(--space-page)] pb-[var(--space-page)] pt-4 lg:flex-row">
          <section className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="space-y-3">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={handleSearch}
                onNearMe={handleNearMe}
                onClear={() => {
                  setSearchQuery("");
                  setSearchStatus("Search cleared.");
                }}
                statusText={searchStatus ?? mapStatus}
              />

              <div className="flex flex-wrap gap-2">
                {[
                  "Company-operated first",
                  "Conservative filtering",
                  "Mobile-first detail sheet",
                ].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-3 py-1.5 text-[0.72rem] font-medium text-text-secondary shadow-[0_10px_24px_rgba(22,54,46,0.08)] backdrop-blur-md"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative flex-1">
              <div className="absolute inset-0 rounded-[2rem] bg-[linear-gradient(180deg,rgba(31,74,61,0.03),transparent_42%)]" />
              <StoreMap
                stores={stores}
                selectedStoreId={selectedStoreId}
                viewport={viewport}
                onViewportChange={setViewport}
                onBoundsChange={setBoundsQuery}
                onStoreSelect={(storeId) => {
                  setSelectedStoreId(storeId);
                  setPanelMode("open");
                }}
                onViewportCommit={() => {
                  setPanelMode("peek");
                }}
                onMapReady={() => {
                  setPanelMode("peek");
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
                onNearMe={handleNearMe}
                nearMeStatus={
                  loadStatus === "loading"
                    ? "Synchronizing map data..."
                    : searchStatus ?? undefined
                }
              />
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

      <div className="safe-area-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 px-[var(--space-page)] pb-[var(--space-page)] lg:hidden">
        <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-full border border-white/70 bg-white/82 px-4 py-3 text-[0.76rem] text-text-secondary shadow-[0_18px_36px_rgba(22,54,46,0.16)] backdrop-blur-md">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-state-success" />
            {loadStatus === "loading"
              ? "Loading stores"
              : selectedStoreStatus ?? "Tap a pin to open details"}
          </span>
          <button
            type="button"
            onClick={handleNearMe}
            className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-3 py-2 font-semibold text-white transition hover:bg-brand-primary-dark"
          >
            Use my location
          </button>
        </div>
      </div>

      <StoreDetailPanel
        store={selectedStore}
        open={panelMode !== "collapsed"}
        variant="sheet"
        onSubmitCode={submitCode}
        onVote={voteOnCode}
        onClose={() => {
          clearSelection();
          setPanelMode("collapsed");
        }}
      />
    </div>
  );
}
