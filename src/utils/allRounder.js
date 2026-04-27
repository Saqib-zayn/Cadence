const MIN_ROUNDS = 10;

function getScore(round) {
  return Number(round.fluencyScore || 0);
}

function getBreakdownScore(round, key) {
  return Number(round.scoreBreakdown?.[key] || 0);
}

function average(rounds) {
  if (rounds.length === 0) return 0;
  return rounds.reduce((sum, round) => sum + getScore(round), 0) / rounds.length;
}

function getLastTenChronological(rounds) {
  return [...rounds]
    .sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0))
    .slice(-MIN_ROUNDS);
}

export function getAllRounderSummary(rounds = []) {
  if (!Array.isArray(rounds) || rounds.length < MIN_ROUNDS) return null;

  const recentRounds = getLastTenChronological(rounds);
  const strengths = [];
  const weaknesses = [];

  const lowFillerRounds = recentRounds.filter(
    (round) => Number(round.fillerCount || 0) <= 1,
  ).length;

  if (lowFillerRounds >= 8) {
    strengths.push({
      type: "fillerWords",
      message: "You rarely use filler words - strong habit.",
    });
  }

  const firstFiveAverage = average(recentRounds.slice(0, 5));
  const lastFiveAverage = average(recentRounds.slice(5));

  if (lastFiveAverage > firstFiveAverage + 5) {
    strengths.push({
      type: "improvingTrend",
      message: "Your scores are trending upward - consistency is building.",
    });
  }

  const hardRoundPerformance = recentRounds.some(
    (round) => round.difficulty === "hard" && getScore(round) >= 75,
  );

  if (hardRoundPerformance) {
    strengths.push({
      type: "hardWords",
      message:
        "You're holding up well on hard words - consider pushing complexity further.",
    });
  }

  const lowPauseQualityRounds = recentRounds.filter(
    (round) => getBreakdownScore(round, "pauseQuality") < 12,
  ).length;

  if (lowPauseQualityRounds >= 7) {
    weaknesses.push({
      type: "pauseQuality",
      message:
        "You tend to pause mid-sentence - practise pausing between sentences instead.",
    });
  }

  const trailingOffRounds = recentRounds.filter(
    (round) => getBreakdownScore(round, "sentenceCompletion") < 8,
  ).length;

  if (trailingOffRounds >= 6) {
    weaknesses.push({
      type: "sentenceCompletion",
      message:
        "You often trail off before finishing your thought. Try slowing down in the final clause.",
    });
  }

  return {
    strengths: strengths.slice(0, 2),
    weaknesses: weaknesses.slice(0, 2),
  };
}

export default getAllRounderSummary;
