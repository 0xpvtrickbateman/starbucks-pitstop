import type {
  StarbucksLocationResult,
  StarbucksStore,
  StoreClassification,
  StoreExclusionReason,
  StoreType,
  SyncStoreRecord,
} from "@/types";

const STARBUCKS_LOCATIONS_ENDPOINT =
  "https://www.starbucks.com/apiproxy/v1/locations";

const STARBUCKS_REQUEST_HEADERS = {
  accept: "application/json",
  "x-requested-with": "XMLHttpRequest",
} as const;

export const LICENSED_ENVIRONMENT_REASON_MAP: Record<
  string,
  StoreExclusionReason
> = {
  ALBERTSN: "grocery",
  ARAFOOD: "campus",
  AREASUSA: "airport",
  BANGELGR: "hotel",
  COMPUSA: "campus",
  DIGNITY: "hospital",
  HOST: "airport",
  KROGERCO: "grocery",
  "MAR-INTL": "hotel",
  PROVIHEA: "hospital",
  TARGCO: "grocery",
  TERMINAL: "airport",
  UOFWASHI: "campus",
};

export const AIRPORT_PATTERNS = [
  /\bairport\b/i,
  /\bterminal\b/i,
  /\bconcourse\b/i,
  /\bgate\b/i,
  /\bpre[\s-]?security\b/i,
  /\bbag(?:gage)? claim\b/i,
];

export const GROCERY_PATTERNS = [
  /\btarget\b/i,
  /\bsafeway\b/i,
  /\bkroger\b/i,
  /\bfry'?s\b/i,
  /\bqfc\b/i,
  /\bfred meyer\b/i,
  /\balbertsons?\b/i,
  /\bstar market\b/i,
];

export const HOTEL_PATTERNS = [
  /\bhotel\b/i,
  /\bmarriott\b/i,
  /\bsheraton\b/i,
  /\bwestin\b/i,
  /\bhyatt\b/i,
  /\bhilton\b/i,
  /\brenaissance\b/i,
  /\bresort\b/i,
];

export const HEALTHCARE_PATTERNS = [
  /\bhospital\b/i,
  /\bmedical\b/i,
  /\bclinic\b/i,
  /\bhealth\b/i,
  /\bpatient\b/i,
  /\bst\.?\s*joseph/i,
  /\bsecure access\b/i,
];

export const CAMPUS_PATTERNS = [
  /\bcampus\b/i,
  /\bcollege\b/i,
  /\buniversity\b/i,
  /\bstudent center\b/i,
  /\blibrary\b/i,
  /\basu\b/i,
];

export const STADIUM_PATTERNS = [
  /\bstadium\b/i,
  /\barena\b/i,
  /\bballpark\b/i,
  /\bfield\b/i,
  /\bcoliseum\b/i,
];

export const PICKUP_ONLY_PATTERNS = [
  /\bpickup\b/i,
  /\bgrab[\s-]?&?[\s-]?go\b/i,
];

export const EMBEDDED_LOCATION_PATTERNS = [
  /\bbuilding\b/i,
  /\btower\b/i,
  /\bplaza\b/i,
  /\bsuite\b/i,
  /\bste\b/i,
  /\bfloor\b/i,
  /\blevel\b/i,
  /\bcenter\b/i,
  /\bcentre\b/i,
  /\blobby\b/i,
  /\bfinancial\b/i,
  /\binternational place\b/i,
  /\bbank\b/i,
  /\bbarracks\b/i,
  /\bfort\b/i,
  /\bmilitary\b/i,
  /\bnaval\b/i,
  /\bmarine corps\b/i,
  /\bair force\b/i,
  /\barmy\b/i,
  /\bbase\b/i,
];

