import { afterEach, describe, expect, it, vi } from "vitest";

const { mockCreateServiceRoleClient, mockIsLocalMockBackendEnabled, mockFetchStoreById } =
  vi.hoisted(() => ({
    mockCreateServiceRoleClient: vi.fn(),
    mockIsLocalMockBackendEnabled: vi.fn(() => false),
    mockFetchStoreById: vi.fn(),
  }));

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

vi.mock("@/lib/store-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store-data")>();
  return {
    ...actual,
    fetchStoreById: mockFetchStoreById,
  };
});

import { generateMetadata } from "@/app/location/[id]/page";

describe("location page metadata", () => {
  afterEach(() => {
    vi.clearAllMocks();
    mockIsLocalMockBackendEnabled.mockReturnValue(false);
  });

  it("returns a store title without duplicating the site suffix", async () => {
    mockCreateServiceRoleClient.mockReturnValue({});
    mockFetchStoreById.mockResolvedValue({
      id: "17844",
      name: "35th & Fauntleroy",
      city: "Seattle",
      state: "WA",
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "17844" }),
    });

    expect(metadata.title).toBe("35th & Fauntleroy restroom entries");
  });
});
