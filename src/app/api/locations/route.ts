import { NextResponse } from "next/server";

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
    const supabase = createServiceRoleClient();

    let stores;
    let queryType: "bbox" | "radius";

    if (parsed.bbox) {
      const box = expandBoundingBox(parseBoundingBox(parsed.bbox));
      stores = await fetchStoresByBoundingBox(supabase, box, parsed.limit ?? 500);
      queryType = "bbox";
    } else {
      stores = await fetchStoresByRadius(
        supabase,
        parsed.lat!,
        parsed.lng!,
        parsed.radius!,
        parsed.limit ?? 100,
      );
      queryType = "radius";
    }

    const response = NextResponse.json({
      stores,
      meta: {
        source: "supabase",
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}
