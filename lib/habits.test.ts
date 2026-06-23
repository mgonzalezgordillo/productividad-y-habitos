import { describe, expect, it } from "vitest";
import { defaultHabits, isHabitScheduled, schedulesForHabit, statusForValue } from "./habits";
import type { Habit } from "./types";

const baseHabit: Habit = {
  id: "h1",
  name: "Test",
  type: "BOOLEAN",
  icon: "Check",
  color: "#1689a4",
  startDate: "2026-06-01",
  sortOrder: 0,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("programacion semanal", () => {
  it("usa dias ISO y no programa martes si solo hay lunes, miercoles y viernes", () => {
    const schedules = schedulesForHabit("h1", [1, 3, 5]);
    expect(isHabitScheduled(baseHabit, schedules, "2026-06-22")).toBe(true);
    expect(isHabitScheduled(baseHabit, schedules, "2026-06-23")).toBe(false);
    expect(isHabitScheduled(baseHabit, schedules, "2026-06-24")).toBe(true);
  });

  it("ignora dias previos a creacion y posteriores a archivo", () => {
    const schedules = schedulesForHabit("h1");
    expect(isHabitScheduled(baseHabit, schedules, "2026-05-31")).toBe(false);
    expect(isHabitScheduled({ ...baseHabit, archivedAt: "2026-06-10T00:00:00.000Z" }, schedules, "2026-06-11")).toBe(false);
  });
});

describe("valores por tipo", () => {
  it("completa cantidad y duracion al alcanzar objetivo", () => {
    expect(statusForValue("QUANTITY", 3, 3)).toBe("COMPLETED");
    expect(statusForValue("DURATION", 6.75, 7)).toBe("PENDING");
    expect(statusForValue("DURATION", 7, 7)).toBe("COMPLETED");
  });

  it("crea el habito de sueno en horas", () => {
    const sleep = defaultHabits("2026-06-01").find((habit) => habit.id === "default-sleep-7h");
    expect(sleep?.targetValue).toBe(7);
    expect(sleep?.unit).toBe("horas");
  });
});
