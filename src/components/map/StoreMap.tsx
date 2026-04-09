"use client";

import { useMemo, useRef } from "react";
import type { Feature, Point } from "geojson";
import Supercluster from "supercluster";
import Map, { Marker, type MapRef } from "react-map-gl/mapbox";
import type { PaddingOptions } from "mapbox-gl";
import { MapPin, Sparkles } from "lucide-react";
import type { StoreSummary, StoreCodeHealth } from "@/components/home/types";
import { StoreCluster } from "@/components/map/StoreCluster";
import { StoreMarker } from "@/components/map/StoreMarker";
import type { MapViewport } from "@/stores/mapStore";

interface StoreMapProps {
  stores: StoreSummary[];
  selectedStoreId: string | null;
  viewport: MapViewport;
  onViewportChange: (viewport: Partial<MapViewport>) => void;
  onStoreSelect: (storeId: string) => void;
  onBoundsChange?: (bbox: string) => void;
  onViewportCommit?: (viewport: Partial<MapViewport>) => void;
  onMapReady?: () => void;
  mapboxToken?: string;
}

interface StoreFeatureProps {
  storeId: string;
  name: string;
  health: StoreCodeHealth;
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
      },
    }));
}

function LoadingFrame() {
  return (
    <div className="map-frame relative flex h-full min-h-[48rem] items-center justify-center overflow-hidden rounded-[2rem] border border-white/50">
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

function EmptyMapFrame() {
  return (
    <div className="map-frame relative flex h-full min-h-[48rem] items-center justify-center overflow-hidden rounded-[2rem] border border-white/50">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(31,74,61,0.12),transparent_20%),radial-gradient(circle_at_80%_20%,rgba(203,162,88,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.5))]" />
      <div className="surface-card relative z-10 max-w-md rounded-[2rem] px-6 py-7 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary-dark">
          <MapPin className="h-7 w-7" />
        </div>
        <p className="font-functional text-[0.72rem] tracking-[0.32em] text-brand-primary-dark/70">
          NO STORES LOADED
        </p>
        <h2 className="mt-2 font-display text-[1.7rem] leading-tight text-brand-primary-dark">
          No qualifying stores are loaded in this view yet.
        </h2>
        <p className="mt-3 text-[0.96rem] leading-7 text-text-secondary">
          Pan the map, zoom in, or search a city or ZIP to load nearby
          qualifying Starbucks locations.
        </p>
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
  mapboxToken,
}: StoreMapProps) {
  const mapRef = useRef<MapRef | null>(null);
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
    const bounds = [-180, -85, 180, 85] as [number, number, number, number];
    return clusterIndex.getClusters(bounds, Math.max(0, Math.round(viewport.zoom))) as MapFeature[];
  }, [clusterIndex, viewport.zoom]);

  if (!mapboxToken) {
    return stores.length > 0 ? <EmptyMapFrame /> : <LoadingFrame />;
  }

  const mapStyle = "mapbox://styles/mapbox/light-v11";

  const emitBounds = () => {
    const bounds = mapRef.current?.getBounds();

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
  };

  return (
    <div className="relative h-full min-h-[48rem] overflow-hidden rounded-[2rem] border border-white/50 bg-surface-elevated">
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
          emitBounds();
        }}
        onLoad={() => {
          onMapReady?.();
          emitBounds();
        }}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {clusterFeatures.map((feature) => {
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
                selected={
                  selectedStoreId === (feature.properties as StoreFeatureProps).storeId
                }
                onClick={() =>
                  onStoreSelect((feature.properties as StoreFeatureProps).storeId)
                }
              />
            </Marker>
          );
        })}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-white/65 to-transparent" />
      </Map>

      <div className="pointer-events-none absolute left-4 top-4 z-20 hidden max-w-[19rem] rounded-full border border-brand-primary/10 bg-white/82 px-4 py-2 text-[0.72rem] text-text-secondary shadow-[0_16px_32px_rgba(22,54,46,0.12)] backdrop-blur-md lg:block">
        <span className="font-semibold text-brand-primary-dark">Clustered view</span>
        <span className="mx-2 text-brand-primary-dark/30">•</span>
        Tappable pins, conservative filtering, and mobile-first map interactions.
      </div>
    </div>
  );
}
