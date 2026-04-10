import { beforeEach, describe, expect, it } from "vitest";

import {
  fetchMockStoresByBoundingBox,
  fetchMockStoresByRadius,
  resetLocalMockState,
} from "@/lib/mock-backend";

describe("store query behavior", () => {
  beforeEach(() => {
    resetLocalMockState();
  });

  describe("bounding box queries", () => {
    it("returns stores within the given bounding box", () => {
      const results = fetchMockStoresByBoundingBox({
        west: -123,
        south: 47,
        east: -122,
        north: 48,
      });
      expect(results).toHaveLength(1);
      expect(results[0].city).toBe("Seattle");
    });

    it("returns empty for a box with no stores", () => {
      const results = fetchMockStoresByBoundingBox({
        west: 0,
        south: 0,
        east: 1,
        north: 1,
      });
      expect(results).toHaveLength(0);
    });

    it("respects the limit parameter", () => {
      // Use a large bbox that covers all mock stores
      const results = fetchMockStoresByBoundingBox(
        { west: -180, south: -85, east: 180, north: 85 },
        2,
      );
      expect(results).toHaveLength(2);
    });
  });

  describe("radius queries", () => {
    it("returns stores sorted by distance", () => {
      // Query near Seattle — only Roosevelt should be within 5 miles
      const results = fetchMockStoresByRadius(47.66, -122.32, 5);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].city).toBe("Seattle");
      expect(results[0].distanceMiles).toBeLessThan(5);
    });

    it("returns results in ascending distance order", () => {
      // Wide radius covering multiple cities
      const results = fetchMockStoresByRadius(39.0, -98.0, 2000);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distanceMiles).toBeGreaterThanOrEqual(
          results[i - 1].distanceMiles!,
        );
      }
    });

    it("excludes stores outside the radius", () => {
      // Tiny radius near Seattle — should not include Austin, Phoenix, Brooklyn
      const results = fetchMockStoresByRadius(47.66, -122.32, 1);
      for (const store of results) {
        expect(store.distanceMiles).toBeLessThanOrEqual(1);
      }
    });

    it("respects the limit for radius queries", () => {
      const results = fetchMockStoresByRadius(39.0, -98.0, 2000, 2);
      expect(results).toHaveLength(2);
    });
  });
});
