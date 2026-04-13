import { describe, expect, it } from "vitest";

import {
  getStoreLoadStrategy,
  MAX_BBOX_STORE_LIMIT,
  MAX_RADIUS_STORE_LIMIT,
  MIN_BBOX_STORE_ZOOM,
} from "@/lib/store-load-strategy";

describe("getStoreLoadStrategy", () => {
  it("defers bbox loading while the map is still zoomed out", () => {
    const strategy = getStoreLoadStrategy(
      {
        latitude: 39.8283,
        longitude: -98.5795,
        zoom: MIN_BBOX_STORE_ZOOM - 0.5,
      },
      "-111.795291,31.702925,-85.363709,47.163786",
    );

    expect(strategy).toEqual({ mode: "deferred" });
  });

  it("switches to bbox loading once the map is zoomed in enough", () => {
    const strategy = getStoreLoadStrategy(
      {
        latitude: 47.6062,
        longitude: -122.3321,
        zoom: MIN_BBOX_STORE_ZOOM,
      },
      "-122.5,47.4,-122.2,47.7",
    );

    expect(strategy).toEqual({
      mode: "bbox",
      query: {
        bbox: "-122.5,47.4,-122.2,47.7",
        limit: MAX_BBOX_STORE_LIMIT,
      },
    });
  });

  it("uses a bounded radius query before bounds are available", () => {
    const strategy = getStoreLoadStrategy(
      {
        latitude: 33.4484,
        longitude: -112.074,
        zoom: 3.5,
      },
      null,
    );

    expect(strategy).toEqual({
      mode: "radius",
      query: {
        latitude: 33.4484,
        longitude: -112.074,
        radius: 15,
        limit: MAX_RADIUS_STORE_LIMIT,
      },
    });
  });
});
