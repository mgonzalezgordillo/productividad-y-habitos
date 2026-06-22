import { describe, expect, it } from "vitest";
import { finalizeExpiredDaysData } from "./finalize";
import { schedulesForHabit } from "./habits";
import type { Habit, Settings } from "./types";

const settings: Settings = {
  id: "default",
  timezone: "Europe/Madrid",
  dayBoundaryTime: "00:00",
  locale: "es-ES",
  onboardingCompleted: true,
  allowHistoricalEditing: false,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

const habit: Habit = {
  id: "h1",
  name: "Lunes",
  type: "BOOLEAN",
  icon: "Check",
  color: "#1689a4",
  startDate: "2026-06-20",
  sortOrder: 0,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("finalizacion automatica", () => {
  it("crea MISSED para dias vencidos y es idempotente", () => {
    const first = finalizeExpiredDaysData([habit], schedulesForHabit("h1"), [], settings, new Date("2026-06-23T01:00:00.000Z"));
    const second = finalizeExpiredDaysData([habit], schedulesForHabit("h1"), first.entries, settings, new Date("2026-06-23T01:00:00.000Z"));
    expect(first.entries.length).toBeGreaterThan(0);
    expect(first.entries.every((entry) => entry.status === "MISSED")).toBe(true);
    expect(second.entries).toHaveLength(0);
  });

  it("respeta habitos archivados a mitad del periodo", () => {
    const archived = { ...habit, archivedAt: "2026-06-21T00:00:00.000Z" };
    const result = finalizeExpiredDaysData([archived], schedulesForHabit("h1"), [], settings, new Date("2026-06-24T01:00:00.000Z"));
    expect(result.entries.every((entry) => entry.localDate <= "2026-06-21")).toBe(true);
  });
});
