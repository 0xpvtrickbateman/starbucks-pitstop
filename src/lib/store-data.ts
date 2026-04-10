import type { SupabaseClient } from "@supabase/supabase-js";

import { haversineMiles, type BoundingBox } from "@/lib/map";
import type { PublicCode, PublicStore, StoreCodeSummary } from "@/types";

interface StoreRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  ownership_type: string | null;
  store_type: string | null;
  features: string[] | null;
}

interface CodeRow {
  id: string;
  store_id: string;
  code_display: string;
  is_active: boolean;
  deactivated_reason: string | null;
  upvotes: number;
  downvotes: number;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

function toPublicCode(row: CodeRow): PublicCode {
  return {
    id: row.id,
    storeId: row.store_id,
    codeDisplay: row.code_display,
    isActive: row.is_active,
    deactivatedReason: row.deactivated_reason,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    confidenceScore: row.confidence_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildCodeSummary(codes: PublicCode[]): StoreCodeSummary {
  const activeCodes = codes.filter((code) => code.isActive);
  const topCode = [...activeCodes].sort(
    (left, right) => right.confidenceScore - left.confidenceScore,
  )[0];

  return {
    activeCodeCount: activeCodes.length,
    hasCodes: activeCodes.length > 0,
    hasConflict: activeCodes.length > 1,
    topCode: topCode
      ? {
          id: topCode.id,
          codeDisplay: topCode.codeDisplay,
          confidenceScore: topCode.confidenceScore,
        }
      : null,
  };
}

export async function fetchCodesByStoreIds(
  supabase: SupabaseClient,
  storeIds: string[],
  includeInactive = true,
) {
  if (storeIds.length === 0) {
    return new Map<string, PublicCode[]>();
  }

  let query = supabase
    .from("public_code_read_model")
    .select("*")
    .in("store_id", storeIds)
    .order("is_active", { ascending: false })
    .order("confidence_score", { ascending: false })
    .order("created_at", { ascending: false });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const grouped = new Map<string, PublicCode[]>();

  for (const row of (data ?? []) as CodeRow[]) {
    const list = grouped.get(row.store_id) ?? [];
    list.push(toPublicCode(row));
    grouped.set(row.store_id, list);
  }

  return grouped;
}

function toPublicStore(
  row: StoreRow,
  codes: PublicCode[],
  distanceMiles: number | null,
): PublicStore {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    latitude: row.latitude,
    longitude: row.longitude,
    ownershipType: row.ownership_type,
    storeType: row.store_type,
    features: row.features ?? [],
    distanceMiles,
    codeSummary: buildCodeSummary(codes),
    codes,
    inactiveCodeCount: codes.filter((code) => !code.isActive).length,
  };
}

export async function fetchStoresByBoundingBox(
  supabase: SupabaseClient,
  box: BoundingBox,
  limit = 500,
  origin?: { latitude: number; longitude: number },
) {
  const { data, error } = await supabase
    .from("public_store_read_model")
    .select("*")
    .eq("is_excluded", false)
    .gte("longitude", box.west)
    .lte("longitude", box.east)
    .gte("latitude", box.south)
    .lte("latitude", box.north)
    .order("name")
    .limit(limit);

  if (error) {
    throw error;
  }

  const stores = (data ?? []) as StoreRow[];
  const codesByStore = await fetchCodesByStoreIds(
    supabase,
    stores.map((store) => store.id),
    true,
  );

  return stores.map((store) => {
    const distanceMiles = origin
      ? haversineMiles(
          origin.latitude,
          origin.longitude,
          store.latitude,
          store.longitude,
        )
      : null;

    return toPublicStore(store, codesByStore.get(store.id) ?? [], distanceMiles);
  });
}

interface NearbyStoreRow {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  ownership_type: string | null;
  store_type: string | null;
  features: string[] | null;
  distance_miles: number;
}

export async function fetchStoresByRadius(
  supabase: SupabaseClient,
  latitude: number,
  longitude: number,
  radiusMiles: number,
  limit = 100,
) {
  const radiusMeters = radiusMiles * 1609.344;

  const { data, error } = await supabase.rpc("nearby_stores", {
    p_lat: latitude,
    p_lng: longitude,
    p_radius_meters: radiusMeters,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as NearbyStoreRow[];
  const storeIds = rows.map((row) => row.id);
  const codesByStore = await fetchCodesByStoreIds(supabase, storeIds, true);

  return rows.map((row) =>
    toPublicStore(
      {
        id: row.id,
        name: row.name,
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
        latitude: row.latitude,
        longitude: row.longitude,
        ownership_type: row.ownership_type,
        store_type: row.store_type,
        features: row.features,
      },
      codesByStore.get(row.id) ?? [],
      row.distance_miles,
    ),
  );
}

export async function searchStores(
  supabase: SupabaseClient,
  query: string,
  limit = 10,
) {
  // `query` is expected to be pre-sanitized and non-degenerate — the
  // searchQuerySchema transform + refine enforces that before we ever get
  // here. The guard below is defensive only, for any future caller that
  // skips the schema: an empty pattern would match every row via `ILIKE
  // '%%'`, so we refuse it rather than silently fall through to a scan.
  if (query.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("search_stores_by_text", {
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  const stores = (data ?? []) as StoreRow[];
  const codesByStore = await fetchCodesByStoreIds(
    supabase,
    stores.map((store) => store.id),
    true,
  );

  return stores.map((store) =>
    toPublicStore(store, codesByStore.get(store.id) ?? [], null),
  );
}

export async function fetchStoreById(supabase: SupabaseClient, storeId: string) {
  const { data, error } = await supabase
    .from("public_store_read_model")
    .select("*")
    .eq("id", storeId)
    .eq("is_excluded", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const codesByStore = await fetchCodesByStoreIds(supabase, [storeId], true);

  return toPublicStore(data as StoreRow, codesByStore.get(storeId) ?? [], null);
}