interface FetchOptions {
  retries?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface ObservedStoreSourcePayload {
  observedCount: number;
  minObservedDistance: number;
  lastLocationResult: StarbucksLocationResult;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStore(value: unknown): value is StarbucksStore {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isObject(value.address) &&
    isObject(value.coordinates)
  );
}

function isLocationResult(value: unknown): value is StarbucksLocationResult {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.distance === "number" && isStore(value.store);
}

async function fetchJson<T>(
  url: URL,
  options: FetchOptions = {},
): Promise<T> {
  const { retries = 3, timeoutMs = 12_000, signal } = options;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const signals = [controller.signal, signal].filter(Boolean) as AbortSignal[];

    try {
      const response = await fetch(url, {
        headers: STARBUCKS_REQUEST_HEADERS,
        signal:
          signals.length === 2
            ? AbortSignal.any(signals)
            : signals[0] ?? controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Starbucks API returned ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      await sleep(attempt * 350);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Starbucks API request exhausted retries");
}

export function buildLocationsUrl(
  params:
    | {
        lat: number;
        lng: number;
      }
    | {
        place: string;
      },
) {
  const url = new URL(STARBUCKS_LOCATIONS_ENDPOINT);

  if ("place" in params) {
    url.searchParams.set("place", params.place);
  } else {
    url.searchParams.set("lat", params.lat.toString());
    url.searchParams.set("lng", params.lng.toString());
  }

  return url;
}

export async function fetchLocationsByCoordinates(
  lat: number,
  lng: number,
  options?: FetchOptions,
) {
  const payload = await fetchJson<unknown>(buildLocationsUrl({ lat, lng }), options);

  if (!Array.isArray(payload) || !payload.every(isLocationResult)) {
    throw new Error("Unexpected Starbucks locations payload for coordinate lookup");
  }

  return payload;
}

export async function fetchLocationsByPlace(
  place: string,
  options?: FetchOptions,
) {
  const payload = await fetchJson<unknown>(buildLocationsUrl({ place }), options);

  if (Array.isArray(payload) && payload.every(isLocationResult)) {
    return payload;
  }

  if (isObject(payload) && payload.placeNameNotFound === true) {
    return [];
  }

  throw new Error("Unexpected Starbucks locations payload for place lookup");
}

function compactStrings(values: Array<string | null | undefined>) {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function storeSearchText(store: StarbucksStore) {
  return compactStrings([
    store.name,
    store.slug,
    store.address.streetAddressLine1,
    store.address.streetAddressLine2,
    store.address.streetAddressLine3,
    store.address.singleLine,
    store.marketBusinessUnitCode,
  ]).join(" ");
}

export function matchesAnyPattern(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

export function getFeatureNames(store: StarbucksStore) {
  const amenityNames = store.amenities.map((item) => item.name);
  const pickupNames = store.pickUpOptions.map((item) => item.name);
  const internalFeatureNames = store.internalFeatures.map((item) => item.name);

  if (store.mobileOrdering?.guestOrdering) {
    internalFeatureNames.push("Guest Ordering");
  }

  return uniqueSorted([...amenityNames, ...pickupNames, ...internalFeatureNames]);
}

function hasAmenity(store: StarbucksStore, matcher: RegExp) {
  return store.amenities.some((amenity) => matcher.test(amenity.name));
}

function hasPickupOption(store: StarbucksStore, matcher: RegExp) {
  return store.pickUpOptions.some((option) => matcher.test(option.name));
}

function detectLicensedReason(store: StarbucksStore): StoreExclusionReason {
  if (store.marketBusinessUnitCode) {
    const mappedReason = LICENSED_ENVIRONMENT_REASON_MAP[store.marketBusinessUnitCode];

    if (mappedReason) {
      return mappedReason;
    }
  }

  const text = storeSearchText(store);

  if (matchesAnyPattern(text, AIRPORT_PATTERNS)) {
    return "airport";
  }

  if (matchesAnyPattern(text, GROCERY_PATTERNS)) {
    return "grocery";
  }

  if (matchesAnyPattern(text, HOTEL_PATTERNS)) {
    return "hotel";
  }

  if (matchesAnyPattern(text, HEALTHCARE_PATTERNS)) {
    return "hospital";
  }

  if (matchesAnyPattern(text, CAMPUS_PATTERNS)) {
    return "campus";
  }

  if (matchesAnyPattern(text, STADIUM_PATTERNS)) {
    return "stadium";
  }

  return "licensed";
}

export function classifyStore(store: StarbucksStore): StoreClassification {
  const notes: string[] = [];
  const featureNames = getFeatureNames(store);
  const text = storeSearchText(store);

  const isCompanyOperated = store.ownershipTypeCode === "CO";
  const hasDriveThru =
    hasAmenity(store, /\bdrive[-\s]?thru\b/i) ||
    hasPickupOption(store, /\bdrive[-\s]?thru\b/i);
  const hasCafeSeating = hasAmenity(store, /\bcaf[eé]\s+seating\b/i);
  const hasOutdoorSeating = hasAmenity(store, /\boutdoor seating\b/i);
  const hasWifi =
    hasAmenity(store, /\bstarbucks wi-fi\b/i) ||
    hasAmenity(store, /\bwireless hot-spot\b/i);
  const hasStrongRetailSignal =
    hasDriveThru || hasCafeSeating || hasOutdoorSeating || hasWifi;

  if (!isCompanyOperated) {
    const exclusionReason = detectLicensedReason(store);

    notes.push(
      `Excluded non-company-operated location (${store.ownershipTypeCode ?? "unknown"}).`,
    );

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason,
      storeType: "unknown",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, PICKUP_ONLY_PATTERNS)) {
    notes.push("Excluded pickup-only or small-format location.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "pickup-only",
      storeType: "urban-inline",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, AIRPORT_PATTERNS)) {
    notes.push("Excluded airport-adjacent location.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "airport",
      storeType: "unknown",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, GROCERY_PATTERNS)) {
    notes.push("Excluded grocery or big-box embedded location.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "grocery",
      storeType: "unknown",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, HOTEL_PATTERNS)) {
    notes.push("Excluded hotel-embedded location.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "hotel",
      storeType: "unknown",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, HEALTHCARE_PATTERNS)) {
    notes.push("Excluded healthcare or secure-access location.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "hospital",
      storeType: "unknown",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, CAMPUS_PATTERNS)) {
    notes.push("Excluded campus or institutional location.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "campus",
      storeType: "unknown",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, STADIUM_PATTERNS)) {
    notes.push("Excluded stadium or event-venue location.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "stadium",
      storeType: "unknown",
      featureNames,
      notes,
    };
  }

  if (matchesAnyPattern(text, EMBEDDED_LOCATION_PATTERNS) && !hasDriveThru) {
    notes.push(
      "Excluded embedded building/office/retail-center location without drive-thru support.",
    );

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "embedded-office",
      storeType: hasCafeSeating || hasOutdoorSeating ? "cafe" : "urban-inline",
      featureNames,
      notes,
    };
  }

  if (!hasStrongRetailSignal) {
    notes.push("Excluded ambiguous company-operated format with weak public-retail signals.");

    return {
      isCompanyOperated,
      isExcluded: true,
      exclusionReason: "ambiguous-format",
      storeType: "urban-inline",
      featureNames,
      notes,
    };
  }

  const storeType: StoreType = hasDriveThru ? "drive-thru" : "cafe";
  notes.push(
    hasDriveThru
      ? "Included company-operated drive-thru candidate."
      : "Included company-operated cafe-style candidate with public-retail signals.",
  );

  return {
    isCompanyOperated,
    isExcluded: false,
    exclusionReason: null,
    storeType,
    featureNames,
    notes,
  };
}

export function toSyncStoreRecord(
  store: StarbucksStore,
  classification: StoreClassification,
  sourcePayload: ObservedStoreSourcePayload,
  lastSyncedAt: string,
): SyncStoreRecord {
  const address = compactStrings([
    store.address.streetAddressLine1,
    store.address.streetAddressLine2,
    store.address.streetAddressLine3,
    [store.address.city, store.address.countrySubdivisionCode, store.address.postalCode]
      .filter(Boolean)
      .join(", "),
  ]).join(", ");

  const latitude = store.coordinates.latitude;
  const longitude = store.coordinates.longitude;

  if (latitude === null || longitude === null) {
    throw new Error(`Store ${store.id} is missing coordinates`);
  }

  return {
    id: store.id,
    name: store.name,
    street1: address || store.address.singleLine || "Unknown address",
    city: store.address.city || "Unknown city",
    state: store.address.countrySubdivisionCode || "Unknown state",
    zip: store.address.postalCode || "00000",
    latitude,
    longitude,
    ownership_type: store.ownershipTypeCode,
    store_type: classification.storeType,
    features: classification.featureNames,
    is_company_operated: classification.isCompanyOperated,
    is_excluded: classification.isExcluded,
    exclusion_reason: classification.exclusionReason,
    source_payload: {
      observedCount: sourcePayload.observedCount,
      minObservedDistance: sourcePayload.minObservedDistance,
      store,
      lastLocationResult: sourcePayload.lastLocationResult,
      classificationNotes: classification.notes,
    },
    last_synced_at: lastSyncedAt,
  };
}
