import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockLimit,
  mockSlidingWindow,
  mockRedis,
  mockCreateServiceRoleClient,
  mockIsLocalMockBackendEnabled,
} = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockSlidingWindow: vi.fn((limit: number, window: string) => ({ limit, window })),
  mockRedis: vi.fn(),
  mockCreateServiceRoleClient: vi.fn(),
  mockIsLocalMockBackendEnabled: vi.fn(() => false),
}));

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    static slidingWindow = mockSlidingWindow;

    constructor(options: unknown) {
      void options;
      return {
        limit: mockLimit,
      };
    }
  }

  return {
    Ratelimit: MockRatelimit,
  };
});

vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {
    constructor(options: unknown) {
      mockRedis(options);
      return { options };
    }
  },
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

function createSupabaseCountStub(table: string, count: number | null) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(async () => ({
      count,
      error: null,
    })),
  };

  return {
    from: vi.fn((selectedTable: string) => {
      expect(selectedTable).toBe(table);
      return query;
    }),
    query,
  };
}

function setUpstashEnv() {
  process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "upstash-token";
}

function clearUpstashEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

afterEach(() => {
  clearUpstashEnv();
  delete process.env.RATE_LIMIT_SECRET;
  vi.clearAllMocks();
  vi.resetModules();
  mockIsLocalMockBackendEnabled.mockReturnValue(false);
});

describe("enforceRateLimit", () => {
  it("uses Upstash when present and allows requests under the limit", async () => {
    setUpstashEnv();
    mockLimit.mockResolvedValue({
      success: true,
      reset: 12345,
      remaining: 2,
    });

    const { enforceRateLimit } = await import("@/lib/rate-limit");

    const result = await enforceRateLimit({
      scope: "code_submission",
      hashedDeviceId: "hashed-device",
      supabase: {} as never,
    });

    expect(result).toEqual({
      ok: true,
      reset: 12345,
      remaining: 2,
    });
    expect(mockLimit).toHaveBeenCalledWith("code_submission:hashed-device:3:3600");
    expect(mockRedis).toHaveBeenCalledWith({
      url: "https://example.upstash.io",
      token: "upstash-token",
    });
    expect(mockSlidingWindow).toHaveBeenCalledWith(3, "3600 s");
  });

  it("uses Upstash when present and returns a blocked result over the limit", async () => {
    setUpstashEnv();
    mockLimit.mockResolvedValue({
      success: false,
      reset: 54321,
      remaining: 0,
    });

    const { enforceRateLimit } = await import("@/lib/rate-limit");

    const result = await enforceRateLimit({
      scope: "code_submission",
      hashedDeviceId: "hashed-device",
      supabase: {} as never,
    });

    expect(result).toEqual({
      ok: false,
      reset: 54321,
      remaining: 0,
    });
    expect(mockLimit).toHaveBeenCalledWith("code_submission:hashed-device:3:3600");
  });

  it("falls back to the indexed Supabase path when Upstash is absent", async () => {
    clearUpstashEnv();
    const supabase = createSupabaseCountStub("votes", 5);

    const before = Date.now();
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const result = await enforceRateLimit({
      scope: "vote_submission",
      hashedDeviceId: "hashed-device",
      supabase: supabase as never,
    });
    const after = Date.now();

    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(14);
    expect(result.reset).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
    expect(result.reset).toBeLessThanOrEqual(after + 60 * 60 * 1000);
    expect(supabase.from).toHaveBeenCalledWith("votes");
    expect(supabase.query.select).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
    expect(supabase.query.eq).toHaveBeenCalledWith("voter_hash", "hashed-device");
    expect(supabase.query.gte).toHaveBeenCalledOnce();
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

describe("/api/codes rate-limit contract", () => {
  it("returns a 429 response when the live rate-limit helper rejects the submission", async () => {
    setUpstashEnv();
    process.env.RATE_LIMIT_SECRET = "test-rate-limit-secret-1234";
    mockLimit.mockResolvedValue({
      success: false,
      reset: 54321,
      remaining: 0,
    });
    mockCreateServiceRoleClient.mockReturnValue({});

    const { POST } = await import("@/app/api/codes/route");
    const response = await POST(
      new Request("https://example.com/api/codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          storeId: "11917",
          code: "1234",
          deviceId: "4e4a8bf7-3fb3-4bba-8940-a6d86798965e",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe(
      "Submission rate limit exceeded. Please wait before posting again.",
    );
  });
});
