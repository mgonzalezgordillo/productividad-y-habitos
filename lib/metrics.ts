import type { Habit, HabitEntry, HabitSchedule, PeriodMetrics, PeriodRange } from "./types";
import { isHabitScheduled } from "./habits";
import { daysBetweenInclusive } from "./date";

export const getEntry = (
  entries: HabitEntry[],
  habitId: string,
  localDate: string
): HabitEntry | undefined =>
  entries.find((entry) => entry.habitId === habitId && entry.localDate === localDate);

export const computedStatusFor = (
  habit: Habit,
  schedules: HabitSchedule[],
  entries: HabitEntry[],
  localDate: string
) => {
  if (!isHabitScheduled(habit, schedules, localDate)) return "NOT_SCHEDULED" as const;
  return getEntry(entries, habit.id, localDate)?.status ?? "PENDING";
};

export const calculatePeriodMetrics = (
  habits: Habit[],
  schedules: HabitSchedule[],
  entries: HabitEntry[],
  period: PeriodRange,
  habitIds?: string[]
): PeriodMetrics => {
  const filteredHabits = habitIds?.length
    ? habits.filter((habit) => habitIds.includes(habit.id))
    : habits;
  const metrics: PeriodMetrics = {
    scheduled: 0,
    completed: 0,
    missed: 0,
    skipped: 0,
    pending: 0,
    completionRate: null
  };
  for (const day of period.days) {
    for (const habit of filteredHabits) {
      if (!isHabitScheduled(habit, schedules, day)) continue;
      metrics.scheduled += 1;
      const status = getEntry(entries, habit.id, day)?.status ?? "PENDING";
      if (status === "COMPLETED") metrics.completed += 1;
      if (status === "MISSED") metrics.missed += 1;
      if (status === "SKIPPED") metrics.skipped += 1;
      if (status === "PENDING") metrics.pending += 1;
    }
  }
  const denominator = metrics.completed + metrics.missed;
  metrics.completionRate = denominator === 0 ? null : metrics.completed / denominator;
  return metrics;
};

export const calculateStreaks = (
  habit: Habit,
  schedules: HabitSchedule[],
  entries: HabitEntry[],
  today: string
): { current: number; best: number; recoveredDays: number; lastScheduledMissed: boolean } => {
  const days = daysBetweenInclusive(habit.startDate, today);
  let current = 0;
  let best = 0;
  let running = 0;
  let recoveredDays = 0;
  let afterMiss = false;
  let lastScheduledMissed = false;

  for (const day of days) {
    if (!isHabitScheduled(habit, schedules, day)) continue;
    const status = getEntry(entries, habit.id, day)?.status ?? "PENDING";
    lastScheduledMissed = status === "MISSED";
    if (status === "COMPLETED") {
      running += 1;
      if (afterMiss) {
        recoveredDays += 1;
        afterMiss = false;
      }
      best = Math.max(best, running);
      current = running;
    } else if (status === "MISSED") {
      running = 0;
      current = 0;
      afterMiss = true;
    } else if (status === "SKIPPED" || status === "PENDING") {
      best = Math.max(best, running);
      current = running;
    }
  }
  return { current, best, recoveredDays, lastScheduledMissed };
};
