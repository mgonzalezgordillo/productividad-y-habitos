import { db } from "./db";
import { exportPayloadSchema } from "./schemas";
import { SCHEMA_VERSION, type ExportPayload } from "./types";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

export const createExportPayload = async (): Promise<ExportPayload> => ({
  schemaVersion: SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  settings: await db.settings.toArray(),
  habits: await db.habits.toArray(),
  habitSchedules: await db.habitSchedules.toArray(),
  habitEntries: await db.habitEntries.toArray()
});

export const exportJsonBlob = async (): Promise<Blob> =>
  new Blob([JSON.stringify(await createExportPayload(), null, 2)], {
    type: "application/json;charset=utf-8"
  });

const csvEscape = (value: unknown): string => {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export const exportCsvBlob = async (): Promise<Blob> => {
  const habits = await db.habits.toArray();
  const entries = await db.habitEntries.toArray();
  const habitById = new Map(habits.map((habit) => [habit.id, habit]));
  const rows = [["Fecha", "Habito", "Tipo", "Estado", "Valor", "Unidad", "Objetivo", "Nota"]];
  for (const entry of entries.sort((a, b) => a.localDate.localeCompare(b.localDate))) {
    const habit = habitById.get(entry.habitId);
    rows.push([
      entry.localDate,
      habit?.name ?? entry.habitId,
      habit?.type ?? "",
      entry.status,
      String(entry.value ?? ""),
      habit?.unit ?? "",
      String(habit?.targetValue ?? ""),
      entry.note ?? ""
    ]);
  }
  return new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8"
  });
};

export const parseImportFile = async (file: File): Promise<ExportPayload> => {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error("El archivo es demasiado grande.");
  }
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("El archivo no contiene JSON valido.");
  }
  return exportPayloadSchema.parse(parsed);
};

export const saveAutomaticBackup = async (reason: string): Promise<void> => {
  const payload = await createExportPayload();
  await db.appBackups.add({
    id: crypto.randomUUID(),
    version: SCHEMA_VERSION,
    payload,
    reason,
    createdAt: new Date().toISOString()
  });
};

export const replaceAllData = async (payload: ExportPayload): Promise<void> => {
  await saveAutomaticBackup("pre-import-replace");
  await db.transaction(
    "rw",
    db.settings,
    db.habits,
    db.habitSchedules,
    db.habitEntries,
    async () => {
      await db.habitEntries.clear();
      await db.habitSchedules.clear();
      await db.habits.clear();
      await db.settings.clear();
      await db.settings.bulkPut(payload.settings);
      await db.habits.bulkPut(payload.habits);
      await db.habitSchedules.bulkPut(payload.habitSchedules);
      await db.habitEntries.bulkPut(payload.habitEntries);
    }
  );
};

export const mergeData = async (payload: ExportPayload): Promise<void> => {
  await saveAutomaticBackup("pre-import-merge");
  await db.transaction(
    "rw",
    db.settings,
    db.habits,
    db.habitSchedules,
    db.habitEntries,
    async () => {
      await db.settings.bulkPut(payload.settings);
      await db.habits.bulkPut(payload.habits);
      await db.habitSchedules.bulkPut(payload.habitSchedules);
      await db.habitEntries.bulkPut(payload.habitEntries);
    }
  );
};

export const restoreLatestBackup = async (): Promise<boolean> => {
  const latest = await db.appBackups.orderBy("createdAt").last();
  if (!latest) return false;
  await replaceAllData(latest.payload);
  return true;
};
