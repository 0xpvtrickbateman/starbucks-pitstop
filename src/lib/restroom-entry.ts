export type RestroomEntryType = "code" | "no-code-required";

export const NO_CODE_REQUIRED_DISPLAY = "No Code Required";
export const NO_CODE_REQUIRED_NORMALIZED = "NOCODEREQUIRED";

export function getRestroomEntryType(display: string): RestroomEntryType {
  return display.trim().toLowerCase() === NO_CODE_REQUIRED_DISPLAY.toLowerCase()
    ? "no-code-required"
    : "code";
}

export function isNoCodeRequiredEntry(display: string) {
  return getRestroomEntryType(display) === "no-code-required";
}

export function formatActiveEntryCount(count: number) {
  return `${count} active entr${count === 1 ? "y" : "ies"}`;
}

export function formatActiveEntrySummary(count: number) {
  return count > 0 ? formatActiveEntryCount(count) : "No active entry yet";
}

export function formatActiveRestroomEntrySummary(count: number) {
  return count > 0
    ? `${count} active restroom entr${count === 1 ? "y" : "ies"}`
    : "no active restroom entry yet";
}
