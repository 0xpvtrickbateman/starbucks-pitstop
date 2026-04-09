"use client";

import { createClient } from "@supabase/supabase-js";

import { getPublicConfig, hasPublicSupabaseEnv } from "@/lib/config";

let singleton:
  | ReturnType<typeof createClient>
  | null = null;

export function getBrowserSupabaseClient() {
  if (!hasPublicSupabaseEnv()) {
    throw new Error("Public Supabase environment variables are not configured");
  }

  if (!singleton) {
    const env = getPublicConfig();

    singleton = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  return singleton;
}
