import type { Habit, HabitSchedule, HabitType, WeekdayIso } from "./types";
import { isoWeekday, nowUtcIso } from "./date";
import { accountEmailForRecord, LOCAL_ACCOUNT } from "./account";

export const DEFAULT_COLOR = "#1689a4";
export const ALL_WEEKDAYS: WeekdayIso[] = [1, 2, 3, 4, 5, 6, 7];

const accountScopedDefaultId = (baseId: string, accountKey: string): string =>
  accountKey === LOCAL_ACCOUNT ? baseId : `${accountKey}:${baseId}`;

export const defaultHabits = (startDate: string, accountKey = LOCAL_ACCOUNT): Habit[] => {
  const now = nowUtcIso();
  const accountEmail = accountEmailForRecord(accountKey);
  return [
    {
      id: accountScopedDefaultId("default-sleep-7h", accountKey),
      accountEmail,
      name: "Dormir +7 horas",
      description: "Registrar el descanso principal del dia.",
      type: "DURATION",
      targetValue: 7,
      unit: "horas",
      icon: "Moon",
      color: "#196e85",
      minimumVersion: "Descansar unos minutos sin pantallas.",
      startDate,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: accountScopedDefaultId("default-make-bed", accountKey),
      accountEmail,
      name: "Hacer la cama",
      description: "Una accion breve para empezar con orden.",
      type: "BOOLEAN",
      icon: "Bed",
      color: "#1689a4",
      minimumVersion: "Estirar la manta principal.",
      startDate,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now
    },
    {
      id: accountScopedDefaultId("default-water-3l", accountKey),
      accountEmail,
      name: "Beber +3 litros de agua",
      description: "Registrar el agua total del dia.",
      type: "QUANTITY",
      targetValue: 3,
      unit: "litros",
      icon: "Droplet",
      color: "#17abc3",
      minimumVersion: "Beber un vaso de agua.",
      startDate,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now
    },
    {
      id: accountScopedDefaultId("default-sport", accountKey),
      accountEmail,
      name: "Hacer deporte",
      description: "Movimiento adaptado al dia.",
      type: "BOOLEAN",
      icon: "Dumbbell",
      color: "#1d5a6d",
      minimumVersion: "Caminar cinco minutos.",
      startDate,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now
    }
  ];
};

export const schedulesForHabit = (
  habitId: string,
  enabledDays: WeekdayIso[] = ALL_WEEKDAYS,
  accountKey = LOCAL_ACCOUNT
): HabitSchedule[] =>
  ALL_WEEKDAYS.map((dayOfWeek) => ({
    id: `${habitId}-${dayOfWeek}`,
    habitId,
    accountEmail: accountEmailForRecord(accountKey),
    dayOfWeek,
    enabled: enabledDays.includes(dayOfWeek)
  }));

export const isHabitActiveOnDate = (habit: Habit, localDate: string): boolean => {
  if (habit.deletedAt) return false;
  if (localDate < habit.startDate) return false;
  if (habit.endDate && localDate > habit.endDate) return false;
  if (habit.archivedAt && localDate > habit.archivedAt.slice(0, 10)) return false;
  return true;
};

export const isHabitScheduled = (
  habit: Habit,
  schedules: HabitSchedule[],
  localDate: string
): boolean => {
  if (!isHabitActiveOnDate(habit, localDate)) return false;
  const weekday = isoWeekday(localDate);
  return schedules.some(
    (schedule) =>
      schedule.habitId === habit.id && schedule.dayOfWeek === weekday && schedule.enabled
  );
};

export const statusForValue = (
  type: HabitType,
  value: number,
  targetValue?: number
): "PENDING" | "COMPLETED" => {
  if (type === "BOOLEAN") return value >= 1 ? "COMPLETED" : "PENDING";
  const target = targetValue ?? 1;
  return value >= target ? "COMPLETED" : "PENDING";
};

export const nextSortOrder = (habits: Habit[]): number =>
  habits.length ? Math.max(...habits.map((habit) => habit.sortOrder)) + 1 : 0;
