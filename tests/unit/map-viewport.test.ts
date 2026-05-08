import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_VIEWPORT,
  mapViewportsEqual,
  normalizeMapViewport,
} from "@/lib/map-viewport";

describe("map viewport normalization", () => {
  it("rejects non-finite camera values by preserving the current viewport", () => {
    const current = {
      ...DEFAULT_MAP_VIEWPORT,
      latitude: 47.6062,
      longitude: -122.3321,
      zoom: 11,
    };

    expect(
      normalizeMapViewport(
        {
          latitude: Number.NaN,
          longitude: Number.POSITIVE_INFINITY,
          zoom: Number.NEGATIVE_INFINITY,
        },
        current,
      ),
    ).toMatchObject({
      latitude: 47.6062,
      longitude: -122.3321,
      zoom: 11,
    });
  });

  it("clamps latitude, zoom, pitch, and normalizes wrapped longitudes", () => {
    expect(
      normalizeMapViewport(
        {
          latitude: 91,
          longitude: 181,
          zoom: 25,
          pitch: 100,
        },
        DEFAULT_MAP_VIEWPORT,
      ),
    ).toMatchObject({
      latitude: 85,
      longitude: -179,
      zoom: 18,
      pitch: 85,
    });
  });

  it("treats sub-pixel camera jitter as unchanged", () => {
    const next = {
      ...DEFAULT_MAP_VIEWPORT,
      latitude: DEFAULT_MAP_VIEWPORT.latitude + 0.0000001,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    };

    expect(mapViewportsEqual(DEFAULT_MAP_VIEWPORT, next)).toBe(true);
  });
});
