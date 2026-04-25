import { describe, expect, it } from "vitest";

import { normalizeCodeInput } from "@/lib/crypto";

describe("normalizeCodeInput", () => {
  it("uppercases and strips whitespace for dedupe", () => {
    expect(normalizeCodeInput(" 12 a-3 ")).toEqual({
      display: "12A3",
      normalized: "12A3",
    });
  });

  it("preserves # while removing other punctuation", () => {
    expect(normalizeCodeInput("A#1@2!")).toEqual({
      display: "A#12",
      normalized: "A#12",
    });
  });

  it("returns the no-code sentinel for no-code-required entries", () => {
    expect(normalizeCodeInput("anything here", "no-code-required")).toEqual({
      display: "No Code Required",
      normalized: "NOCODEREQUIRED",
    });
  });
});
