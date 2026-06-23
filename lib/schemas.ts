import { z } from "zod";
import { SCHEMA_VERSION } from "./types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestamp = z.string().datetime();
const weekday = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7)
]);

export const settingsSchema = z.object({
  id: z.literal("default"),
  timezone: z.string().min(1),
  dayBoundaryTime: z.string().regex(/^0[0-6]:[0-5]\d$/),
  locale: z.string().min(2),
  onboardingCompleted: z.boolean(),
  allowHistoricalEditing: z.boolean(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp
});

export const habitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  type: z.enum(["BOOLEAN", "QUANTITY", "DURATION", "COUNTER"]),
  targetValue: z.number().nonnegative().optional(),
  unit: z.string().max(32).optional(),
  icon: z.string().min(1).max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  minimumVersion: z.string().max(160).optional(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  archivedAt: isoTimestamp.optional(),
  deletedAt: isoTimestamp.optional(),
  sortOrder: z.number().int().nonnegative(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp
});

export const habitScheduleSchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  dayOfWeek: weekday,
  enabled: z.boolean()
});

export const habitEntrySchema = z.object({
  id: z.string().min(1),
  habitId: z.string().min(1),
  localDate: isoDate,
  status: z.enum(["PENDING", "COMPLETED", "MISSED", "SKIPPED", "NOT_SCHEDULED"]),
  value: z.number().nonnegative().optional(),
  note: z.string().max(500).optional(),
  completedAt: isoTimestamp.optional(),
  finalizedAt: isoTimestamp.optional(),
  createdAt: isoTimestamp,
  updatedAt: isoTimestamp
});

export const exportPayloadSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    exportedAt: isoTimestamp,
    settings: z.array(settingsSchema).max(5),
    habits: z.array(habitSchema).max(2000),
    habitSchedules: z.array(habitScheduleSchema).max(14000),
    habitEntries: z.array(habitEntrySchema).max(200000)
  })
  .superRefine((payload, ctx) => {
    const habitIds = new Set(payload.habits.map((habit) => habit.id));
    const entryKeys = new Set<string>();
    for (const schedule of payload.habitSchedules) {
      if (!habitIds.has(schedule.habitId)) {
        ctx.addIssue({ code: "custom", message: "Programacion con habitId inexistente" });
      }
    }
    for (const entry of payload.habitEntries) {
      if (!habitIds.has(entry.habitId)) {
        ctx.addIssue({ code: "custom", message: "Registro con habitId inexistente" });
      }
      const key = `${entry.habitId}:${entry.localDate}`;
      if (entryKeys.has(key)) {
        ctx.addIssue({ code: "custom", message: "Registro duplicado por habito y fecha" });
      }
      entryKeys.add(key);
    }
  });

export const habitFormSchema = z.object({
  name: z.string().min(1, "Escribe un nombre").max(80),
  description: z.string().max(500).optional(),
  type: z.enum(["BOOLEAN", "QUANTITY", "DURATION", "COUNTER"]),
  targetValue: z.coerce.number().nonnegative().optional(),
  unit: z.string().max(32).optional(),
  icon: z.string().min(1).max(8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  minimumVersion: z.string().max(160).optional(),
  startDate: isoDate,
  endDate: isoDate.optional().or(z.literal("")),
  scheduleDays: z.array(weekday).min(1, "Elige al menos un dia")
});

export type HabitFormValues = z.infer<typeof habitFormSchema>;
