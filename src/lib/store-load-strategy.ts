interface MapViewportLike {
  latitude: number;
  longitude: number;
  zoom: number;
}

export const MIN_BBOX_STORE_ZOOM = 6;
export const MAX_BBOX_STORE_LIMIT = 200;
export const MAX_RADIUS_STORE_LIMIT = 100;

export type StoreLoadStrategy =
  | {
      mode: "bbox";
      query: {
        bbox: string;
        limit: number;
      };
    }
  | {
      mode: "radius";
      query: {
        latitude: number;
        longitude: number;
        radius: number;
        limit: number;
      };
    }
  | {
      mode: "deferred";
    };

export function getStoreLoadStrategy(
  viewport: MapViewportLike,
  bbox: string | null,
): StoreLoadStrategy {
  if (bbox) {
    if (viewport.zoom < MIN_BBOX_STORE_ZOOM) {
      return { mode: "deferred" };
    }

    return {
      mode: "bbox",
      query: {
        bbox,
        limit: MAX_BBOX_STORE_LIMIT,
      },
    };
  }

  const radius = Math.max(2, Math.min(25, Math.round(18 - viewport.zoom)));

  return {
    mode: "radius",
    query: {
      latitude: viewport.latitude,
      longitude: viewport.longitude,
      radius,
      limit: MAX_RADIUS_STORE_LIMIT,
    },
  };
}
