export type StoreCodeHealth = "empty" | "mixed" | "confident";

export interface ReportedCodeSummary {
  id: string;
  display: string;
  normalized: string;
  upvotes: number;
  downvotes: number;
  confidenceScore: number;
  isActive: boolean;
  isTop?: boolean;
}

export interface StoreSummary {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  distanceMiles?: number | null;
  hoursLabel?: string | null;
  isOpen?: boolean | null;
  ownershipType?: string | null;
  storeType?: string | null;
  featureNames?: string[];
  activeCodeCount?: number;
  codeHealth?: StoreCodeHealth;
}

export interface StoreDetailData extends StoreSummary {
  codes: ReportedCodeSummary[];
  inactiveCodeCount?: number;
  lastUpdatedLabel?: string | null;
}
