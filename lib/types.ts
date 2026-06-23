export const SCHEMA_VERSION = 1;

export type HabitType = "BOOLEAN" | "QUANTITY" | "DURATION" | "COUNTER";
export type EntryStatus = "PENDING" | "COMPLETED" | "MISSED" | "SKIPPED" | "NOT_SCHEDULED";
export type WeekdayIso = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PeriodKind = "1d" | "30d" | "90d" | "365d";

export interface Settings {
  id: string;
  userId?: string;
  accountEmail?: string;
  timezone: string;
  dayBoundaryTime: string;
  locale: string;
  onboardingCompleted: boolean;
  allowHistoricalEditing: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  userId?: string;
  accountEmail?: string;
  name: string;
  description?: string;
  type: HabitType;
  targetValue?: number;
  unit?: string;
  icon: string;
  color: string;
  minimumVersion?: string;
  startDate: string;
  endDate?: string;
  archivedAt?: string;
  deletedAt?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface HabitSchedule {
  id: string;
  habitId: string;
  userId?: string;
  accountEmail?: string;
  dayOfWeek: WeekdayIso;
  enabled: boolean;
}

export interface HabitEntry {
  id: string;
  habitId: string;
  userId?: string;
  accountEmail?: string;
  localDate: string;
  status: EntryStatus;
  value?: number;
  note?: string;
  completedAt?: string;
  finalizedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppBackup {
  id: string;
  version: number;
  payload: ExportPayload;
  reason: string;
  createdAt: string;
}

export interface AuthSession {
  id: string;
  email: string;
  name: string;
  picture?: string;
  credential: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface ExportPayload {
  schemaVersion: number;
  exportedAt: string;
  settings: Settings[];
  habits: Habit[];
  habitSchedules: HabitSchedule[];
  habitEntries: HabitEntry[];
}

export interface DayHabitState {
  habit: Habit;
  entry?: HabitEntry;
  scheduled: boolean;
  computedStatus: EntryStatus;
  value: number;
}

export interface FinalizeResult {
  created: number;
  checkedDates: string[];
}

export interface PeriodRange {
  kind: PeriodKind;
  startDate: string;
  endDate: string;
  days: string[];
}

export interface PeriodMetrics {
  scheduled: number;
  completed: number;
  missed: number;
  skipped: number;
  pending: number;
  completionRate: number | null;
}
