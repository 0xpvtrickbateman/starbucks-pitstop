import { createClient } from "@supabase/supabase-js";

import { getPublicConfig, getServerConfig, hasServiceRoleEnv } from "@/lib/config";

export function createServiceRoleClient() {
  if (!hasServiceRoleEnv()) {
    throw new Error("Supabase service-role environment variables are not configured");
  }

  const publicEnv = getPublicConfig();
  const serverEnv = getServerConfig();

  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
