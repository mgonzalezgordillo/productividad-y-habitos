import { saveAutomaticBackup } from "./backup";
import { db } from "./db";
import type { HabitEntry } from "./types";
import { LOCAL_ACCOUNT } from "./account";

export const migrateDefaultSleepToHours = async (accountKey = LOCAL_ACCOUNT): Promise<boolean> => {
  if (accountKey !== LOCAL_ACCOUNT) return false;
  const sleepHabit = await db.habits.get("default-sleep-7h");
  if (!sleepHabit || sleepHabit.unit !== "minutos" || sleepHabit.targetValue !== 420) {
    return false;
  }

  await saveAutomaticBackup("migration-sleep-duration-hours");
  const sleepEntries = await db.habitEntries.where("habitId").equals("default-sleep-7h").toArray();
  const now = new Date().toISOString();
  const convertedEntries: HabitEntry[] = sleepEntries.map((entry) => ({
    ...entry,
    value: typeof entry.value === "number" && entry.value > 24 ? Number((entry.value / 60).toFixed(2)) : entry.value,
    updatedAt: now
  }));

  await db.transaction("rw", db.habits, db.habitEntries, async () => {
    await db.habits.update("default-sleep-7h", {
      targetValue: 7,
      unit: "horas",
      updatedAt: now
    });
    if (convertedEntries.length) {
      await db.habitEntries.bulkPut(convertedEntries);
    }
  });
  return true;
};
