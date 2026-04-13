"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, Point } from "geojson";
import Supercluster from "supercluster";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import type { PaddingOptions } from "mapbox-gl";
import { AlertTriangle, MapPin, Sparkles } from "lucide-react";
import type { StoreSummary, StoreCodeHealth } from "@/components/home/types";
import { StoreCluster } from "@/components/map/StoreCluster";
import { StoreMarker } from "@/components/map/StoreMarker";
import { getMapboxRecoveryIssueForOrigin } from "@/lib/mapbox-origin";
import type { MapPanelMode, MapViewport } from "@/stores/mapStore";

interface StoreMapProps {
  stores: StoreSummary[];
  selectedStoreId: string | null;
  viewport: MapViewport;
  onViewportChange: (viewport: Partial<MapViewport>) => void;
  onStoreSelect: (storeId: string) => void;
  onBoundsChange?: (bbox: string) => void;
  onViewportCommit?: (viewport: Partial<MapViewport>) => void;
  onMapReady?: () => void;
  panelMode?: MapPanelMode;
  mapboxToken?: string;
}

interface StoreFeatureProps {
  storeId: string;
  name: string;
  health: StoreCodeHealth;
  activeCodeCount: number;
}

interface ClusterFeatureProps {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated?: number;
}

type MapFeature = Feature<
  Point,
  StoreFeatureProps | ClusterFeatureProps
>;

type StorePointFeature = Feature<Point, StoreFeatureProps>;

function emitBoundsQuery(
  map: MapRef | null,
  onBoundsChange?: (bbox: string) => void,
) {
  const bounds = map?.getBounds();

  if (!bounds || !onBoundsChange) {
    return;
  }

  onBoundsChange(
    [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ]
      .map((value) => value.toFixed(6))
      .join(","),
  );
}

function refreshMapLayout(
  map: MapRef | null,
  onBoundsChange?: (bbox: string) => void,
) {
  if (!map) {
    return;
  }

  map.resize();
  emitBoundsQuery(map, onBoundsChange);
}

function isClusterFeature(
  feature: MapFeature,
): feature is Feature<Point, ClusterFeatureProps> {
  return Boolean((feature.properties as ClusterFeatureProps).cluster);
}

function getHealth(store: StoreSummary): StoreCodeHealth {
  if (store.codeHealth) {
    return store.codeHealth;
  }

  if ((store.activeCodeCount ?? 0) >= 2) {
    return "mixed";
  }

  if ((store.activeCodeCount ?? 0) >= 1) {
    return "confident";
  }

  return "empty";
}

function mapStoresToFeatures(stores: StoreSummary[]): StorePointFeature[] {
  return stores
    .filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude))
    .map((store) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [store.longitude, store.latitude],
      },
      properties: {
        storeId: store.id,
        name: store.name,
        health: getHealth(store),
        activeCodeCount: store.activeCodeCount ?? 0,
      },
    }));
}

function LoadingFrame() {
  return (
    <div className="map-frame relative flex h-full min-h-[24rem] items-center justify-center overflow-hidden rounded-[2rem] border border-white/50 sm:min-h-[30rem] lg:min-h-[48rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.88),rgba(255,255,255,0.6),rgba(255,255,255,0.24))]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(31,74,61,0.05),transparent_45%),radial-gradient(circle_at_25%_20%,rgba(203,162,88,0.14),transparent_24%)]" />
      <div className="surface-card relative z-10 max-w-sm rounded-[2rem] px-6 py-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary-dark">
          <Sparkles className="h-7 w-7" />
        </div>
        <p className="font-functional text-[0.72rem] tracking-[0.32em] text-brand-primary-dark/70">
          MAP READY
        </p>
        <h2 className="mt-2 font-display text-[1.7rem] leading-tight text-brand-primary-dark">
          Loading the pitstop map shell.
        </h2>
        <p className="mt-3 text-[0.96rem] leading-7 text-text-secondary">
          Nearby stores, clusters, and code states will appear here as the map
          loads qualifying stores from the synced cache.
        </p>
      </div>
    </div>
  );
}

