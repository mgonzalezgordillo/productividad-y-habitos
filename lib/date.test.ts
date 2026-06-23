import { describe, expect, it } from "vitest";
import {
  buildPeriod,
  currentOperationalDate,
  dayBoundaryUtc,
  expiredDatesSince,
  getLocalDateInZone,
  nextBoundaryAfter
} from "./date";

describe("fechas locales y cierre diario", () => {
  it.each([
    ["Europe/Madrid", "2026-06-22T21:30:00.000Z", "2026-06-22"],
    ["America/Mexico_City", "2026-06-22T05:30:00.000Z", "2026-06-21"],
    ["America/New_York", "2026-06-22T03:30:00.000Z", "2026-06-21"],
    ["Asia/Tokyo", "2026-06-21T16:00:00.000Z", "2026-06-22"]
  ])("calcula fecha local en %s", (timezone, instant, expected) => {
    expect(getLocalDateInZone(new Date(instant), timezone)).toBe(expected);
  });

  it("respeta cierre personalizado para horarios nocturnos", () => {
    const instant = new Date("2026-06-22T03:30:00.000Z");
    expect(currentOperationalDate(instant, "Europe/Madrid", "06:00")).toBe("2026-06-21");
  });

  it("maneja cambio de horario de verano en Europe/Madrid", () => {
    const boundary = dayBoundaryUtc("2026-03-28", "02:30", "Europe/Madrid");
    expect(boundary.toISOString()).toBe("2026-03-29T00:30:00.000Z");
  });

  it("devuelve varios dias vencidos al reabrir despues de dias cerrado", () => {
    const dates = expiredDatesSince(
      "2026-06-18",
      new Date("2026-06-22T02:00:00.000Z"),
      "Europe/Madrid",
      "00:00"
    );
    expect(dates).toContain("2026-06-18");
    expect(dates).toContain("2026-06-21");
  });

  it("calcula el siguiente cierre", () => {
    expect(nextBoundaryAfter(new Date("2026-06-22T10:00:00.000Z"), "Asia/Tokyo", "00:00").toISOString()).toBe(
      "2026-06-22T15:00:00.000Z"
    );
  });
});

describe("periodos", () => {
  it.each([
    ["1d", 1],
    ["30d", 30],
    ["90d", 90],
    ["365d", 365]
  ] as const)("construye %s", (kind, length) => {
    const period = buildPeriod(kind, "2026-06-22");
    expect(period.days).toHaveLength(length);
    expect(period.endDate).toBe("2026-06-22");
  });
});
