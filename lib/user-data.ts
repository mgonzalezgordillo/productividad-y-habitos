import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type DocumentReference,
  type FirestoreError,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { db as legacyDb } from "./db";
import { getFirebaseFirestore } from "./firebase";
import { exportPayloadSchema } from "./schemas";
import type { ExportPayload, Habit, HabitEntry, HabitSchedule, Settings } from "./types";

export interface WorkspaceSnapshot {
  settings: Settings | null;
  habits: Habit[];
  habitSchedules: HabitSchedule[];
  habitEntries: HabitEntry[];
}

export interface LegacyLocalWorkspace {
  settings: Settings[];
  habits: Habit[];
  habitSchedules: HabitSchedule[];
  habitEntries: HabitEntry[];
}

export interface WorkspaceMigrationSummary {
  settings: number;
  habits: number;
  habitSchedules: number;
  habitEntries: number;
}

const SETTINGS_DOC_ID = "current";
const PAGE_SIZE = 450;

const toIsoTimestamp = (value: unknown): string => {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
};

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeSettings = (data: DocumentData | undefined, userId: string): Settings | null => {
  if (!data) return null;
  return {
    id: SETTINGS_DOC_ID,
    timezone: typeof data.timezone === "string" && data.timezone ? data.timezone : "UTC",
    dayBoundaryTime: typeof data.dayBoundaryTime === "string" ? data.dayBoundaryTime : "00:00",
    locale: typeof data.locale === "string" && data.locale ? data.locale : "es-ES",
    onboardingCompleted: Boolean(data.onboardingCompleted),
    allowHistoricalEditing: Boolean(data.allowHistoricalEditing),
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
    userId
  } as Settings;
};

const normalizeHabit = (docSnap: QueryDocumentSnapshot<DocumentData>, userId: string): Habit => {
  const data = docSnap.data({ serverTimestamps: "estimate" });
  return {
    id: docSnap.id,
    name: typeof data.name === "string" ? data.name : "",
    description: optionalString(data.description),
    type: data.type as Habit["type"],
    targetValue: typeof data.targetValue === "number" ? data.targetValue : undefined,
    unit: optionalString(data.unit),
    icon: typeof data.icon === "string" ? data.icon : "Check",
    color: typeof data.color === "string" ? data.color : "#1689a4",
    minimumVersion: optionalString(data.minimumVersion),
    startDate: typeof data.startDate === "string" ? data.startDate : new Date().toISOString().slice(0, 10),
    endDate: optionalString(data.endDate),
    archivedAt: optionalString(data.archivedAt),
    deletedAt: optionalString(data.deletedAt),
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
    userId
  };
};

const normalizeSchedule = (docSnap: QueryDocumentSnapshot<DocumentData>, userId: string): HabitSchedule => {
  const data = docSnap.data({ serverTimestamps: "estimate" });
  return {
    id: docSnap.id,
    habitId: typeof data.habitId === "string" ? data.habitId : "",
    dayOfWeek: data.dayOfWeek as HabitSchedule["dayOfWeek"],
    enabled: Boolean(data.enabled),
    userId
  } as HabitSchedule;
};

const normalizeEntry = (docSnap: QueryDocumentSnapshot<DocumentData>, userId: string): HabitEntry => {
  const data = docSnap.data({ serverTimestamps: "estimate" });
  return {
    id: docSnap.id,
    habitId: typeof data.habitId === "string" ? data.habitId : "",
    localDate: typeof data.localDate === "string" ? data.localDate : new Date().toISOString().slice(0, 10),
    status: data.status as HabitEntry["status"],
    value: typeof data.value === "number" ? data.value : undefined,
    note: optionalString(data.note),
    completedAt: optionalString(data.completedAt),
    finalizedAt: optionalString(data.finalizedAt),
    createdAt: toIsoTimestamp(data.createdAt),
    updatedAt: toIsoTimestamp(data.updatedAt),
    userId
  };
};

const userDoc = (userId: string): DocumentReference<DocumentData> => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  return doc(firestore, "users", userId);
};

const settingsDoc = (userId: string): DocumentReference<DocumentData> => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  return doc(firestore, "users", userId, "settings", SETTINGS_DOC_ID);
};

const habitsCol = (userId: string) => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  return collection(firestore, "users", userId, "habits");
};

const schedulesCol = (userId: string) => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  return collection(firestore, "users", userId, "habitSchedules");
};

const entriesCol = (userId: string) => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  return collection(firestore, "users", userId, "habitEntries");
};

const profileData = (userId: string, email: string, name?: string, picture?: string) => ({
  uid: userId,
  email,
  displayName: name ?? null,
  photoURL: picture ?? null,
  schemaVersion: 1,
  updatedAt: serverTimestamp()
});

