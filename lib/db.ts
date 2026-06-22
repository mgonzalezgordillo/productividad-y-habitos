import Dexie, { type Table } from "dexie";
import type { AppBackup, Habit, HabitEntry, HabitSchedule, Settings } from "./types";

export class HabitDatabase extends Dexie {
  settings!: Table<Settings, string>;
  habits!: Table<Habit, string>;
  habitSchedules!: Table<HabitSchedule, string>;
  habitEntries!: Table<HabitEntry, string>;
  appBackups!: Table<AppBackup, string>;

  constructor(name = "habitos-local-first") {
    super(name);
    this.version(1).stores({
      settings: "id",
      habits: "id, startDate, archivedAt, deletedAt, sortOrder",
      habitSchedules: "id, habitId, dayOfWeek, [habitId+dayOfWeek]",
      habitEntries:
        "id, localDate, habitId, status, [habitId+localDate], [localDate+status], updatedAt",
      appBackups: "id, version, createdAt, reason"
    });
  }
}

export const db = new HabitDatabase();

export const withMigrationBackup = async (reason: string): Promise<void> => {
  const { createExportPayload } = await import("./backup");
  const payload = await createExportPayload();
  await db.appBackups.add({
    id: crypto.randomUUID(),
    version: payload.schemaVersion,
    payload,
    reason,
    createdAt: new Date().toISOString()
  });
};
