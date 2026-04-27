export const WEEKLY_CHALLENGES = [
  { weekNumber: 1, word: "JUXTAPOSITION", difficulty: "hard" },
  { weekNumber: 2, word: "PARADIGM", difficulty: "hard" },
  { weekNumber: 3, word: "AMELIORATE", difficulty: "hard" },
  { weekNumber: 4, word: "SYCOPHANTIC", difficulty: "hard" },
  { weekNumber: 5, word: "EPISTEMOLOGICAL", difficulty: "hard" },
  { weekNumber: 6, word: "CIRCUMSPECT", difficulty: "hard" },
  { weekNumber: 7, word: "PREDICATED", difficulty: "hard" },
  { weekNumber: 8, word: "ANTITHETICAL", difficulty: "hard" },
  { weekNumber: 9, word: "HEGEMONY", difficulty: "hard" },
  { weekNumber: 10, word: "PERFUNCTORY", difficulty: "hard" },
  { weekNumber: 11, word: "EQUIVOCATE", difficulty: "hard" },
  { weekNumber: 12, word: "OBFUSCATE", difficulty: "hard" },
  { weekNumber: 13, word: "IDIOSYNCRATIC", difficulty: "hard" },
  { weekNumber: 14, word: "INCONGRUOUS", difficulty: "hard" },
  { weekNumber: 15, word: "PRESCIENT", difficulty: "hard" },
  { weekNumber: 16, word: "SALIENT", difficulty: "hard" },
  { weekNumber: 17, word: "DIDACTIC", difficulty: "hard" },
  { weekNumber: 18, word: "COGENT", difficulty: "hard" },
  { weekNumber: 19, word: "DIALECTICAL", difficulty: "hard" },
  { weekNumber: 20, word: "ONTOLOGICAL", difficulty: "hard" },
  { weekNumber: 21, word: "INTEROPERABILITY", difficulty: "hard" },
  { weekNumber: 22, word: "IDEMPOTENT", difficulty: "hard" },
  { weekNumber: 23, word: "ASYNCHRONOUS", difficulty: "hard" },
  { weekNumber: 24, word: "NORMALISATION", difficulty: "hard" },
  { weekNumber: 25, word: "CONTAINERISATION", difficulty: "hard" },
  { weekNumber: 26, word: "ORCHESTRATION", difficulty: "hard" },
  { weekNumber: 27, word: "DECENTRALISED", difficulty: "hard" },
  { weekNumber: 28, word: "CRYPTOGRAPHIC", difficulty: "hard" },
  { weekNumber: 29, word: "VIRTUALISATION", difficulty: "hard" },
  { weekNumber: 30, word: "TELEMETRY", difficulty: "hard" },
  { weekNumber: 31, word: "PROVENANCE", difficulty: "hard" },
  { weekNumber: 32, word: "RECURSION", difficulty: "hard" },
  { weekNumber: 33, word: "MULTITHREADING", difficulty: "hard" },
  { weekNumber: 34, word: "SERIALIZATION", difficulty: "hard" },
  { weekNumber: 35, word: "SHARDING", difficulty: "hard" },
  { weekNumber: 36, word: "FIDUCIARY", difficulty: "hard" },
  { weekNumber: 37, word: "ARBITRAGE", difficulty: "hard" },
  { weekNumber: 38, word: "DIVESTITURE", difficulty: "hard" },
  { weekNumber: 39, word: "AMORTISATION", difficulty: "hard" },
  { weekNumber: 40, word: "LIQUIDITY", difficulty: "hard" },
  { weekNumber: 41, word: "MONOPOLISTIC", difficulty: "hard" },
  { weekNumber: 42, word: "DISINTERMEDIATION", difficulty: "hard" },
  { weekNumber: 43, word: "CANNIBALISATION", difficulty: "hard" },
  { weekNumber: 44, word: "COMMODITISATION", difficulty: "hard" },
  { weekNumber: 45, word: "DIFFERENTIATION", difficulty: "hard" },
  { weekNumber: 46, word: "SERENDIPITY", difficulty: "hard" },
  { weekNumber: 47, word: "PROCRASTINATION", difficulty: "hard" },
  { weekNumber: 48, word: "INTROSPECTION", difficulty: "hard" },
  { weekNumber: 49, word: "RECONCILIATION", difficulty: "hard" },
  { weekNumber: 50, word: "PERSEVERANCE", difficulty: "hard" },
  { weekNumber: 51, word: "LEVERAGE", difficulty: "medium" },
  { weekNumber: 52, word: "NUANCE", difficulty: "medium" },
];

export function getIsoWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getStoredRoundCount(word) {
  if (typeof localStorage === "undefined") return 1247;
  return parseInt(localStorage.getItem(`cadence_weekly_${word}`) || "1247", 10);
}

export function getCurrentChallenge(date = new Date()) {
  const isoWeek = getIsoWeekNumber(date);
  const weekNumber = ((isoWeek - 1) % WEEKLY_CHALLENGES.length) + 1;
  const challenge = WEEKLY_CHALLENGES.find(
    (entry) => entry.weekNumber === weekNumber,
  );

  return {
    ...challenge,
    roundCount: getStoredRoundCount(challenge.word),
  };
}

export function getWeeklyChallenge(date = new Date()) {
  return getCurrentChallenge(date);
}

export function recordWeeklyPlay(word) {
  const key = `cadence_weekly_${word}`;
  if (typeof localStorage === "undefined") return;
  const current = parseInt(localStorage.getItem(key) || "1247", 10);
  localStorage.setItem(key, String(current + 1));
}
