import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getServerConfig, hasUpstashEnv } from "@/lib/config";

type RateLimitScope = "code_submission" | "vote_submission";

const RATE_LIMIT_RULES: Record<
  RateLimitScope,
  {
    limit: number;
    windowSeconds: number;
  }
> = {
  code_submission: {
    limit: 3,
    windowSeconds: 60 * 60,
  },
  vote_submission: {
    limit: 20,
    windowSeconds: 60 * 60,
  },
};

const ratelimitByScope = new Map<RateLimitScope, Ratelimit>();

function getRatelimit(scope: RateLimitScope) {
  if (!hasUpstashEnv()) {
    return null;
  }

  const existing = ratelimitByScope.get(scope);

  if (existing) {
    return existing;
  }

  const rule = RATE_LIMIT_RULES[scope];
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = getServerConfig();
  const ratelimit = new Ratelimit({
    redis: new Redis({
      url: UPSTASH_REDIS_REST_URL!,
      token: UPSTASH_REDIS_REST_TOKEN!,
    }),
    limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSeconds} s`),
    analytics: true,
  });

  ratelimitByScope.set(scope, ratelimit);

  return ratelimit;
}

export async function enforceRateLimit(options: {
  scope: RateLimitScope;
  hashedDeviceId: string;
  supabase: SupabaseClient;
}) {
  const rule = RATE_LIMIT_RULES[options.scope];
  const ratelimit = getRatelimit(options.scope);

  if (ratelimit) {
    const result = await ratelimit.limit(
      `${options.scope}:${options.hashedDeviceId}:${rule.limit}:${rule.windowSeconds}`,
    );

    return {
      ok: result.success,
      reset: result.reset,
      remaining: result.remaining,
    };
  }

  const sinceIso = new Date(Date.now() - rule.windowSeconds * 1000).toISOString();

  if (options.scope === "code_submission") {
    const { count, error } = await options.supabase
      .from("codes")
      .select("*", { count: "exact", head: true })
      .eq("submitted_by_hash", options.hashedDeviceId)
      .gte("created_at", sinceIso);

    if (error) {
      throw error;
    }

    const used = count ?? 0;

    return {
      ok: used < rule.limit,
      reset: Date.now() + rule.windowSeconds * 1000,
      remaining: Math.max(rule.limit - used - 1, 0),
    };
  }

  const { count, error } = await options.supabase
    .from("votes")
    .select("*", { count: "exact", head: true })
    .eq("voter_hash", options.hashedDeviceId)
    .gte("created_at", sinceIso);

  if (error) {
    throw error;
  }

  const used = count ?? 0;

  return {
    ok: used < rule.limit,
    reset: Date.now() + rule.windowSeconds * 1000,
    remaining: Math.max(rule.limit - used - 1, 0),
  };
}
