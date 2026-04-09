export interface StarbucksAmenity {
  code: string;
  name: string;
}

export interface StarbucksPickupOption {
  code: string;
  name: string;
  available: boolean;
}

export interface StarbucksInternalFeature {
  code: string;
  name: string;
}

export interface StarbucksAddress {
  lines: string[];
  singleLine: string | null;
  streetAddressLine1: string | null;
  streetAddressLine2: string | null;
  streetAddressLine3: string | null;
  city: string | null;
  countrySubdivisionCode: string | null;
  countryCode: string | null;
  postalCode: string | null;
}

export interface StarbucksCoordinates {
  latitude: number | null;
  longitude: number | null;
}

export interface StarbucksScheduleDay {
  dayFormatted: string;
  dayOfWeek: string;
  hoursFormatted: string;
  holidayFormatted: string;
  open: boolean;
}

export interface StarbucksMobileOrdering {
  availability: string | null;
  guestOrdering: boolean | null;
  stallQuantity: number | null;
}

export interface StarbucksWarningLabel {
  code: string;
  label: string;
}

export interface StarbucksStore {
  id: string;
  storeNumber: string | null;
  name: string;
  ownershipTypeCode: string | null;
  phoneNumber: string | null;
  open: boolean | null;
  closingSoon: boolean | null;
  isOpen24Hours: boolean | null;
  openStatusFormatted: string | null;
  hoursStatusFormatted: string | null;
  address: StarbucksAddress;
  schedule: StarbucksScheduleDay[];
  amenities: StarbucksAmenity[];
  pickUpOptions: StarbucksPickupOption[];
  coordinates: StarbucksCoordinates;
  mobileOrdering: StarbucksMobileOrdering | null;
  regulations: unknown[];
  acceptsNonSvcMop: boolean | null;
  acceptedCampusCardIssuers: unknown[] | null;
  warningLabels: StarbucksWarningLabel[];
  slug: string | null;
  timeZone: string | null;
  internalFeatures: StarbucksInternalFeature[];
  marketBusinessUnitCode: string | null;
}

export interface StarbucksLocationResult {
  distance: number;
  isFavorite: boolean;
  isNearby: boolean;
  isPrevious: boolean;
  recommendationReason: string | null;
  store: StarbucksStore;
}

export type StoreExclusionReason =
  | "licensed"
  | "airport"
  | "grocery"
  | "hotel"
  | "hospital"
  | "campus"
  | "stadium"
  | "pickup-only"
  | "embedded-office"
  | "ambiguous-format";

export type StoreType =
  | "drive-thru"
  | "cafe"
  | "urban-inline"
  | "unknown";

export interface StoreClassification {
  isCompanyOperated: boolean;
  isExcluded: boolean;
  exclusionReason: StoreExclusionReason | null;
  storeType: StoreType;
  featureNames: string[];
  notes: string[];
}

export interface SyncStoreRecord {
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
  features: string[];
  is_company_operated: boolean | null;
  is_excluded: boolean;
  exclusion_reason: string | null;
  source_payload: Record<string, unknown>;
  last_synced_at: string;
}

export interface PublicCode {
  id: string;
  storeId: string;
  codeDisplay: string;
  isActive: boolean;
  deactivatedReason: string | null;
  upvotes: number;
  downvotes: number;
  confidenceScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCodeSummary {
  activeCodeCount: number;
  hasCodes: boolean;
  hasConflict: boolean;
  topCode: Pick<PublicCode, "id" | "codeDisplay" | "confidenceScore"> | null;
}

export interface PublicStore {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  ownershipType: string | null;
  storeType: string | null;
  features: string[];
  distanceMiles: number | null;
  codeSummary: StoreCodeSummary;
  codes: PublicCode[];
  inactiveCodeCount: number;
}

export interface LocationsResponse {
  stores: PublicStore[];
  meta: {
    source: "supabase";
    queryType: "bbox" | "radius";
    count: number;
  };
}

export interface CodesResponse {
  codes: PublicCode[];
  existing: boolean;
}

export interface VoteResponse {
  codes: PublicCode[];
}
