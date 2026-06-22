import { describe, expect, it } from "vitest";
import { buildPeriod } from "./date";
import { schedulesForHabit } from "./habits";
import { calculatePeriodMetrics, calculateStreaks } from "./metrics";
import type { Habit, HabitEntry } from "./types";

const habit: Habit = {
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

const entry = (localDate: string, status: HabitEntry["status"]): HabitEntry => ({
  id: `${localDate}-${status}`,
  habitId: "h1",
  localDate,
  status,
  value: status === "COMPLETED" ? 1 : 0,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
});

describe("metricas", () => {
  it("calcula cumplimiento completed / (completed + missed)", () => {
    const metrics = calculatePeriodMetrics(
      [habit],
      schedulesForHabit("h1"),
      [entry("2026-06-20", "COMPLETED"), entry("2026-06-21", "SKIPPED"), entry("2026-06-22", "MISSED")],
      buildPeriod("30d", "2026-06-22")
    );
    expect(metrics.completionRate).toBe(0.5);
  });

  it("muestra sin datos suficientes si no hay completados ni fallados", () => {
    const metrics = calculatePeriodMetrics([habit], schedulesForHabit("h1"), [entry("2026-06-22", "SKIPPED")], buildPeriod("1d", "2026-06-22"));
    expect(metrics.completionRate).toBeNull();
  });

  it("calcula racha actual, mejor racha y recuperacion", () => {
    const streak = calculateStreaks(
      habit,
      schedulesForHabit("h1"),
      [
        entry("2026-06-18", "COMPLETED"),
        entry("2026-06-19", "COMPLETED"),
        entry("2026-06-20", "MISSED"),
        entry("2026-06-21", "COMPLETED"),
        entry("2026-06-22", "PENDING")
      ],
      "2026-06-22"
    );
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(2);
    expect(streak.recoveredDays).toBe(1);
  });
});
