import { describe, expect, it } from "vitest";

describe("viewport bounds calculation", () => {
  // Validates the formula used in StoreMap.tsx for computing
  // approximate viewport bounds from lat/lng/zoom.
  function getViewportBounds(
    lat: number,
    lng: number,
    zoom: number,
  ): [number, number, number, number] {
    const latSpan = 180 / Math.pow(2, zoom);
    const lngSpan = 360 / Math.pow(2, zoom);
    const buffer = 1.5;
    return [
      lng - (lngSpan * buffer) / 2,
      Math.max(-85, lat - (latSpan * buffer) / 2),
      lng + (lngSpan * buffer) / 2,
      Math.min(85, lat + (latSpan * buffer) / 2),
    ];
  }

  it("produces tight bounds at high zoom levels", () => {
    const bounds = getViewportBounds(47.6, -122.3, 14);
    const lngSpan = bounds[2] - bounds[0];
    const latSpan = bounds[3] - bounds[1];
    // At zoom 14, visible span should be well under 1 degree
    expect(lngSpan).toBeLessThan(0.1);
    expect(latSpan).toBeLessThan(0.05);
  });

  it("produces wide bounds at low zoom levels", () => {
    const bounds = getViewportBounds(39.8, -98.6, 3.5);
    const lngSpan = bounds[2] - bounds[0];
    // At zoom 3.5, visible span should be many degrees
    expect(lngSpan).toBeGreaterThan(30);
  });

  it("is much smaller than world bounds at city zoom", () => {
    const bounds = getViewportBounds(47.6, -122.3, 12);
    const worldArea = 360 * 170;
    const viewArea = (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]);
    // Viewport area should be tiny compared to world
    expect(viewArea / worldArea).toBeLessThan(0.001);
  });

  it("clamps latitude to valid range", () => {
    const bounds = getViewportBounds(84, 0, 2);
    expect(bounds[3]).toBeLessThanOrEqual(85);
    expect(bounds[1]).toBeGreaterThanOrEqual(-85);
  });
});
