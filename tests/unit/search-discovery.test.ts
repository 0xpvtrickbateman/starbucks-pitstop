import { describe, expect, it } from "vitest";
import { resolveSearchCandidates } from "@/lib/search-discovery";

const stores = [
  {
    id: "seattle-1",
    name: "35th & Fauntleroy",
    address: "4408 Fauntleroy Way SW",
    city: "Seattle",
    state: "WA",
    zip: "98126",
    latitude: 47.5386,
    longitude: -122.3878,
    activeCodeCount: 0,
  },
  {
    id: "seattle-2",
    name: "3rd & Madison",
    address: "999 3rd Ave",
    city: "Seattle",
    state: "WA",
    zip: "98104",
    latitude: 47.6041,
    longitude: -122.3338,
    activeCodeCount: 2,
  },
] as const;

describe("resolveSearchCandidates", () => {
  it("auto-selects a single exact store match", () => {
    const resolution = resolveSearchCandidates("4408 Fauntleroy Way SW", [
      stores[0],
    ]);

    expect(resolution.phase).toBe("exact");
    expect(resolution.selectedStore?.id).toBe("seattle-1");
    expect(resolution.panelMode).toBe("open");
  });

  it("returns an ambiguous result list when multiple stores can match", () => {
    const resolution = resolveSearchCandidates("Seattle", stores as never);

    expect(resolution.phase).toBe("results");
    expect(resolution.selectedStore).toBeNull();
    expect(resolution.candidates).toHaveLength(2);
    expect(resolution.panelMode).toBe("peek");
  });

  it("keeps empty searches in a peekable non-selected state", () => {
    const resolution = resolveSearchCandidates("Pike Place", []);

    expect(resolution.phase).toBe("empty");
    expect(resolution.selectedStore).toBeNull();
    expect(resolution.panelMode).toBe("peek");
  });
});
