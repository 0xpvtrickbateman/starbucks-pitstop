import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-errors";
import { isLocalMockBackendEnabled } from "@/lib/config";
import { searchMockStores } from "@/lib/mock-backend";
import { searchStores } from "@/lib/store-data";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { searchQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = searchQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const stores = isLocalMockBackendEnabled()
      ? searchMockStores(parsed.q, parsed.limit ?? 10)
      : await searchStores(
          createServiceRoleClient(),
          parsed.q,
          parsed.limit ?? 10,
        );
    const response = NextResponse.json({
      stores,
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=1800",
    );

    return response;
  } catch (error) {
    return apiErrorResponse(error, "search");
  }
}
