import { afterEach, describe, expect, it, vi } from "vitest";

const { mockCreateServiceRoleClient, mockIsLocalMockBackendEnabled } = vi.hoisted(
  () => ({
    mockCreateServiceRoleClient: vi.fn(),
    mockIsLocalMockBackendEnabled: vi.fn(() => false),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: mockCreateServiceRoleClient,
}));

vi.mock("@/lib/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/config")>();
  return {
    ...actual,
    isLocalMockBackendEnabled: mockIsLocalMockBackendEnabled,
  };
});

import { GET } from "@/app/api/search/route";

type RpcStoreRow = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  ownership_type: string | null;
  store_type: string | null;
  features: string[] | null;
};

function createThenableResult<T>(result: T) {
  const query = {
    select: () => query,
    in: () => query,
    order: () => query,
    eq: () => query,
    then: (
      onFulfilled?: ((value: T) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null,
    ) => Promise.resolve(result).then(onFulfilled ?? undefined, onRejected ?? undefined),
  };

  return query;
}

function makeStore(id: string, name: string, address: string, city: string, state: string, zip: string): RpcStoreRow {
  return {
    id,
    name,
    address,
    city,
    state,
    zip,
    latitude: 47.6,
    longitude: -122.3,
    ownership_type: "CO",
    store_type: null,
    features: [],
  };
}

function createSupabaseForSearchCases() {
  const rpc = vi.fn(async (_name: string, args: { p_query: string; p_limit: number }) => {
    const fixtures: Record<string, RpcStoreRow[]> = {
      "Seattle, WA": [
        makeStore("17844", "35th & Fauntleroy", "4408 Fauntleroy Way SW", "Seattle", "WA", "98126"),
        makeStore("11917", "3rd & Madison", "999 3rd Ave", "Seattle", "WA", "98104"),
      ],
      "Phoenix, AZ 85016": [
        makeStore("12010", "Camelback & 20th", "1902 E Camelback Rd", "Phoenix", "AZ", "85016"),
      ],
      Seattle: [
        makeStore("17844", "35th & Fauntleroy", "4408 Fauntleroy Way SW", "Seattle", "WA", "98126"),
      ],
      WA: [
        makeStore("11917", "3rd & Madison", "999 3rd Ave", "Seattle", "WA", "98104"),
      ],
      "85016": [
        makeStore("12010", "Camelback & 20th", "1902 E Camelback Rd", "Phoenix", "AZ", "85016"),
      ],
      "Pike Place": [
        makeStore(
          "overture:9a25bb77-4b56-467b-ac0e-343420aec78a",
          "Original Starbucks",
          "1912 Pike Pl",
          "Seattle",
          "WA",
          "98101-1013",
        ),
      ],
    };

    return {
      data: fixtures[args.p_query] ?? [],
      error: null,
    };
  });

  const from = vi.fn(() =>
    createThenableResult({
      data: [],
      error: null,
    }),
  );

  return {
    rpc,
    from,
  };
}

describe("/api/search route", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockIsLocalMockBackendEnabled.mockReturnValue(false);
  });

  it.each([
    ["Seattle, WA", "17844", "Seattle"],
    ["Phoenix, AZ 85016", "12010", "Phoenix"],
    ["Seattle", "17844", "Seattle"],
    ["WA", "11917", "Seattle"],
    ["85016", "12010", "Phoenix"],
    ["Pike Place", "overture:9a25bb77-4b56-467b-ac0e-343420aec78a", "Seattle"],
  ])(
    "returns sane first-hit data for %s",
    async (query, expectedStoreId, expectedCity) => {
      const supabase = createSupabaseForSearchCases();
      mockCreateServiceRoleClient.mockReturnValue(supabase);

      const response = await GET(
        new Request(`https://example.com/api/search?q=${encodeURIComponent(query)}`),
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, s-maxage=300, stale-while-revalidate=1800",
      );
      expect(body.stores[0].id).toBe(expectedStoreId);
      expect(body.stores[0].city).toBe(expectedCity);
      expect(supabase.rpc).toHaveBeenCalledWith("search_stores_by_text", {
        p_query: query,
        p_limit: 10,
      });
    },
  );

  it("returns a structured 400 for too-short queries", async () => {
    mockCreateServiceRoleClient.mockReturnValue(createSupabaseForSearchCases());

    const response = await GET(new Request("https://example.com/api/search?q=a"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid request");
    expect(body.details[0].message).toMatch(/too short/i);
  });
});