function MissingTokenFrame({
  stores,
  onStoreSelect,
}: {
  stores: StoreSummary[];
  onStoreSelect: (storeId: string) => void;
}) {
  const previewStores = stores.slice(0, 4);

  return (
    <div className="map-frame relative flex h-full min-h-[24rem] items-center justify-center overflow-hidden rounded-[2rem] border border-white/50 sm:min-h-[30rem] lg:min-h-[48rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(31,74,61,0.1),transparent_20%),radial-gradient(circle_at_80%_20%,rgba(203,162,88,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.52))]" />
      <div className="surface-card relative z-10 max-w-xl rounded-[2rem] px-6 py-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary-dark">
          <MapPin className="h-7 w-7" />
        </div>
        <p className="font-functional text-[0.72rem] tracking-[0.32em] text-brand-primary-dark/70">
          MAP TOKEN REQUIRED
        </p>
        <h2 className="mt-2 font-display text-[1.7rem] leading-tight text-brand-primary-dark">
          The interactive map is disabled until a Mapbox token is configured.
        </h2>
        <p className="mt-3 text-[0.96rem] leading-7 text-text-secondary">
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to unlock the map. Store
          search, the detail panel, code submission, and voting still work
          locally.
        </p>

        {previewStores.length > 0 ? (
          <div className="mt-6 grid gap-3 text-left">
            {previewStores.map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => onStoreSelect(store.id)}
                className="rounded-[1.2rem] border border-brand-primary/10 bg-white/82 px-4 py-3 transition hover:-translate-y-0.5 hover:bg-white"
              >
                <p className="font-medium text-brand-primary-dark">{store.name}</p>
                <p className="mt-1 text-[0.82rem] leading-6 text-text-secondary">
                  {store.address}, {store.city}, {store.state} {store.zip}
                </p>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getStoreMarkerLabel(
  name: string,
  health: StoreCodeHealth,
  activeCodeCount: number,
) {
  const codeSummary =
    activeCodeCount > 0
      ? `${activeCodeCount} active restroom code${activeCodeCount === 1 ? "" : "s"}`
      : "no active restroom code yet";

  const confidenceLabel =
    health === "confident"
      ? "higher confidence"
      : health === "mixed"
        ? "mixed confidence"
        : "waiting for reports";

  return `Open details for ${name}, ${codeSummary}, ${confidenceLabel}`;
}

function MapRecoveryCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-30 sm:left-4 sm:right-auto sm:top-4 sm:bottom-auto sm:max-w-[22rem]">
      <div className="surface-card rounded-[1.6rem] px-4 py-3 text-left">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-brand-primary-dark">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-brand-primary-dark">{title}</p>
            <p className="mt-1 text-[0.8rem] leading-6 text-text-secondary">
              {body}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StoreMap({
  stores,
  selectedStoreId,
  viewport,
  onViewportChange,
  onStoreSelect,
  onBoundsChange,
  onViewportCommit,
  onMapReady,
  panelMode,
  mapboxToken,
}: StoreMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [recoveryIssue, setRecoveryIssue] = useState<{
    title: string;
    body: string;
  } | null>(() =>
    typeof window === "undefined"
      ? null
      : getMapboxRecoveryIssueForOrigin(window.location.href),
  );
  const clusterIndex = useMemo(() => {
    const index = new Supercluster<StoreFeatureProps, ClusterFeatureProps>({
      radius: 54,
      maxZoom: 18,
      minZoom: 2,
    });

    index.load(mapStoresToFeatures(stores) as never);
    return index;
  }, [stores]);

  const clusterFeatures = useMemo(() => {
    // Approximate the visible span at the current zoom level with a 1.5x buffer
    // to prevent clusters from popping in/out during panning.
    const latSpan = 180 / Math.pow(2, viewport.zoom);
    const lngSpan = 360 / Math.pow(2, viewport.zoom);
    const buffer = 1.5;
    const bounds: [number, number, number, number] = [
      viewport.longitude - (lngSpan * buffer) / 2,
      Math.max(-85, viewport.latitude - (latSpan * buffer) / 2),
      viewport.longitude + (lngSpan * buffer) / 2,
      Math.min(85, viewport.latitude + (latSpan * buffer) / 2),
    ];
    return clusterIndex.getClusters(bounds, Math.max(0, Math.round(viewport.zoom))) as MapFeature[];
  }, [clusterIndex, viewport.zoom, viewport.latitude, viewport.longitude]);

  useEffect(() => {
    if (!mapboxToken) {
      return;
    }

    let frameId = 0;
    let timeoutId = 0;

    frameId = window.requestAnimationFrame(() => {
      refreshMapLayout(mapRef.current, onBoundsChange);
    });
    timeoutId = window.setTimeout(() => {
      refreshMapLayout(mapRef.current, onBoundsChange);
    }, 180);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [mapboxToken, onBoundsChange, panelMode]);

  useEffect(() => {
    if (
      !mapboxToken ||
      typeof ResizeObserver === "undefined" ||
      !mapShellRef.current
    ) {
      return;
    }

    let frameId = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        refreshMapLayout(mapRef.current, onBoundsChange);
      });
    });

    observer.observe(mapShellRef.current);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [mapboxToken, onBoundsChange]);

  if (!mapboxToken) {
    return stores.length > 0 ? (
      <MissingTokenFrame stores={stores} onStoreSelect={onStoreSelect} />
    ) : (
      <LoadingFrame />
    );
  }

  const mapStyle = "mapbox://styles/mapbox/light-v11";

  return (
    <div
      ref={mapShellRef}
      className="relative h-full min-h-[24rem] overflow-hidden rounded-[2rem] border border-white/50 bg-surface-elevated sm:min-h-[30rem] lg:min-h-[48rem]"
    >
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        mapStyle={mapStyle}
        initialViewState={viewport as never}
        viewState={viewport as never}
        onMove={(event) => {
          onViewportChange(event.viewState as MapViewport & { padding?: PaddingOptions });
        }}
        onMoveEnd={(event) => {
          onViewportCommit?.(event.viewState as MapViewport & { padding?: PaddingOptions });
          emitBoundsQuery(mapRef.current, onBoundsChange);
        }}
        onLoad={() => {
          setMapLoaded(true);
          onMapReady?.();
          refreshMapLayout(mapRef.current, onBoundsChange);
          window.requestAnimationFrame(() => {
            refreshMapLayout(mapRef.current, onBoundsChange);
          });
          window.setTimeout(() => {
            refreshMapLayout(mapRef.current, onBoundsChange);
          }, 180);
        }}
        onError={() => {
          setRecoveryIssue((current) =>
            current ?? {
              title: "Basemap unavailable right now",
              body:
                "Store pins, search, and code details still work, but the background map tiles could not load on this origin.",
            },
          );
        }}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {mapLoaded
          ? clusterFeatures.map((feature) => {
              const [longitude, latitude] = feature.geometry.coordinates;
              if (isClusterFeature(feature)) {
                return (
                  <Marker
                    key={`cluster-${feature.properties.cluster_id}`}
                    longitude={longitude}
                    latitude={latitude}
                    anchor="center"
                  >
                    <StoreCluster
                      pointCount={feature.properties.point_count}
                      label={`Expand cluster with ${feature.properties.point_count} qualifying stores`}
                      onClick={() => {
                        const expansionZoom = Math.min(
                          clusterIndex.getClusterExpansionZoom(
                            feature.properties.cluster_id,
                          ),
                          18,
                        );
                        onViewportChange({
                          ...viewport,
                          latitude,
                          longitude,
                          zoom: expansionZoom,
                        });
                      }}
                    />
                  </Marker>
                );
              }

              return (
                <Marker
                  key={(feature.properties as StoreFeatureProps).storeId}
                  longitude={longitude}
                  latitude={latitude}
                  anchor="bottom"
                >
                  <StoreMarker
                    health={(feature.properties as StoreFeatureProps).health}
                    label={getStoreMarkerLabel(
                      (feature.properties as StoreFeatureProps).name,
                      (feature.properties as StoreFeatureProps).health,
                      (feature.properties as StoreFeatureProps).activeCodeCount,
                    )}
                    selected={
                      selectedStoreId === (feature.properties as StoreFeatureProps).storeId
                    }
                    onClick={() =>
                      onStoreSelect((feature.properties as StoreFeatureProps).storeId)
                    }
                  />
                </Marker>
              );
            })
          : null}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-white/65 to-transparent" />
      </Map>

      <div className="pointer-events-none absolute left-4 top-4 z-20 hidden max-w-[19rem] rounded-full border border-brand-primary/10 bg-white/82 px-4 py-2 text-[0.72rem] text-text-secondary shadow-[0_16px_32px_rgba(22,54,46,0.12)] backdrop-blur-md lg:block">
        <span className="font-semibold text-brand-primary-dark">Clustered view</span>
        <span className="mx-2 text-brand-primary-dark/30">•</span>
        Tappable pins, conservative filtering, and mobile-first map interactions.
      </div>

      {recoveryIssue ? (
        <MapRecoveryCard
          title={recoveryIssue.title}
          body={recoveryIssue.body}
        />
      ) : null}
    </div>
  );
}