const chunk = <T,>(items: T[], size = PAGE_SIZE): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const workspaceFromDocs = (
  userId: string,
  settingsData: DocumentData | undefined,
  habits: QueryDocumentSnapshot<DocumentData>[],
  schedules: QueryDocumentSnapshot<DocumentData>[],
  entries: QueryDocumentSnapshot<DocumentData>[]
): WorkspaceSnapshot => ({
  settings: normalizeSettings(settingsData, userId),
  habits: habits.map((snapshot) => normalizeHabit(snapshot, userId)),
  habitSchedules: schedules.map((snapshot) => normalizeSchedule(snapshot, userId)),
  habitEntries: entries.map((snapshot) => normalizeEntry(snapshot, userId))
});

export const getWorkspaceSnapshot = async (userId: string): Promise<WorkspaceSnapshot> => {
  const [settingsSnap, habitsSnap, schedulesSnap, entriesSnap] = await Promise.all([
    getDoc(settingsDoc(userId)),
    getDocs(query(habitsCol(userId), orderBy("sortOrder"))),
    getDocs(query(schedulesCol(userId), orderBy("id"))),
    getDocs(query(entriesCol(userId), orderBy("localDate")))
  ]);

  return workspaceFromDocs(
    userId,
    settingsSnap.exists() ? settingsSnap.data({ serverTimestamps: "estimate" }) : undefined,
    habitsSnap.docs,
    schedulesSnap.docs,
    entriesSnap.docs
  );
};

export const watchWorkspace = (
  userId: string,
  onChange: (workspace: WorkspaceSnapshot) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const empty: WorkspaceSnapshot = { settings: null, habits: [], habitSchedules: [], habitEntries: [] };
  const state = { ...empty };
  const ready = { settings: false, habits: false, habitSchedules: false, habitEntries: false };

  const emitIfReady = () => {
    if (Object.values(ready).every(Boolean)) {
      onChange({ ...state });
    }
  };

  const unsubscribes = [
    onSnapshot(
      settingsDoc(userId),
      (snapshot) => {
        state.settings = snapshot.exists() ? normalizeSettings(snapshot.data({ serverTimestamps: "estimate" }), userId) : null;
        ready.settings = true;
        emitIfReady();
      },
      (error: FirestoreError) => onError?.(new Error(error.message))
    ),
    onSnapshot(
      query(habitsCol(userId), orderBy("sortOrder")),
      (snapshot) => {
        state.habits = snapshot.docs.map((docSnap) => normalizeHabit(docSnap, userId));
        ready.habits = true;
        emitIfReady();
      },
      (error: FirestoreError) => onError?.(new Error(error.message))
    ),
    onSnapshot(
      query(schedulesCol(userId), orderBy("id")),
      (snapshot) => {
        state.habitSchedules = snapshot.docs.map((docSnap) => normalizeSchedule(docSnap, userId));
        ready.habitSchedules = true;
        emitIfReady();
      },
      (error: FirestoreError) => onError?.(new Error(error.message))
    ),
    onSnapshot(
      query(entriesCol(userId), orderBy("localDate")),
      (snapshot) => {
        state.habitEntries = snapshot.docs.map((docSnap) => normalizeEntry(docSnap, userId));
        ready.habitEntries = true;
        emitIfReady();
      },
      (error: FirestoreError) => onError?.(new Error(error.message))
    )
  ];

  return () => unsubscribes.forEach((unsub) => unsub());
};

export const ensureUserProfile = async (userId: string, email: string, name?: string, picture?: string): Promise<void> => {
  const ref = userDoc(userId);
  const snapshot = await getDoc(ref);
  const now = serverTimestamp();
  if (!snapshot.exists()) {
    await setDoc(ref, {
      uid: userId,
      email,
      displayName: name ?? null,
      photoURL: picture ?? null,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
      localMigrationCompletedAt: null
    });
    return;
  }
  await setDoc(ref, profileData(userId, email, name, picture), { merge: true });
}

