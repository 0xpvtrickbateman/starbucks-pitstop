import { beforeEach, describe, expect, it } from "vitest";

import {
  fetchMockStoreById,
  hashLocalMockDeviceId,
  resetLocalMockState,
  searchMockStores,
  submitMockCode,
  submitMockVote,
} from "@/lib/mock-backend";

describe("mock backend", () => {
  beforeEach(() => {
    resetLocalMockState();
  });

  it("searches the seeded stores", () => {
    const results = searchMockStores("Roosevelt");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "store-roosevelt-seattle",
      city: "Seattle",
      state: "WA",
    });
  });

  it("supports submitting and voting on a code", () => {
    const submitted = submitMockCode({
      storeId: "store-camelback-phoenix",
      codeDisplay: "4839",
      codeNormalized: "4839",
    });
    const newCode = submitted.codes.find((code) => code.codeDisplay === "4839");

    expect(submitted.existing).toBe(false);
    expect(newCode).toBeTruthy();

    const voted = submitMockVote({
      codeId: newCode!.id,
      voteType: "up",
      voterHash: hashLocalMockDeviceId("4e4a8bf7-3fb3-4bba-8940-a6d86798965e"),
    });
    const votedCode = voted.codes.find((code) => code.id === newCode!.id);

    expect(votedCode).toMatchObject({
      upvotes: 1,
      downvotes: 0,
      isActive: true,
    });

    expect(() =>
      submitMockVote({
        codeId: newCode!.id,
        voteType: "up",
        voterHash: hashLocalMockDeviceId("4e4a8bf7-3fb3-4bba-8940-a6d86798965e"),
      }),
    ).toThrow(/duplicate_vote/);

    expect(fetchMockStoreById("store-camelback-phoenix")?.codes).toHaveLength(1);
  });

  it("supports submitting a no-code-required entry", () => {
    const submitted = submitMockCode({
      storeId: "store-camelback-phoenix",
      codeDisplay: "No Code Required",
      codeNormalized: "NOCODEREQUIRED",
    });

    expect(submitted.existing).toBe(false);
    expect(submitted.codes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codeDisplay: "No Code Required",
          isActive: true,
        }),
      ]),
    );
  });
});
