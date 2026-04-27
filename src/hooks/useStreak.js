import { useCallback, useMemo, useState } from "react";
import { getRounds, saveRound } from "./useLocalStorage.js";

function toLocalDateKey(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function calculateStreaks(rounds = [], today = new Date()) {
  const completedDays = new Set(
    rounds
      .map((round) => toLocalDateKey(round.timestamp))
      .filter(Boolean),
  );

  if (completedDays.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  let currentStreak = 0;
  let cursor = new Date(today);

  while (completedDays.has(toLocalDateKey(cursor))) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  const sortedDays = [...completedDays].sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let previousDay = null;

  for (const day of sortedDays) {
    const currentDay = new Date(`${day}T00:00:00`);

    if (
      previousDay &&
      toLocalDateKey(addDays(previousDay, 1)) === toLocalDateKey(currentDay)
    ) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }

    longestStreak = Math.max(longestStreak, runningStreak);
    previousDay = currentDay;
  }

  return { currentStreak, longestStreak };
}

export function useStreak() {
  const [rounds, setRounds] = useState(() => getRounds());

  const { currentStreak, longestStreak } = useMemo(
    () => calculateStreaks(rounds),
    [rounds],
  );

  const incrementStreak = useCallback((round = {}) => {
    const savedRound = saveRound({
      ...round,
      timestamp: round.timestamp || Date.now(),
    });

    setRounds(getRounds());
    return savedRound;
  }, []);

  return { currentStreak, longestStreak, incrementStreak };
}

export default useStreak;
