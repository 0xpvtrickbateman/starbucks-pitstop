import { NextResponse } from "next/server";

import { apiErrorResponse } from "@/lib/api-errors";
import { isLocalMockBackendEnabled } from "@/lib/config";
import {
  fetchMockStoresByBoundingBox,
  fetchMockStoresByRadius,
} from "@/lib/mock-backend";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { expandBoundingBox, parseBoundingBox } from "@/lib/map";
import { fetchStoresByBoundingBox, fetchStoresByRadius } from "@/lib/store-data";
import { locationsQuerySchema } from "@/lib/validators";
import type { LocationsResponse } from "@/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = locationsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    let stores;
    let queryType: "bbox" | "radius";
    let source: "supabase" | "mock-local" = "supabase";

    if (parsed.bbox) {
      const box = expandBoundingBox(parseBoundingBox(parsed.bbox));
      if (isLocalMockBackendEnabled()) {
        stores = fetchMockStoresByBoundingBox(box, parsed.limit ?? 500);
        source = "mock-local";
      } else {
        const supabase = createServiceRoleClient();
        stores = await fetchStoresByBoundingBox(supabase, box, parsed.limit ?? 500);
      }
      queryType = "bbox";
    } else {
      if (isLocalMockBackendEnabled()) {
        stores = fetchMockStoresByRadius(
          parsed.lat!,
          parsed.lng!,
          parsed.radius!,
          parsed.limit ?? 100,
        );
        source = "mock-local";
      } else {
        const supabase = createServiceRoleClient();
        stores = await fetchStoresByRadius(
          supabase,
          parsed.lat!,
          parsed.lng!,
          parsed.radius!,
          parsed.limit ?? 100,
        );
      }
      queryType = "radius";
    }

    const response = NextResponse.json({
      stores,
      meta: {
        source,
        queryType,
        count: stores.length,
      },
    } satisfies LocationsResponse);

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );

    return response;
  } catch (error) {
    return apiErrorResponse(error, "locations");
  }
}
