import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  parseISO,
  subDays
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { PeriodKind, PeriodRange, WeekdayIso } from "./types";

export const formatLocalDate = (date: Date): string => format(date, "yyyy-MM-dd");

export const parseLocalDate = (localDate: string): Date => parseISO(`${localDate}T00:00:00`);

export const isoWeekday = (localDate: string): WeekdayIso => {
  const day = parseLocalDate(localDate).getDay();
  return (day === 0 ? 7 : day) as WeekdayIso;
};

export const nowUtcIso = (): string => new Date().toISOString();

export const getLocalDateInZone = (instant: Date, timezone: string): string => {
  return formatLocalDate(toZonedTime(instant, timezone));
};

export const dayBoundaryUtc = (
  localDate: string,
  dayBoundaryTime: string,
  timezone: string
): Date => {
  const nextDate = addDays(parseLocalDate(localDate), 1);
  const wallTime = `${formatLocalDate(nextDate)}T${dayBoundaryTime}:00`;
  return fromZonedTime(wallTime, timezone);
};

export const isLocalDayExpired = (
  localDate: string,
  instant: Date,
  timezone: string,
  dayBoundaryTime: string
): boolean => instant.getTime() >= dayBoundaryUtc(localDate, dayBoundaryTime, timezone).getTime();

export const currentOperationalDate = (
  instant: Date,
  timezone: string,
  dayBoundaryTime: string
): string => {
  const zoned = toZonedTime(instant, timezone);
  const localDate = formatLocalDate(zoned);
  const boundaryToday = fromZonedTime(`${localDate}T${dayBoundaryTime}:00`, timezone);
  return instant.getTime() < boundaryToday.getTime()
    ? formatLocalDate(subDays(parseLocalDate(localDate), 1))
    : localDate;
};

export const expiredDatesSince = (
  fromLocalDate: string,
  instant: Date,
  timezone: string,
  dayBoundaryTime: string
): string[] => {
  const currentDate = getLocalDateInZone(instant, timezone);
  const days = eachDayOfInterval({
    start: parseLocalDate(fromLocalDate),
    end: parseLocalDate(currentDate)
  }).map(formatLocalDate);
  return days.filter((day) => isLocalDayExpired(day, instant, timezone, dayBoundaryTime));
};

export const nextBoundaryAfter = (
  instant: Date,
  timezone: string,
  dayBoundaryTime: string
): Date => {
  const localDate = getLocalDateInZone(instant, timezone);
  const todayBoundary = fromZonedTime(`${localDate}T${dayBoundaryTime}:00`, timezone);
  if (todayBoundary.getTime() > instant.getTime()) {
    return todayBoundary;
  }
  const tomorrow = formatLocalDate(addDays(parseLocalDate(localDate), 1));
  return fromZonedTime(`${tomorrow}T${dayBoundaryTime}:00`, timezone);
};

export const buildPeriod = (kind: PeriodKind, endDate: string): PeriodRange => {
  const span = kind === "1d" ? 1 : kind === "30d" ? 30 : kind === "90d" ? 90 : 365;
  const end = parseLocalDate(endDate);
  const start = subDays(end, span - 1);
  const days = eachDayOfInterval({ start, end }).map(formatLocalDate);
  return { kind, startDate: formatLocalDate(start), endDate, days };
};

export const shiftPeriod = (
  kind: PeriodKind,
  currentEndDate: string,
  direction: -1 | 1,
  today: string
): string => {
  const span = kind === "1d" ? 1 : kind === "30d" ? 30 : kind === "90d" ? 90 : 365;
  const shifted = addDays(parseLocalDate(currentEndDate), direction * span);
  const next = formatLocalDate(shifted);
  return next > today ? today : next;
};

export const daysBetweenInclusive = (startDate: string, endDate: string): string[] => {
  if (startDate > endDate) return [];
  return eachDayOfInterval({ start: parseLocalDate(startDate), end: parseLocalDate(endDate) }).map(
    formatLocalDate
  );
};

export const countDays = (startDate: string, endDate: string): number =>
  differenceInCalendarDays(parseLocalDate(endDate), parseLocalDate(startDate)) + 1;
