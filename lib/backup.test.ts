import { describe, expect, it } from "vitest";
import { exportPayloadSchema } from "./schemas";

describe("importacion y exportacion", () => {
  it("rechaza estados desconocidos", () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: "2026-06-22T00:00:00.000Z",
      settings: [],
      habits: [],
      habitSchedules: [],
      habitEntries: [{ id: "e1", habitId: "h1", localDate: "2026-06-22", status: "BAD", createdAt: "2026-06-22T00:00:00.000Z", updatedAt: "2026-06-22T00:00:00.000Z" }]
    };
    expect(exportPayloadSchema.safeParse(payload).success).toBe(false);
  });
});
