import { db as legacyDb } from "./db";
import { exportPayloadSchema } from "./schemas";
import { mergeWorkspaceRemote, replaceWorkspaceRemote, type WorkspaceSnapshot } from "./user-data";
import { SCHEMA_VERSION, type ExportPayload } from "./types";

const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

const stripUserId = <T extends { userId?: string }>(record: T): Omit<T, "userId"> => {
  const { userId: removedUserId, ...rest } = record;
  void removedUserId;
  return rest;
};

export const createExportPayload = async (workspace: WorkspaceSnapshot): Promise<ExportPayload> => ({
  schemaVersion: SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  settings: workspace.settings ? [stripUserId(workspace.settings)] : [],
  habits: workspace.habits.map(stripUserId),
  habitSchedules: workspace.habitSchedules.map(stripUserId),
  habitEntries: workspace.habitEntries.map(stripUserId)
});

export const exportJsonBlob = async (workspace: WorkspaceSnapshot): Promise<Blob> =>
  new Blob([JSON.stringify(await createExportPayload(workspace), null, 2)], {
    type: "application/json;charset=utf-8"
  });

const csvEscape = (value: unknown): string => {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

export const exportCsvBlob = async (workspace: WorkspaceSnapshot): Promise<Blob> => {
  const habitById = new Map(workspace.habits.map((habit) => [habit.id, habit]));
  const rows = [["Fecha", "Habito", "Tipo", "Estado", "Valor", "Unidad", "Objetivo", "Nota"]];
  for (const entry of [...workspace.habitEntries].sort((a, b) => a.localDate.localeCompare(b.localDate))) {
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

export const saveAutomaticBackup = async (workspace: WorkspaceSnapshot, reason: string): Promise<void> => {
  const payload = await createExportPayload(workspace);
  await legacyDb.appBackups.add({
    id: crypto.randomUUID(),
    version: SCHEMA_VERSION,
    payload,
    reason,
    createdAt: new Date().toISOString()
  });
};

export const replaceAllData = async (
  userId: string,
  payload: ExportPayload,
  backupWorkspace?: WorkspaceSnapshot
): Promise<void> => {
  if (backupWorkspace) {
    await saveAutomaticBackup(backupWorkspace, "pre-import-replace");
  }
  await replaceWorkspaceRemote(userId, payload);
}

export const mergeData = async (
  userId: string,
  payload: ExportPayload,
  backupWorkspace?: WorkspaceSnapshot
): Promise<void> => {
  if (backupWorkspace) {
    await saveAutomaticBackup(backupWorkspace, "pre-import-merge");
  }
  await mergeWorkspaceRemote(userId, payload);
}

export const restoreLatestBackup = async (userId: string): Promise<boolean> => {
  const latest = await legacyDb.appBackups.orderBy("createdAt").last();
  if (!latest) return false;
  await replaceWorkspaceRemote(userId, latest.payload);
  return true;
};
