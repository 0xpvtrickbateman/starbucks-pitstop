import type {
  SearchCandidate,
  SearchPhase,
  StoreSummary,
} from "@/components/home/types";
import { formatActiveEntrySummary } from "@/lib/restroom-entry";
import type { MapPanelMode } from "@/stores/mapStore";

export interface SearchResolution {
  phase: Extract<SearchPhase, "results" | "exact" | "empty">;
  candidates: SearchCandidate[];
  selectedStore: SearchCandidate | null;
  selectedResultId: string | null;
  panelMode: MapPanelMode;
}

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildStoreSearchValues(store: StoreSummary) {
  const cityState = `${store.city}, ${store.state}`;
  const cityStateZip = `${store.city}, ${store.state} ${store.zip}`;

  return [
    store.name,
    store.address,
    store.zip,
    store.city,
    cityState,
    cityStateZip,
    `${store.address} ${cityStateZip}`,
  ]
    .map(normalizeSearchValue)
    .filter(Boolean);
}

export function toSearchCandidate(store: StoreSummary): SearchCandidate {
  const addressLine = `${store.address}, ${store.city}, ${store.state} ${store.zip}`;
  const badge =
    store.activeCodeCount && store.activeCodeCount > 0
      ? formatActiveEntrySummary(store.activeCodeCount)
      : "No active entry yet";

  return {
    ...store,
    subtitle: addressLine,
    badge,
  };
}

export function resolveSearchCandidates(
  query: string,
  stores: StoreSummary[],
): SearchResolution {
  const candidates = stores.map(toSearchCandidate);

  if (candidates.length === 0) {
    return {
      phase: "empty",
      candidates: [],
      selectedStore: null,
      selectedResultId: null,
      panelMode: "peek",
    };
  }

  const normalizedQuery = normalizeSearchValue(query);
  const exactMatches = candidates.filter((store) =>
    buildStoreSearchValues(store).includes(normalizedQuery),
  );

  if (exactMatches.length === 1) {
    return {
      phase: "exact",
      candidates: exactMatches,
      selectedStore: exactMatches[0],
      selectedResultId: exactMatches[0].id,
      panelMode: "open",
    };
  }

  if (candidates.length === 1) {
    return {
      phase: "exact",
      candidates,
      selectedStore: candidates[0],
      selectedResultId: candidates[0].id,
      panelMode: "open",
    };
  }

  const ambiguousCandidates = exactMatches.length > 1 ? exactMatches : candidates;

  return {
    phase: "results",
    candidates: ambiguousCandidates,
    selectedStore: null,
    selectedResultId: ambiguousCandidates[0]?.id ?? null,
    panelMode: "peek",
  };
}
