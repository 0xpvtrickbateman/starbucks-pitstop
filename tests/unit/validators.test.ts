import { describe, expect, it } from "vitest";

import {
  codeSubmissionSchema,
  locationsQuerySchema,
  voteSubmissionSchema,
} from "@/lib/validators";

describe("locationsQuerySchema", () => {
  it("accepts bbox queries", () => {
    expect(
      locationsQuerySchema.parse({
        bbox: "-123,37,-121,38",
      }),
    ).toMatchObject({
      bbox: "-123,37,-121,38",
    });
  });

  it("accepts radius queries", () => {
    expect(
      locationsQuerySchema.parse({
        lat: "37.77",
        lng: "-122.4",
        radius: "5",
      }),
    ).toMatchObject({
      lat: 37.77,
      lng: -122.4,
      radius: 5,
    });
  });
});

describe("codeSubmissionSchema", () => {
  it("rejects malformed device ids", () => {
    expect(() =>
      codeSubmissionSchema.parse({
        storeId: "123",
        code: "1234",
        deviceId: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("accepts explicit no-code-required submissions without a keypad code", () => {
    expect(
      codeSubmissionSchema.parse({
        storeId: "123",
        entryType: "no-code-required",
        deviceId: "4e4a8bf7-3fb3-4bba-8940-a6d86798965e",
      }),
    ).toMatchObject({
      entryType: "no-code-required",
    });
  });
});

describe("voteSubmissionSchema", () => {
  it("accepts valid votes", () => {
    expect(
      voteSubmissionSchema.parse({
        codeId: "4e4a8bf7-3fb3-4bba-8940-a6d86798965e",
        voteType: "up",
        deviceId: "4e4a8bf7-3fb3-4bba-8940-a6d86798965e",
      }),
    ).toMatchObject({
      voteType: "up",
    });
  });
});
