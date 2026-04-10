import { describe, expect, it } from "vitest";

import { sanitizeSearchQuery, searchQuerySchema } from "@/lib/validators";

function parseResult(input: string) {
  return searchQuerySchema.safeParse({ q: input });
}

describe("searchQuerySchema", () => {
  describe("rejects degenerate input that would become empty after sanitization", () => {
    const degenerate = [
      "__",
      "%%",
      "%_%",
      "\\\\",
      "   ",
      "*",
      "%_\\",
      "_",
      "%",
      "",
    ];

    for (const input of degenerate) {
      it(`rejects ${JSON.stringify(input)}`, () => {
        const result = parseResult(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toMatch(
            /short or contains only special characters/i,
          );
        }
      });
    }
  });

  describe("accepts legitimate short queries", () => {
    const valid: Array<[string, string]> = [
      ["LA", "LA"],
      ["TX", "TX"],
      ["SFO", "SFO"],
      ["  Seattle  ", "Seattle"],
      ["Seattle, WA", "Seattle, WA"],
      // wildcards intermixed with real text get stripped, leaving enough chars
      ["Se%attle", "Seattle"],
      ["100% match", "100 match"],
      ["Phoenix, AZ 85016", "Phoenix, AZ 85016"],
    ];

    for (const [input, expected] of valid) {
      it(`accepts ${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
        const result = parseResult(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.q).toBe(expected);
        }
      });
    }
  });

  it("caps raw input length before sanitization", () => {
    const result = parseResult("x".repeat(200));
    expect(result.success).toBe(false);
  });

  it("sanitizeSearchQuery is idempotent", () => {
    const input = "  %Seat__tle%  \\";
    const first = sanitizeSearchQuery(input);
    const second = sanitizeSearchQuery(first);
    expect(second).toBe(first);
  });
});
