export interface ScoreableCode {
  id: string;
  upvotes: number;
  downvotes: number;
  isActive: boolean;
}

export function calculateWilsonScore(ups: number, downs: number) {
  const n = ups + downs;

  if (n === 0) {
    return 0;
  }

  const z = 1.96;
  const phat = ups / n;

  return (
    (phat + (z * z) / (2 * n) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
}

export function shouldDeactivateCompetingCodes(codes: ScoreableCode[]) {
  const activeCodes = codes
    .filter((code) => code.isActive)
    .map((code) => ({
      ...code,
      totalVotes: code.upvotes + code.downvotes,
      confidenceScore: calculateWilsonScore(code.upvotes, code.downvotes),
    }))
    .sort((left, right) => right.confidenceScore - left.confidenceScore);

  const winner = activeCodes[0];

  if (!winner) {
    return {
      winnerId: null,
      losersToDeactivate: [] as string[],
    };
  }

  const losingCandidates = activeCodes.filter((code) => code.id !== winner.id);
  const strongEnoughWinner =
    winner.confidenceScore > 0.65 && winner.totalVotes >= 10;
  const losingCodesAreWeak = losingCandidates.every(
    (code) => code.totalVotes < 5 || code.confidenceScore < 0.3,
  );

  if (!strongEnoughWinner || !losingCodesAreWeak) {
    return {
      winnerId: winner.id,
      losersToDeactivate: [] as string[],
    };
  }

  return {
    winnerId: winner.id,
    losersToDeactivate: losingCandidates
      .filter((code) => code.totalVotes >= 5 && code.confidenceScore < 0.3)
      .map((code) => code.id)
      .sort(),
  };
}
