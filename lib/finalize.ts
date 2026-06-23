import { db } from "./db";
import { daysBetweenInclusive, expiredDatesSince, nowUtcIso } from "./date";
import { isHabitScheduled } from "./habits";
import type { FinalizeResult, Habit, HabitEntry, HabitSchedule, Settings } from "./types";

export const earliestRelevantDate = (habits: Habit[]): string | null => {
  const active = habits.filter((habit) => !habit.deletedAt);
  if (!active.length) return null;
  return active.map((habit) => habit.startDate).sort()[0] ?? null;
};

export const finalizeExpiredDaysData = (
  habits: Habit[],
  schedules: HabitSchedule[],
  existingEntries: HabitEntry[],
  settings: Settings,
  instant: Date
): { entries: HabitEntry[]; checkedDates: string[] } => {
  const earliest = earliestRelevantDate(habits);
  if (!earliest) return { entries: [], checkedDates: [] };
  const expiredDates = expiredDatesSince(
    earliest,
    instant,
    settings.timezone,
    settings.dayBoundaryTime
  );
  const byKey = new Set(existingEntries.map((entry) => `${entry.habitId}:${entry.localDate}`));
  const now = nowUtcIso();
  const entries: HabitEntry[] = [];

  for (const localDate of expiredDates) {
    for (const habit of habits) {
      if (!isHabitScheduled(habit, schedules, localDate)) continue;
      const key = `${habit.id}:${localDate}`;
      if (byKey.has(key)) continue;
      entries.push({
        id: crypto.randomUUID(),
        habitId: habit.id,
        localDate,
        status: "MISSED",
        value: 0,
        finalizedAt: now,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  return { entries, checkedDates: expiredDates };
};

export const finalizeExpiredDays = async (
  settings: Settings,
  instant = new Date()
): Promise<FinalizeResult> => {
  const habits = await db.habits.toArray();
  const schedules = await db.habitSchedules.toArray();
  const earliest = earliestRelevantDate(habits);
  if (!earliest) return { created: 0, checkedDates: [] };
  const today = instant.toISOString().slice(0, 10);
  const entries = await db.habitEntries
    .where("localDate")
    .between(earliest, today, true, true)
    .toArray();
  const result = finalizeExpiredDaysData(habits, schedules, entries, settings, instant);
  if (result.entries.length) {
    await db.habitEntries.bulkAdd(result.entries);
  }
  return { created: result.entries.length, checkedDates: result.checkedDates };
};

export const datesToInspect = (fromLocalDate: string, toLocalDate: string): string[] =>
  daysBetweenInclusive(fromLocalDate, toLocalDate);
