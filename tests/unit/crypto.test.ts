import { describe, expect, it } from "vitest";

import { normalizeCodeInput } from "@/lib/crypto";

describe("normalizeCodeInput", () => {
  it("uppercases and strips whitespace for dedupe", () => {
    expect(normalizeCodeInput(" 12 a-3 ")).toEqual({
      display: "12A3",
      normalized: "12A3",
    });
  });

  it("removes non-alphanumeric characters", () => {
    expect(normalizeCodeInput("A#1@2!")).toEqual({
      display: "A12",
      normalized: "A12",
    });
  });
});
