import { describe, expect, it } from "vitest";

import { calculateWilsonScore, shouldDeactivateCompetingCodes } from "@/lib/scoring";

describe("calculateWilsonScore", () => {
  it("returns 0 when there are no votes", () => {
    expect(calculateWilsonScore(0, 0)).toBe(0);
  });

  it("rewards stronger vote distributions", () => {
    expect(calculateWilsonScore(18, 2)).toBeGreaterThan(
      calculateWilsonScore(8, 2),
    );
  });
});

describe("shouldDeactivateCompetingCodes", () => {
  it("deactivates weak competitors once the winner is strong enough", () => {
    expect(
      shouldDeactivateCompetingCodes([
        { id: "winner", upvotes: 14, downvotes: 1, isActive: true },
        { id: "loser-a", upvotes: 1, downvotes: 6, isActive: true },
        { id: "loser-b", upvotes: 1, downvotes: 5, isActive: true },
      ]),
    ).toEqual({
      winnerId: "winner",
      losersToDeactivate: ["loser-a", "loser-b"],
    });
  });

  it("keeps competitors active when the winner has not crossed the threshold", () => {
    expect(
      shouldDeactivateCompetingCodes([
        { id: "winner", upvotes: 6, downvotes: 1, isActive: true },
        { id: "loser", upvotes: 1, downvotes: 5, isActive: true },
      ]),
    ).toEqual({
      winnerId: "winner",
      losersToDeactivate: [],
    });
  });
});