export const markLocalMigrationCompleted = async (userId: string): Promise<void> => {
  await setDoc(
    userDoc(userId),
    {
      localMigrationCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const saveSettingsRemote = async (userId: string, settings: Settings): Promise<void> => {
  const ref = settingsDoc(userId);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...settings,
      userId,
      createdAt: existing.exists() ? existing.data({ serverTimestamps: "estimate" }).createdAt ?? settings.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const upsertHabitRemote = async (userId: string, habit: Habit): Promise<void> => {
  const ref = doc(habitsCol(userId), habit.id);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...habit,
      userId,
      createdAt: existing.exists() ? existing.data({ serverTimestamps: "estimate" }).createdAt ?? habit.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const upsertSchedulesRemote = async (userId: string, schedules: HabitSchedule[]): Promise<void> => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  if (!schedules.length) return;
  for (const scheduleChunk of chunk(schedules)) {
    const writes = scheduleChunk.map((schedule) =>
      setDoc(
        doc(firestore, "users", userId, "habitSchedules", schedule.id),
        {
          ...schedule,
          userId
        },
        { merge: true }
      )
    );
    await Promise.all(writes);
  }
};

export const upsertEntryRemote = async (userId: string, entry: HabitEntry): Promise<void> => {
  const ref = doc(entriesCol(userId), entry.id);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      ...entry,
      userId,
      createdAt: existing.exists() ? existing.data({ serverTimestamps: "estimate" }).createdAt ?? entry.createdAt : serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
};

export const deleteEntryRemote = async (userId: string, entryId: string): Promise<void> => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  await deleteDoc(doc(firestore, "users", userId, "habitEntries", entryId));
};

export const bulkUpsertEntriesRemote = async (userId: string, entries: HabitEntry[]): Promise<void> => {
  for (const entryChunk of chunk(entries)) {
    await Promise.all(entryChunk.map((entry) => upsertEntryRemote(userId, entry)));
  }
};

export const deleteHabitRemote = async (userId: string, habitId: string): Promise<void> => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  const [habitDocs, scheduleDocs, entryDocs] = await Promise.all([
    getDocs(query(collection(firestore, "users", userId, "habits"), orderBy("sortOrder"))),
    getDocs(query(collection(firestore, "users", userId, "habitSchedules"), orderBy("id"))),
    getDocs(query(collection(firestore, "users", userId, "habitEntries"), orderBy("localDate")))
  ]);
  const deletes = [
    ...habitDocs.docs.filter((snapshot) => snapshot.id === habitId),
    ...scheduleDocs.docs.filter((snapshot) => snapshot.data().habitId === habitId),
    ...entryDocs.docs.filter((snapshot) => snapshot.data().habitId === habitId)
  ];
  await Promise.all(deletes.map((snapshot) => deleteDoc(snapshot.ref)));
};

export const deleteWorkspaceRemote = async (userId: string): Promise<void> => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  const refs = [
    query(collection(firestore, "users", userId, "habits"), orderBy("sortOrder")),
    query(collection(firestore, "users", userId, "habitSchedules"), orderBy("id")),
    query(collection(firestore, "users", userId, "habitEntries"), orderBy("localDate"))
  ];
  for (const ref of refs) {
    const snapshots = await getDocs(ref);
    for (const snapshot of snapshots.docs) {
      await deleteDoc(snapshot.ref);
    }
  }
  await deleteDoc(userDoc(userId));
}

export const replaceWorkspaceRemote = async (userId: string, payload: ExportPayload): Promise<void> => {
  const firestore = getFirebaseFirestore();
  if (!firestore) throw new Error("Firebase no esta configurado.");
  await deleteWorkspaceRemote(userId);
  if (payload.settings.length) await saveSettingsRemote(userId, payload.settings[0]);
  await Promise.all(payload.habits.map((habit) => upsertHabitRemote(userId, habit)));
  await upsertSchedulesRemote(userId, payload.habitSchedules);
  await bulkUpsertEntriesRemote(userId, payload.habitEntries);
};

export const mergeWorkspaceRemote = async (userId: string, payload: ExportPayload): Promise<void> => {
  if (payload.settings.length) await saveSettingsRemote(userId, payload.settings[0]);
  await Promise.all(payload.habits.map((habit) => upsertHabitRemote(userId, habit)));
  await upsertSchedulesRemote(userId, payload.habitSchedules);
  await bulkUpsertEntriesRemote(userId, payload.habitEntries);
};

export const getLegacyLocalWorkspace = async (): Promise<LegacyLocalWorkspace> => ({
  settings: await legacyDb.settings.toArray(),
  habits: await legacyDb.habits.toArray(),
  habitSchedules: await legacyDb.habitSchedules.toArray(),
  habitEntries: await legacyDb.habitEntries.toArray()
});

export const clearLegacyLocalWorkspace = async (): Promise<void> => {
  await legacyDb.transaction("rw", legacyDb.settings, legacyDb.habits, legacyDb.habitSchedules, legacyDb.habitEntries, legacyDb.appBackups, async () => {
    await legacyDb.habitEntries.clear();
    await legacyDb.habitSchedules.clear();
    await legacyDb.habits.clear();
    await legacyDb.settings.clear();
    await legacyDb.appBackups.clear();
  });
};

export const getLegacyLocalWorkspaceSummary = async (): Promise<WorkspaceMigrationSummary> => {
  const workspace = await getLegacyLocalWorkspace();
  return {
    settings: workspace.settings.length,
    habits: workspace.habits.length,
    habitSchedules: workspace.habitSchedules.length,
    habitEntries: workspace.habitEntries.length
  };
};

export const hasLegacyLocalWorkspace = async (): Promise<boolean> => {
  const summary = await getLegacyLocalWorkspaceSummary();
  return summary.settings + summary.habits + summary.habitSchedules + summary.habitEntries > 0;
};

export const exportWorkspacePayload = (workspace: WorkspaceSnapshot): ExportPayload => ({
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  settings: workspace.settings ? [workspace.settings] : [],
  habits: workspace.habits,
  habitSchedules: workspace.habitSchedules,
  habitEntries: workspace.habitEntries
});

export const parseExportWorkspace = (payload: unknown): ExportPayload => exportPayloadSchema.parse(payload);

export const getUserProfileDocRef = (userId: string) => userDoc(userId);
