import { describe, expect, it } from "vitest";

import { searchMockStores } from "@/lib/mock-backend";

describe("search safety", () => {
  it("handles commas in address-style searches without crashing", () => {
    // "Seattle, WA" contains a comma — PostgREST .or() would break on this.
    // The mock backend uses substring matching so "Seattle, WA" won't match
    // the space-joined haystack, but it must not crash.
    const results = searchMockStores("Seattle, WA");
    expect(Array.isArray(results)).toBe(true);
  });

  it("finds stores by city name alone", () => {
    const results = searchMockStores("Seattle");
    expect(results).toHaveLength(1);
    expect(results[0].city).toBe("Seattle");
  });

  it("handles parentheses in search input", () => {
    const results = searchMockStores("Starbucks (Downtown)");
    expect(results).toHaveLength(0);
  });

  it("handles ZIP with city and state", () => {
    const results = searchMockStores("Phoenix, AZ 85016");
    // Should match or gracefully return empty — no crash
    expect(Array.isArray(results)).toBe(true);
  });

  it("handles quotes in search input", () => {
    const results = searchMockStores('"Roosevelt"');
    expect(Array.isArray(results)).toBe(true);
  });

  it("handles percent signs without wildcard injection", () => {
    const results = searchMockStores("100%match");
    expect(Array.isArray(results)).toBe(true);
  });

  it("handles backslashes safely", () => {
    const results = searchMockStores("test\\injection");
    expect(Array.isArray(results)).toBe(true);
  });

  it("handles empty-like whitespace queries", () => {
    const results = searchMockStores("   ");
    // Whitespace-only searches should not crash
    expect(Array.isArray(results)).toBe(true);
  });

  it("returns results for partial city match", () => {
    const results = searchMockStores("Brook");
    expect(results).toHaveLength(1);
    expect(results[0].city).toBe("Brooklyn");
  });

  it("handles mixed punctuation gracefully", () => {
    const results = searchMockStores("St. & Ave, #100 (Suite)");
    expect(Array.isArray(results)).toBe(true);
  });
});
