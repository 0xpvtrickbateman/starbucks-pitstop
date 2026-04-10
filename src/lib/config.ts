import { z } from "zod";

function blankToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const optionalString = () =>
  z.preprocess(blankToUndefined, z.string().min(1).optional());

const optionalUrl = () =>
  z.preprocess(blankToUndefined, z.string().url().optional());

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString(),
  NEXT_PUBLIC_MAPBOX_TOKEN: optionalString(),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalString(),
  RATE_LIMIT_SECRET: z.preprocess(blankToUndefined, z.string().min(16).optional()),
  UPSTASH_REDIS_REST_URL: optionalUrl(),
  UPSTASH_REDIS_REST_TOKEN: optionalString(),
  OVERTURE_RELEASE: optionalString(),
  STARBUCKS_PITSTOP_LOCAL_MOCK: z.preprocess(
    blankToUndefined,
    z.enum(["0", "1"]).optional(),
  ),
});

export function getPublicConfig() {
  return publicEnvSchema.parse(process.env);
}

export function getServerConfig() {
  return serverEnvSchema.parse(process.env);
}

export function hasPublicSupabaseEnv() {
  const env = getPublicConfig();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasServiceRoleEnv() {
  const env = { ...getPublicConfig(), ...getServerConfig() };

  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function hasUpstashEnv() {
  const env = getServerConfig();

  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function isLocalMockBackendEnabled() {
  const env = getServerConfig();

  return (
    env.STARBUCKS_PITSTOP_LOCAL_MOCK === "1" ||
    (process.env.NODE_ENV !== "production" && !hasServiceRoleEnv())
  );
}
