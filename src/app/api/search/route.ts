import { NextResponse } from "next/server";

import { searchStores } from "@/lib/store-data";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { searchQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = searchQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const supabase = createServiceRoleClient();
    const stores = await searchStores(supabase, parsed.q, parsed.limit ?? 10);
    const response = NextResponse.json({
      stores,
    });

    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=1800",
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
