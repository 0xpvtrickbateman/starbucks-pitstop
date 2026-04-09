import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().min(1).optional(),
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RATE_LIMIT_SECRET: z.string().min(16).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  OVERTURE_RELEASE: z.string().min(1).optional(),
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
