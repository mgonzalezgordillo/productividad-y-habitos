"use client";

import { create } from "zustand";
import { buildPeriod, currentOperationalDate } from "./date";
import type { PeriodKind, PeriodRange } from "./types";

interface UiState {
  section: "today" | "calendar" | "stats" | "habits" | "settings" | "help" | "privacy";
  selectedDate: string;
  periodKind: PeriodKind;
  period: PeriodRange;
  liveMessage: string;
  setSection: (section: UiState["section"]) => void;
  setSelectedDate: (date: string) => void;
  setPeriodKind: (kind: PeriodKind) => void;
  announce: (message: string) => void;
}

const detectedTimezone =
  typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
const initialDate = currentOperationalDate(new Date(), detectedTimezone || "UTC", "00:00");

export const useUiStore = create<UiState>((set) => ({
  section: "today",
  selectedDate: initialDate,
  periodKind: "30d",
  period: buildPeriod("30d", initialDate),
  liveMessage: "",
  setSection: (section) => set({ section }),
  setSelectedDate: (selectedDate) =>
    set((state) => ({ selectedDate, period: buildPeriod(state.periodKind, selectedDate) })),
  setPeriodKind: (periodKind) =>
    set((state) => ({ periodKind, period: buildPeriod(periodKind, state.selectedDate) })),
  announce: (liveMessage) => set({ liveMessage })
}));
