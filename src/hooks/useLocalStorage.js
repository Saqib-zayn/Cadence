const ROUNDS_KEY = "cadence_rounds";
const MAX_STORED_ROUNDS = 50;

function readRounds() {
  if (typeof localStorage === "undefined") return [];

  try {
    const stored = JSON.parse(localStorage.getItem(ROUNDS_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function writeRounds(rounds) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ROUNDS_KEY, JSON.stringify(rounds));
}

function byNewestTimestamp(a, b) {
  return Number(b.timestamp || 0) - Number(a.timestamp || 0);
}

export function getRounds() {
  return readRounds().sort(byNewestTimestamp);
}

export function saveRound(round) {
  const roundToSave = {
    ...round,
    timestamp: round.timestamp || Date.now(),
  };

  const rounds = [...readRounds(), roundToSave]
    .sort(byNewestTimestamp)
    .slice(0, MAX_STORED_ROUNDS);

  writeRounds(rounds);
  return roundToSave;
}

export function clearRounds() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ROUNDS_KEY);
}

export default {
  saveRound,
  getRounds,
  clearRounds,
};
