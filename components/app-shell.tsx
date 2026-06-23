"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as Label from "@radix-ui/react-label";
import * as Tooltip from "@radix-ui/react-tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Bed,
  CalendarDays,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  DatabaseBackup,
  Download,
  Droplet,
  Dumbbell,
  FileUp,
  Home,
  Moon,
  Pause,
  Plus,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Shield,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  createExportPayload,
  exportCsvBlob,
  exportJsonBlob,
  mergeData,
  parseImportFile,
  replaceAllData,
  saveAutomaticBackup
} from "@/lib/backup";
import { currentOperationalDate, formatLocalDate, nextBoundaryAfter, shiftPeriod } from "@/lib/date";
import { useAuth } from "@/components/auth-provider";
import { GoogleLogin } from "@/components/google-login";
import {
  ALL_WEEKDAYS,
  defaultHabits,
  isHabitScheduled,
  nextSortOrder,
  schedulesForHabit,
  statusForValue
} from "@/lib/habits";
import {
  bulkUpsertEntriesRemote,
  deleteHabitRemote,
  deleteEntryRemote,
  deleteWorkspaceRemote,
  ensureUserProfile,
  getLegacyLocalWorkspace,
  getWorkspaceSnapshot,
  type LegacyLocalWorkspace,
  clearLegacyLocalWorkspace,
  markLocalMigrationCompleted,
  saveSettingsRemote,
  watchWorkspace,
  upsertEntryRemote,
  upsertHabitRemote,
  upsertSchedulesRemote,
  type WorkspaceSnapshot
} from "@/lib/user-data";
import { calculatePeriodMetrics, calculateStreaks, computedStatusFor, getEntry } from "@/lib/metrics";
import { registerServiceWorker } from "@/lib/pwa";
import { habitFormSchema, type HabitFormValues } from "@/lib/schemas";
import { useUiStore } from "@/lib/store";
import type {
  EntryStatus,
  ExportPayload,
  Habit,
  HabitEntry,
  HabitSchedule,
  HabitType,
  PeriodKind,
  Settings
} from "@/lib/types";
import { finalizeExpiredDaysData } from "@/lib/finalize";

type Section = ReturnType<typeof useUiStore.getState>["section"];
type IconName = "Moon" | "Bed" | "Droplet" | "Dumbbell" | "Check" | "Clock3" | "Plus";

const iconMap: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  Moon,
  Bed,
  Droplet,
  Dumbbell,
  Check,
  Clock3,
  Plus
};

const sectionItems: { id: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "today", label: "Hoy", icon: Home },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "stats", label: "Estadisticas", icon: BarChart3 },
  { id: "habits", label: "Habitos", icon: Check },
  { id: "settings", label: "Ajustes", icon: SettingsIcon }
];

const allSections = [
  ...sectionItems,
  { id: "help" as const, label: "Ayuda", icon: CircleHelp },
  { id: "privacy" as const, label: "Privacidad", icon: Shield }
];

const onboardingSchema = z.object({
  timezone: z.string().min(1),
  dayBoundaryTime: z.string().regex(/^0[0-6]:[0-5]\d$/)
});

const todayIso = () => formatLocalDate(new Date());
const nowIso = () => new Date().toISOString();
const formatHoursLabel = (hours: number) => {
  const formatted = Number.isInteger(hours) ? String(hours) : String(hours).replace(".", ",");
  return `${formatted} ${hours === 1 ? "hora" : "horas"}`;
};
const durationHourOptions = [
  { value: 1.5, label: "Menos de 2 horas" },
  ...Array.from({ length: 15 }, (_, index) => {
    const hours = 2 + index * 0.5;
    return { value: hours, label: formatHoursLabel(hours) };
  }),
  { value: 9.5, label: "Más de 9 horas" }
];

const normalizeDurationSelectValue = (value: number): string => {
  if (!value) return "";
  if (value < 2) return "1.5";
  if (value > 9) return "9.5";
  return String(value);
};

const emptySettings = (): Settings => ({
  id: "current",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  dayBoundaryTime: "00:00",
  locale: "es-ES",
  onboardingCompleted: false,
  allowHistoricalEditing: false,
  createdAt: nowIso(),
  updatedAt: nowIso()
});

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const createWorkspaceSnapshot = (
  settings: Settings | null,
  habits: Habit[],
  habitSchedules: HabitSchedule[],
  habitEntries: HabitEntry[]
): WorkspaceSnapshot => ({
  settings,
  habits,
  habitSchedules,
  habitEntries
});

const statusInfo: Record<EntryStatus, { label: string; className: string; icon: React.ReactNode }> = {
  COMPLETED: {
    label: "Completado",
    className: "border-green-700 bg-green-50 text-green-800",
    icon: <Check className="h-4 w-4" aria-hidden />
  },
  MISSED: {
    label: "Incompleto",
    className: "border-red-700 bg-red-50 text-red-800",
    icon: <X className="h-4 w-4" aria-hidden />
  },
  PENDING: {
    label: "Pendiente",
    className: "border-turquoise-blue-300 bg-turquoise-blue-50 text-turquoise-blue-900",
    icon: <Clock3 className="h-4 w-4" aria-hidden />
  },
  SKIPPED: {
    label: "Omitido",
    className: "border-amber-700 bg-amber-50 text-amber-900",
    icon: <Pause className="h-4 w-4" aria-hidden />
  },
  NOT_SCHEDULED: {
    label: "No programado",
    className: "striped border-gray-400 text-gray-800",
    icon: <span aria-hidden>-</span>
  }
};

export function AppShell() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [schedules, setSchedules] = useState<HabitSchedule[]>([]);
  const [entries, setEntries] = useState<HabitEntry[]>([]);
  const { user, loading: authLoading, error: authError, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [migrationNeeded, setMigrationNeeded] = useState<LegacyLocalWorkspace | null>(null);
  const [migrationDismissed, setMigrationDismissed] = useState(false);
  const section = useUiStore((state) => state.section);
  const setSection = useUiStore((state) => state.setSection);
  const selectedDate = useUiStore((state) => state.selectedDate);
  const setSelectedDate = useUiStore((state) => state.setSelectedDate);
  const periodKind = useUiStore((state) => state.periodKind);
  const setPeriodKind = useUiStore((state) => state.setPeriodKind);
  const period = useUiStore((state) => state.period);
  const announce = useUiStore((state) => state.announce);
  const liveMessage = useUiStore((state) => state.liveMessage);
  const timerRef = useRef<number | null>(null);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!user) {
      setSettings(null);
      setHabits([]);
      setSchedules([]);
      setEntries([]);
      setMigrationNeeded(null);
      setMigrationDismissed(false);
      setLoading(false);
      return;
    }

    if (!options?.silent) {
      setLoading(true);
    }
    await ensureUserProfile(user.id, user.email, user.name, user.picture);
    const remoteWorkspace = await getWorkspaceSnapshot(user.id);
    const finalized = remoteWorkspace.settings
      ? finalizeExpiredDaysData(
          remoteWorkspace.habits,
          remoteWorkspace.habitSchedules,
          remoteWorkspace.habitEntries,
          remoteWorkspace.settings,
          new Date()
        )
      : { entries: [], checkedDates: [] };
    if (finalized.entries.length) {
      await bulkUpsertEntriesRemote(user.id, finalized.entries);
    }
    const nextWorkspace = finalized.entries.length
      ? { ...remoteWorkspace, habitEntries: [...remoteWorkspace.habitEntries, ...finalized.entries] }
      : remoteWorkspace;
    setSettings(nextWorkspace.settings);
    setHabits(nextWorkspace.habits);
    setSchedules(nextWorkspace.habitSchedules);
    setEntries(nextWorkspace.habitEntries);
    const legacyWorkspace = await getLegacyLocalWorkspace();
    setMigrationNeeded(
      !migrationDismissed &&
      (legacyWorkspace.settings.length || legacyWorkspace.habits.length || legacyWorkspace.habitSchedules.length || legacyWorkspace.habitEntries.length)
        ? legacyWorkspace
        : null
    );
    if (nextWorkspace.settings) {
      setSelectedDate(currentOperationalDate(new Date(), nextWorkspace.settings.timezone, nextWorkspace.settings.dayBoundaryTime));
    }
    if (!options?.silent) {
      setLoading(false);
    }
  }, [migrationDismissed, setSelectedDate, user]);

  useEffect(() => {
    void loadData();
    return registerServiceWorker(() => setUpdateAvailable(true));
  }, [loadData]);

  useEffect(() => {
    setMigrationDismissed(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = watchWorkspace(
      user.id,
      (workspace) => {
        setSettings(workspace.settings);
        setHabits(workspace.habits);
        setSchedules(workspace.habitSchedules);
        setEntries(workspace.habitEntries);
        if (workspace.settings) {
          setSelectedDate(currentOperationalDate(new Date(), workspace.settings.timezone, workspace.settings.dayBoundaryTime));
        }
      },
      (workspaceError) => setError(workspaceError.message)
    );
    const events = ["visibilitychange", "focus", "pageshow", "online"] as const;
    const refresh = () => {
      void loadData({ silent: true }).then(() => announce("Datos revisados tras recuperar la aplicacion."));
    };
    events.forEach((event) => window.addEventListener(event, refresh));
    if (settings?.onboardingCompleted) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const schedule = () => {
        const boundary = nextBoundaryAfter(new Date(), settings.timezone, settings.dayBoundaryTime);
        const delay = Math.max(1_000, boundary.getTime() - Date.now() + 1_000);
        timerRef.current = window.setTimeout(() => {
          void loadData().then(schedule);
        }, delay);
      };
      schedule();
    }
    return () => {
      unsubscribe();
      events.forEach((event) => window.removeEventListener(event, refresh));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [announce, loadData, setSelectedDate, settings?.dayBoundaryTime, settings?.onboardingCompleted, settings?.timezone, user]);

  const handleLegacyMigration = useCallback(
    async (mode: "merge" | "replace" | "skip") => {
      if (!user || !migrationNeeded) return;
      if (mode === "skip") {
        setMigrationNeeded(null);
        setMigrationDismissed(true);
        return;
      }
      const payload = await createExportPayload({
        settings: migrationNeeded.settings[0] ?? null,
        habits: migrationNeeded.habits,
        habitSchedules: migrationNeeded.habitSchedules,
        habitEntries: migrationNeeded.habitEntries
      });
      await saveAutomaticBackup(createWorkspaceSnapshot(settings, habits, schedules, entries), "pre-local-migration");
      if (mode === "replace") await replaceAllData(user.id, payload);
      else await mergeData(user.id, payload);
      await markLocalMigrationCompleted(user.id);
      setMigrationNeeded(null);
      setMigrationDismissed(true);
      await loadData();
    },
    [entries, habits, loadData, migrationNeeded, schedules, settings, user]
  );

  const orderedHabits = useMemo(
    () => habits.filter((habit) => !habit.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder),
    [habits]
  );

  if (authLoading || loading) {
    return <div className="grid min-h-screen place-items-center bg-turquoise-blue-50">Cargando datos de la cuenta...</div>;
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center bg-turquoise-blue-50 p-4">
        <section className="w-full max-w-2xl rounded-lg border border-turquoise-blue-100 bg-white p-6 shadow-soft">
          <p className="text-sm font-semibold text-turquoise-blue-700">Acceso</p>
          <h1 className="mt-2 text-3xl font-semibold">Inicia sesion para ver tus habitos</h1>
          <p className="mt-4 text-turquoise-blue-800">
            Tus datos se guardan bajo tu cuenta de Google y se sincronizan entre dispositivos. No se mostrara ningun dato privado hasta completar la sesion.
          </p>
          <div className="mt-6">
            <GoogleLogin />
          </div>
          {authError ? (
            <p className="mt-4 rounded-md border border-red-700 bg-red-50 p-3 text-sm text-red-900" role="alert">
              {authError}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  if (!settings?.onboardingCompleted) {
    return <Onboarding onComplete={loadData} existingHabits={habits} />;
  }

  const renderSection = () => {
    if (section === "today") {
      return (
        <TodayPanel
          settings={settings}
          habits={orderedHabits}
          schedules={schedules}
          entries={entries}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onReload={loadData}
          onError={setError}
        />
      );
    }
    if (section === "calendar") {
      return (
        <CalendarPanel
          settings={settings}
          habits={orderedHabits}
          schedules={schedules}
          entries={entries}
          periodKind={periodKind}
          setPeriodKind={setPeriodKind}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          period={period}
        />
      );
    }
    if (section === "stats") {
      return <StatsPanel habits={orderedHabits} schedules={schedules} entries={entries} period={period} />;
    }
    if (section === "habits") {
      return (
        <HabitsPanel
          habits={habits}
          schedules={schedules}
          entries={entries}
          onReload={loadData}
          onError={setError}
          settings={settings}
        />
      );
    }
    if (section === "settings") {
      return (
        <SettingsPanel
          settings={settings}
          workspace={createWorkspaceSnapshot(settings, habits, schedules, entries)}
          onSignedOut={() => void signOut().then(() => void loadData())}
          onReload={loadData}
          onSettings={setSettings}
          onError={setError}
          userEmail={user.email}
        />
      );
    }
    if (section === "privacy") return <PrivacyPanel />;
    return <HelpPanel />;
  };

  return (
    <Tooltip.Provider>
      <div className="min-h-screen bg-turquoise-blue-50 text-turquoise-blue-950">
        {migrationNeeded ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-turquoise-blue-950/40 p-4">
            <div className="w-full max-w-xl rounded-lg border border-turquoise-blue-100 bg-white p-6 shadow-soft">
              <p className="text-sm font-semibold text-turquoise-blue-700">Migracion local detectada</p>
              <h2 className="mt-2 text-2xl font-semibold">Hemos encontrado datos guardados en este dispositivo</h2>
              <p className="mt-3 text-turquoise-blue-800">
                Puedes asociarlos a tu cuenta para conservarlos en todos tus dispositivos. No se borraran hasta que elijas importar o cerrar esta pantalla.
              </p>
              <p className="mt-3 text-sm text-turquoise-blue-800">
                {migrationNeeded.habits.length} habitos, {migrationNeeded.habitEntries.length} registros y {migrationNeeded.habitSchedules.length} programaciones.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <button className="btn-primary" onClick={() => void handleLegacyMigration("merge")}>Asociar y sincronizar</button>
                <button className="btn-secondary" onClick={() => void handleLegacyMigration("replace")}>Reemplazar por completo</button>
                <button className="btn-secondary text-red-800" onClick={() => void handleLegacyMigration("skip")}>Empezar sin importar</button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex min-h-screen w-full max-w-7xl">
          <aside className="hidden w-64 shrink-0 border-r border-turquoise-blue-100 bg-white/90 p-4 lg:block">
            <div className="mb-8">
              <p className="text-lg font-semibold">Habitos</p>
              <p className="text-sm text-turquoise-blue-800">Sincronizado por cuenta</p>
              <div className="mt-4 rounded-md border border-turquoise-blue-100 bg-turquoise-blue-50 p-3 text-sm">
                <p className="font-medium">{user.name ?? user.email}</p>
                <p className="break-all text-turquoise-blue-800">{user.email}</p>
                <button className="mt-2 min-h-9 text-sm text-turquoise-blue-700 underline" onClick={() => void signOut().then(() => void loadData())}>
                  Cerrar sesion
                </button>
              </div>
            </div>
            <nav className="space-y-2" aria-label="Navegacion principal">
              {allSections.map((item) => (
                <NavButton key={item.id} item={item} selected={section === item.id} onClick={() => setSection(item.id)} />
              ))}
            </nav>
          </aside>
          <main className="min-w-0 flex-1 p-4 pb-24 lg:p-8">{renderSection()}</main>
        </div>
        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-turquoise-blue-100 bg-white lg:hidden"
          aria-label="Navegacion movil"
        >
          {sectionItems.map((item) => (
            <button
              key={item.id}
              className={`min-h-16 px-2 text-xs ${section === item.id ? "text-turquoise-blue-700" : "text-turquoise-blue-950"}`}
              onClick={() => setSection(item.id)}
            >
              <item.icon className="mx-auto h-5 w-5" aria-hidden />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sr-only" aria-live="polite">
          {liveMessage}
        </div>
        {error ? (
          <div role="alert" className="fixed bottom-20 left-4 right-4 z-40 rounded-lg border border-red-800 bg-red-50 p-4 text-red-900 shadow-soft lg:left-auto lg:w-96">
            <div className="flex items-start justify-between gap-3">
              <p>{error}</p>
              <button className="min-h-11 px-2 underline" onClick={() => setError(null)}>
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
        {updateAvailable ? (
          <div role="status" className="fixed right-4 top-4 z-40 rounded-lg border border-turquoise-blue-200 bg-white p-4 shadow-soft">
            <p className="font-medium">Nueva version disponible</p>
            <button className="mt-2 min-h-11 rounded-md bg-turquoise-blue-600 px-4 text-white" onClick={() => window.location.reload()}>
              Actualizar
            </button>
          </div>
        ) : null}
      </div>
    </Tooltip.Provider>
  );
}

function NavButton({
  item,
  selected,
  onClick
}: {
  item: { label: string; icon: React.ComponentType<{ className?: string }>; id: Section };
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left ${
        selected ? "bg-turquoise-blue-100 text-turquoise-blue-950" : "hover:bg-turquoise-blue-50"
      }`}
      onClick={onClick}
      aria-current={selected ? "page" : undefined}
    >
      <item.icon className="h-5 w-5" aria-hidden />
      <span>{item.label}</span>
    </button>
  );
}

function Onboarding({
  onComplete,
  existingHabits
}: {
  onComplete: () => Promise<void>;
  existingHabits: Habit[];
}) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      dayBoundaryTime: "00:00"
    }
  });

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    setSubmitting(true);
    const startDate = currentOperationalDate(new Date(), values.timezone, values.dayBoundaryTime);
    const settings: Settings = {
      ...emptySettings(),
      timezone: values.timezone,
      dayBoundaryTime: values.dayBoundaryTime,
      onboardingCompleted: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      userId: user.id
    };
    const seed = defaultHabits(startDate).filter((habit) => !existingHabits.some((existing) => existing.id === habit.id));
    await saveSettingsRemote(user.id, settings);
    await Promise.all(
      seed.map(async (habit) => {
        await upsertHabitRemote(user.id, { ...habit, userId: user.id });
        await upsertSchedulesRemote(user.id, schedulesForHabit(habit.id, ALL_WEEKDAYS).map((schedule) => ({ ...schedule, userId: user.id })));
      })
    );
    await onComplete();
  });

  return (
    <main className="grid min-h-screen place-items-center bg-turquoise-blue-50 p-4">
      <form onSubmit={submit} className="w-full max-w-2xl rounded-lg border border-turquoise-blue-100 bg-white p-6 shadow-soft">
        <p className="text-sm font-semibold text-turquoise-blue-700">Primer acceso</p>
        <h1 className="mt-2 text-3xl font-semibold">Registro de habitos sincronizado por cuenta</h1>
        <p className="mt-4 text-turquoise-blue-800">
          Tus datos se guardan bajo tu cuenta de Google. Si existen datos locales en este dispositivo, puedes asociarlos a tu cuenta para conservarlos en todos tus dispositivos.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Zona horaria" error={form.formState.errors.timezone?.message}>
            <input className="input" {...form.register("timezone")} list="timezones" />
            <datalist id="timezones">
              {["Europe/Madrid", "America/Mexico_City", "America/New_York", "Asia/Tokyo", "UTC"].map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </Field>
          <Field label="Final del dia" error={form.formState.errors.dayBoundaryTime?.message}>
            <input className="input" type="time" min="00:00" max="06:00" step="60" {...form.register("dayBoundaryTime")} />
          </Field>
        </div>
        <div className="mt-6 rounded-md border border-turquoise-blue-100 bg-turquoise-blue-50 p-4 text-sm text-turquoise-blue-900">
          Se crearan cuatro habitos iniciales: dormir +7 horas, hacer la cama, beber +3 litros de agua y hacer deporte. No se volveran a crear si ejecutas el onboarding otra vez.
        </div>
        <button disabled={submitting} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-md bg-turquoise-blue-600 px-5 font-medium text-white hover:bg-turquoise-blue-700 disabled:opacity-60">
          <Save className="h-5 w-5" aria-hidden />
          Abrir Hoy
        </button>
      </form>
    </main>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-turquoise-blue-950">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-red-800">{error}</span> : null}
    </label>
  );
}

function TodayPanel({
  settings,
  habits,
  schedules,
  entries,
  selectedDate,
  setSelectedDate,
  onReload,
  onError
}: {
  settings: Settings;
  habits: Habit[];
  schedules: HabitSchedule[];
  entries: HabitEntry[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  onReload: () => Promise<void>;
  onError: (error: string) => void;
}) {
  const setSection = useUiStore((state) => state.setSection);
  const announce = useUiStore((state) => state.announce);
  const today = currentOperationalDate(new Date(), settings.timezone, settings.dayBoundaryTime);
  const states = habits.map((habit) => ({
    habit,
    entry: getEntry(entries, habit.id, selectedDate),
    scheduled: isHabitScheduled(habit, schedules, selectedDate),
    status: computedStatusFor(habit, schedules, entries, selectedDate)
  }));
  const scheduled = states.filter((state) => state.scheduled);
  const completed = scheduled.filter((state) => state.status === "COMPLETED").length;
  const progress = scheduled.length ? Math.round((completed / scheduled.length) * 100) : 0;

  const moveDay = (offset: -1 | 1) => {
    const next = new Date(`${selectedDate}T00:00:00`);
    next.setDate(next.getDate() + offset);
    const nextDate = formatLocalDate(next);
    if (nextDate <= today) setSelectedDate(nextDate);
  };

  return (
    <section>
      <Header eyebrow="Panel Hoy" title={selectedDate === today ? "Hoy" : selectedDate} action={<button className="btn-secondary" onClick={() => setSection("settings")}><DatabaseBackup className="h-5 w-5" aria-hidden /> Copia</button>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{completed} de {scheduled.length} completados</p>
              <p className="text-sm text-turquoise-blue-800">Un registro sirve para observar, no para juzgar.</p>
            </div>
            <div className="flex gap-2">
              <IconButton label="Ayer" onClick={() => moveDay(-1)} icon={<ArrowLeft className="h-5 w-5" />} />
              <IconButton label="Hoy" onClick={() => setSelectedDate(today)} icon={<Home className="h-5 w-5" />} />
              <IconButton label="Manana" onClick={() => moveDay(1)} icon={<ArrowRight className="h-5 w-5" />} disabled={selectedDate >= today} />
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-turquoise-blue-100" aria-label={`Progreso ${progress}%`}>
            <div className="h-3 rounded-full bg-turquoise-blue-600" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
          <p className="font-semibold">Cierre diario</p>
          <p className="mt-2 text-sm text-turquoise-blue-800">
            Si la aplicación permanece cerrada, los hábitos pendientes se marcarán como incompletos la próxima vez que se abra.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4">
        {states.map((state) => (
          <HabitCard
            key={state.habit.id}
            settings={settings}
            habit={state.habit}
            schedules={schedules}
            entry={state.entry}
            status={state.status}
            selectedDate={selectedDate}
            onReload={onReload}
            onError={onError}
            onAnnounce={announce}
          />
        ))}
        <button className="btn-primary w-fit" onClick={() => setSection("habits")}>
          <Plus className="h-5 w-5" aria-hidden /> Añadir habito
        </button>
      </div>
    </section>
  );
}

function HabitCard({
  settings,
  habit,
  schedules,
  entry,
  status,
  selectedDate,
  onReload,
  onError,
  onAnnounce
}: {
  settings: Settings;
  habit: Habit;
  schedules: HabitSchedule[];
  entry?: HabitEntry;
  status: EntryStatus;
  selectedDate: string;
  onReload: () => Promise<void>;
  onError: (error: string) => void;
  onAnnounce: (message: string) => void;
}) {
  const { user } = useAuth();
  const [draftValue, setDraftValue] = useState(String(entry?.value ?? ""));
  const [draftNote, setDraftNote] = useState(entry?.note ?? "");
  const [lastEntry, setLastEntry] = useState<HabitEntry | undefined>();
  const Icon = iconMap[habit.icon] ?? Check;
  const info = statusInfo[status];
  const editable = selectedDate <= currentOperationalDate(new Date(), settings.timezone, settings.dayBoundaryTime) && (settings.allowHistoricalEditing || selectedDate >= todayIso());

  useEffect(() => {
    setDraftValue(String(entry?.value ?? ""));
    setDraftNote(entry?.note ?? "");
  }, [entry?.id, entry?.value, entry?.note]);

  const writeEntry = async (value: number, nextStatus?: EntryStatus, note = draftNote) => {
    if (!editable || status === "NOT_SCHEDULED" || !user) return;
    const previous = entry;
    setLastEntry(previous);
    const now = nowIso();
    const computed = nextStatus ?? statusForValue(habit.type, value, habit.targetValue);
    const nextEntry: HabitEntry = {
      id: previous?.id ?? crypto.randomUUID(),
      habitId: habit.id,
      userId: user.id,
      localDate: selectedDate,
      status: computed,
      value,
      note: note || undefined,
      completedAt: computed === "COMPLETED" ? previous?.completedAt ?? now : undefined,
      finalizedAt: computed === "MISSED" ? previous?.finalizedAt ?? now : previous?.finalizedAt,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now
    };
    try {
      await upsertEntryRemote(user.id, nextEntry);
      await onReload();
      onAnnounce(`${habit.name}: ${statusInfo[computed].label}`);
    } catch {
      onError("No se pudo guardar el registro. Revisa el dato y vuelve a intentarlo.");
      if (previous) await upsertEntryRemote(user.id, previous);
    }
  };

  const undo = async () => {
    if (!user) return;
    try {
      if (lastEntry) await upsertEntryRemote(user.id, lastEntry);
      else if (entry) await deleteEntryRemote(user.id, entry.id);
      await onReload();
      onAnnounce("Accion deshecha.");
    } catch {
      onError("No se pudo deshacer la accion.");
    }
  };

  const increment = habit.type === "QUANTITY" ? 0.25 : 1;
  const value = Number(draftValue || entry?.value || 0);
  const durationValue = normalizeDurationSelectValue(value);

  return (
    <article className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border" style={{ color: habit.color, borderColor: habit.color }}>
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{habit.name}</h2>
            <p className="text-sm text-turquoise-blue-800">{habit.description || "Sin descripcion"}</p>
            <p className="mt-1 text-sm text-turquoise-blue-800">Frecuencia: {scheduleText(schedules.filter((schedule) => schedule.habitId === habit.id))}</p>
          </div>
        </div>
        <span className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-3 text-sm ${info.className}`}>
          {info.icon}
          {info.label}
        </span>
      </div>
      {habit.minimumVersion ? (
        <p className="mt-4 rounded-md bg-turquoise-blue-50 p-3 text-sm text-turquoise-blue-900">
          Version minima: {habit.minimumVersion}
        </p>
      ) : null}
      {status === "NOT_SCHEDULED" ? (
        <p className="mt-4 text-sm text-turquoise-blue-800">Este habito no correspondia en esta fecha.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          {habit.type === "BOOLEAN" ? (
            <button className={status === "COMPLETED" ? "btn-secondary" : "btn-primary"} disabled={!editable} onClick={() => writeEntry(status === "COMPLETED" ? 0 : 1, status === "COMPLETED" ? "PENDING" : "COMPLETED")}>
              <Check className="h-5 w-5" aria-hidden />
              {status === "COMPLETED" ? "Desmarcar" : "Completar"}
            </button>
          ) : habit.type === "DURATION" ? (
            <div className="flex flex-wrap gap-2">
              <label className="min-w-48">
                <select
                  aria-label={`Horas de ${habit.name}`}
                  className="input"
                  value={durationValue}
                  disabled={!editable}
                  onChange={(event) => setDraftValue(event.target.value)}
                >
                  <option value="">Selecciona horas</option>
                  {durationHourOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn-primary"
                disabled={!editable || !draftValue}
                onClick={() => writeEntry(Number(draftValue || 0))}
              >
                Guardar
              </button>
              <span className="self-center text-sm text-turquoise-blue-800">
                Objetivo: {habit.targetValue} {habit.unit}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input aria-label={`Valor de ${habit.name}`} className="input max-w-36" inputMode="decimal" value={draftValue} onChange={(event) => setDraftValue(event.target.value)} />
              <button className="btn-secondary" disabled={!editable} onClick={() => { const next = Math.max(0, value - increment); setDraftValue(String(next)); void writeEntry(next); }}>-</button>
              <button className="btn-secondary" disabled={!editable} onClick={() => { const next = value + increment; setDraftValue(String(next)); void writeEntry(next); }}>+</button>
              <button className="btn-primary" disabled={!editable} onClick={() => writeEntry(Number(draftValue || 0))}>Guardar</button>
              <span className="self-center text-sm text-turquoise-blue-800">Objetivo: {habit.targetValue} {habit.unit}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary text-red-800"
              disabled={!editable}
              onClick={() => writeEntry(entry?.value ?? value, "MISSED")}
            >
              <X className="h-5 w-5" aria-hidden /> No completado
            </button>
            <button className="btn-secondary" disabled={!editable} onClick={() => writeEntry(entry?.value ?? 0, "SKIPPED")}>
              <Pause className="h-5 w-5" aria-hidden /> Omitir
            </button>
            <button className="btn-secondary" disabled={!entry} onClick={undo}>
              <Undo2 className="h-5 w-5" aria-hidden /> Deshacer
            </button>
          </div>
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium">Nota</span>
            <textarea className="input min-h-20" value={draftNote} onChange={(event) => setDraftNote(event.target.value)} onBlur={() => void writeEntry(entry?.value ?? value, undefined, draftNote)} />
          </label>
        </div>
      )}
    </article>
  );
}

function CalendarPanel({
  habits,
  schedules,
  entries,
  periodKind,
  setPeriodKind,
  selectedDate,
  setSelectedDate,
  period,
  settings
}: {
  habits: Habit[];
  schedules: HabitSchedule[];
  entries: HabitEntry[];
  periodKind: PeriodKind;
  setPeriodKind: (kind: PeriodKind) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  period: ReturnType<typeof import("@/lib/date").buildPeriod>;
  settings: Settings;
}) {
  const today = currentOperationalDate(new Date(), settings.timezone, settings.dayBoundaryTime);
  const selectedStates = habits.map((habit) => ({
    habit,
    status: computedStatusFor(habit, schedules, entries, selectedDate),
    entry: getEntry(entries, habit.id, selectedDate),
    scheduled: isHabitScheduled(habit, schedules, selectedDate)
  }));
  return (
    <section>
      <Header eyebrow="Calendario" title="Estados por fecha" />
      <div className="mb-4 flex flex-wrap gap-2">
        {(["1d", "30d", "90d", "365d"] as PeriodKind[]).map((kind) => (
          <button key={kind} className={periodKind === kind ? "btn-primary" : "btn-secondary"} onClick={() => setPeriodKind(kind)}>
            {kind === "1d" ? "1 dia" : kind.replace("d", " dias")}
          </button>
        ))}
        <IconButton label="Periodo anterior" icon={<ArrowLeft className="h-5 w-5" />} onClick={() => setSelectedDate(shiftPeriod(periodKind, selectedDate, -1, today))} />
        <IconButton label="Periodo siguiente" icon={<ArrowRight className="h-5 w-5" />} disabled={selectedDate >= today} onClick={() => setSelectedDate(shiftPeriod(periodKind, selectedDate, 1, today))} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 xl:grid-cols-14">
        {period.days.map((day) => {
          const dayStates = habits.map((habit) => computedStatusFor(habit, schedules, entries, day));
          const completed = dayStates.filter((status) => status === "COMPLETED").length;
          const scheduled = dayStates.filter((status) => status !== "NOT_SCHEDULED").length;
          return (
            <button
              key={day}
              className={`min-h-24 rounded-md border bg-white p-2 text-left shadow-sm ${selectedDate === day ? "border-turquoise-blue-600" : "border-turquoise-blue-100"}`}
              onClick={() => setSelectedDate(day)}
              aria-label={`${day}: ${completed} de ${scheduled} completados`}
            >
              <span className="block text-sm font-medium">{day.slice(5)}</span>
              <span className="mt-1 block text-xs text-turquoise-blue-800">{completed} de {scheduled}</span>
              <span className="mt-2 flex flex-wrap gap-1">
                {dayStates.slice(0, 6).map((status, index) => (
                  <span key={`${day}-${index}`} className={`grid h-6 w-6 place-items-center rounded border text-xs ${statusInfo[status].className}`} aria-label={statusInfo[status].label}>
                    {statusInfo[status].icon}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-6 rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-semibold">Detalle de {selectedDate}</h2>
        <div className="mt-4 grid gap-3">
          {selectedStates.map(({ habit, status, entry, scheduled }) => (
            <div key={habit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-turquoise-blue-100 p-3">
              <div>
                <p className="font-medium">{habit.name}</p>
                <p className="text-sm text-turquoise-blue-800">Valor: {entry?.value ?? 0} / {habit.targetValue ?? 1} {habit.unit ?? ""}</p>
                <p className="text-sm text-turquoise-blue-800">Cierre: {settings.dayBoundaryTime} ({settings.timezone})</p>
                {entry?.note ? <p className="text-sm text-turquoise-blue-800">Nota: {entry.note}</p> : null}
              </div>
              <span className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-3 text-sm ${statusInfo[scheduled ? status : "NOT_SCHEDULED"].className}`}>
                {statusInfo[scheduled ? status : "NOT_SCHEDULED"].icon}
                {statusInfo[scheduled ? status : "NOT_SCHEDULED"].label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsPanel({
  habits,
  schedules,
  entries,
  period
}: {
  habits: Habit[];
  schedules: HabitSchedule[];
  entries: HabitEntry[];
  period: ReturnType<typeof import("@/lib/date").buildPeriod>;
}) {
  const metrics = calculatePeriodMetrics(habits, schedules, entries, period);
  const rows = habits.map((habit) => ({
    habit,
    metrics: calculatePeriodMetrics(habits, schedules, entries, period, [habit.id]),
    streak: calculateStreaks(habit, schedules, entries, period.endDate)
  }));
  return (
    <section>
      <Header eyebrow="Estadisticas" title="Tendencias y rachas" />
      <p className="mb-4 rounded-md border border-turquoise-blue-100 bg-white p-4 text-turquoise-blue-900">
        El registro sirve para observar tu comportamiento, no para medir tu valor personal.
      </p>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Programados" value={metrics.scheduled} />
        <Stat label="Completados" value={metrics.completed} />
        <Stat label="Incompletos" value={metrics.missed} />
        <Stat label="Cumplimiento" value={metrics.completionRate == null ? "Sin datos suficientes" : `${Math.round(metrics.completionRate * 100)} %`} />
      </div>
      <div className="mt-6 rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
        <h2 className="text-xl font-semibold">Tabla equivalente de graficos</h2>
        <div role="img" aria-label="Distribucion textual de estados por habito en el periodo seleccionado" className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-turquoise-blue-100">
                <th className="py-2">Habito</th>
                <th>Completados</th>
                <th>Incompletos</th>
                <th>Omitidos</th>
                <th>Pendientes</th>
                <th>Racha actual</th>
                <th>Mejor racha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.habit.id} className="border-b border-turquoise-blue-50">
                  <td className="py-2 font-medium">{row.habit.name}</td>
                  <td>{row.metrics.completed}</td>
                  <td>{row.metrics.missed}</td>
                  <td>{row.metrics.skipped}</td>
                  <td>{row.metrics.pending}</td>
                  <td>{row.streak.current}</td>
                  <td>{row.streak.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function HabitsPanel({
  habits,
  schedules,
  entries,
  onReload,
  onError,
  settings
}: {
  habits: Habit[];
  schedules: HabitSchedule[];
  entries: HabitEntry[];
  onReload: () => Promise<void>;
  onError: (error: string) => void;
  settings: Settings;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Habit | null>(null);
  const [open, setOpen] = useState(false);
  const visible = habits.filter((habit) => !habit.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
  const deleted = habits.filter((habit) => habit.deletedAt);

  const move = async (habit: Habit, direction: -1 | 1) => {
    if (!user) return;
    const index = visible.findIndex((item) => item.id === habit.id);
    const other = visible[index + direction];
    if (!other) return;
    await Promise.all([
      upsertHabitRemote(user.id, { ...habit, sortOrder: other.sortOrder, updatedAt: nowIso(), userId: user.id }),
      upsertHabitRemote(user.id, { ...other, sortOrder: habit.sortOrder, updatedAt: nowIso(), userId: user.id })
    ]);
    await onReload();
  };

  const duplicate = async (habit: Habit) => {
    if (!user) return;
    const id = crypto.randomUUID();
    const now = nowIso();
    await upsertHabitRemote(user.id, {
      ...habit,
      id,
      userId: user.id,
      name: `${habit.name} copia`,
      sortOrder: nextSortOrder(habits),
      createdAt: now,
      updatedAt: now,
      archivedAt: undefined,
      deletedAt: undefined
    });
    await upsertSchedulesRemote(
      user.id,
      schedules
        .filter((schedule) => schedule.habitId === habit.id)
        .map((schedule) => ({ ...schedule, id: `${id}-${schedule.dayOfWeek}`, habitId: id, userId: user.id }))
    );
    await onReload();
  };

  const updateStamp = async (habit: Habit, patch: Partial<Habit>) => {
    if (!user) return;
    await upsertHabitRemote(user.id, { ...habit, ...patch, updatedAt: nowIso(), userId: user.id });
    await onReload();
  };

  const permanentDelete = async (habit: Habit) => {
    if (!user) return;
    if (!window.confirm(`Eliminar definitivamente "${habit.name}" y sus registros?`)) return;
    await saveAutomaticBackup(createWorkspaceSnapshot(settings, habits, schedules, entries), "pre-permanent-delete");
    await deleteHabitRemote(user.id, habit.id);
    await onReload();
  };

  return (
    <section>
      <Header eyebrow="Habitos" title="Gestion de habitos" action={<button className="btn-primary" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-5 w-5" aria-hidden /> Crear</button>} />
      <div className="grid gap-3">
        {visible.map((habit) => (
          <article key={habit.id} className={`rounded-lg border border-turquoise-blue-100 bg-white p-4 shadow-soft ${habit.archivedAt ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{habit.name}</h2>
                <p className="text-sm text-turquoise-blue-800">{habit.type} · {scheduleText(schedules.filter((schedule) => schedule.habitId === habit.id))}</p>
                {habit.archivedAt ? <p className="text-sm text-amber-900">Archivado</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <IconButton label="Subir" icon={<ArrowUp className="h-5 w-5" />} onClick={() => move(habit, -1)} />
                <IconButton label="Bajar" icon={<ArrowDown className="h-5 w-5" />} onClick={() => move(habit, 1)} />
                <IconButton label="Duplicar" icon={<Copy className="h-5 w-5" />} onClick={() => duplicate(habit)} />
                <button className="btn-secondary" onClick={() => { setEditing(habit); setOpen(true); }}>Editar</button>
                {habit.archivedAt ? (
                  <button className="btn-secondary" onClick={() => updateStamp(habit, { archivedAt: undefined })}><RotateCcw className="h-5 w-5" aria-hidden /> Restaurar</button>
                ) : (
                  <button className="btn-secondary" onClick={() => updateStamp(habit, { archivedAt: nowIso() })}><Archive className="h-5 w-5" aria-hidden /> Archivar</button>
                )}
                <button className="btn-secondary text-red-800" onClick={() => updateStamp(habit, { deletedAt: nowIso() })}><Trash2 className="h-5 w-5" aria-hidden /> Borrado logico</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {deleted.length ? (
        <div className="mt-8 rounded-lg border border-red-100 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-semibold">Eliminados logicamente</h2>
          <div className="mt-4 grid gap-3">
            {deleted.map((habit) => (
              <div key={habit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-100 p-3">
                <span>{habit.name}</span>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => updateStamp(habit, { deletedAt: undefined })}>Restaurar</button>
                  <button className="btn-secondary text-red-800" onClick={() => permanentDelete(habit)}>Eliminar definitivo</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <HabitDialog open={open} onOpenChange={setOpen} habit={editing} schedules={schedules} habits={habits} settings={settings} onReload={onReload} onError={onError} />
    </section>
  );
}

function HabitDialog({
  open,
  onOpenChange,
  habit,
  schedules,
  habits,
  settings,
  onReload,
  onError
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  schedules: HabitSchedule[];
  habits: Habit[];
  settings: Settings;
  onReload: () => Promise<void>;
  onError: (error: string) => void;
}) {
  const { user } = useAuth();
  const habitSchedules = habit ? schedules.filter((schedule) => schedule.habitId === habit.id && schedule.enabled).map((schedule) => schedule.dayOfWeek) : ALL_WEEKDAYS;
  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitFormSchema),
    values: {
      name: habit?.name ?? "",
      description: habit?.description ?? "",
      type: habit?.type ?? "BOOLEAN",
      targetValue: habit?.targetValue ?? 1,
      unit: habit?.unit ?? "",
      icon: habit?.icon ?? "Check",
      color: habit?.color ?? "#1689a4",
      minimumVersion: habit?.minimumVersion ?? "",
      startDate: habit?.startDate ?? currentOperationalDate(new Date(), settings.timezone, settings.dayBoundaryTime),
      endDate: habit?.endDate ?? "",
      scheduleDays: habitSchedules
    }
  });
  const selectedScheduleDays = form.watch("scheduleDays");

  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    const now = nowIso();
    const id = habit?.id ?? crypto.randomUUID();
    const nextHabit: Habit = {
      id,
      userId: user.id,
      name: values.name,
      description: values.description || undefined,
      type: values.type as HabitType,
      targetValue: values.type === "BOOLEAN" ? undefined : values.targetValue,
      unit: values.unit || (values.type === "DURATION" ? "horas" : undefined),
      icon: values.icon as IconName,
      color: values.color,
      minimumVersion: values.minimumVersion || undefined,
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      archivedAt: habit?.archivedAt,
      deletedAt: habit?.deletedAt,
      sortOrder: habit?.sortOrder ?? nextSortOrder(habits),
      createdAt: habit?.createdAt ?? now,
      updatedAt: now
    };
    try {
      await upsertHabitRemote(user.id, nextHabit);
      await upsertSchedulesRemote(
        user.id,
        schedulesForHabit(id, values.scheduleDays).map((schedule) => ({
          ...schedule,
          userId: user.id
        }))
      );
      onOpenChange(false);
      await onReload();
    } catch {
      onError("No se pudo guardar el habito.");
    }
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-turquoise-blue-950/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-white p-6 shadow-soft">
          <Dialog.Title className="text-2xl font-semibold">{habit ? "Editar habito" : "Crear habito"}</Dialog.Title>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <Field label="Nombre" error={form.formState.errors.name?.message}><input className="input" {...form.register("name")} /></Field>
            <Field label="Descripcion"><textarea className="input min-h-20" {...form.register("description")} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tipo"><select className="input" {...form.register("type")}><option value="BOOLEAN">Booleano</option><option value="QUANTITY">Cantidad</option><option value="DURATION">Duracion</option><option value="COUNTER">Contador</option></select></Field>
              <Field label="Objetivo"><input className="input" type="number" step="0.01" {...form.register("targetValue")} /></Field>
              <Field label="Unidad"><input className="input" {...form.register("unit")} /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Icono"><select className="input" {...form.register("icon")}><option>Check</option><option>Moon</option><option>Bed</option><option>Droplet</option><option>Dumbbell</option><option>Clock3</option><option>Plus</option></select></Field>
              <Field label="Color"><input className="input h-11" type="color" {...form.register("color")} /></Field>
              <Field label="Inicio"><input className="input" type="date" {...form.register("startDate")} /></Field>
            </div>
            <Field label="Fecha final opcional"><input className="input" type="date" {...form.register("endDate")} /></Field>
            <Field label="Version minima para dias dificiles"><input className="input" {...form.register("minimumVersion")} /></Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Dias de la semana</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
                {ALL_WEEKDAYS.map((day) => (
                  <label key={day} className="flex min-h-11 items-center gap-2 rounded-md border border-turquoise-blue-100 px-3">
                    <input
                      type="checkbox"
                      checked={selectedScheduleDays.includes(day)}
                      onChange={(event) => {
                        const current = new Set(form.getValues("scheduleDays"));
                        if (event.target.checked) current.add(day);
                        else current.delete(day);
                        form.setValue("scheduleDays", Array.from(current).sort() as HabitFormValues["scheduleDays"], {
                          shouldDirty: true,
                          shouldValidate: true
                        });
                      }}
                    />
                    <span>{["L", "M", "X", "J", "V", "S", "D"][day - 1]}</span>
                  </label>
                ))}
              </div>
              {form.formState.errors.scheduleDays ? <p className="mt-1 text-sm text-red-800">{form.formState.errors.scheduleDays.message}</p> : null}
            </fieldset>
            <div className="flex justify-end gap-2">
              <Dialog.Close className="btn-secondary" type="button">Cancelar</Dialog.Close>
              <button className="btn-primary" type="submit"><Save className="h-5 w-5" aria-hidden /> Guardar</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingsPanel({
  settings,
  workspace,
  onSignedOut,
  onReload,
  onSettings,
  onError,
  userEmail
}: {
  settings: Settings;
  workspace: WorkspaceSnapshot;
  onSignedOut: () => void;
  onReload: () => Promise<void>;
  onSettings: (settings: Settings) => void;
  onError: (error: string) => void;
  userEmail: string;
}) {
  const { user } = useAuth();
  const [importPayload, setImportPayload] = useState<ExportPayload | null>(null);
  const [summary, setSummary] = useState("");

  const updateSettings = async (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch, updatedAt: nowIso() };
    if (!user) return;
    await saveSettingsRemote(user.id, { ...next, userId: user.id });
    onSettings(next);
    await onReload();
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const payload = await parseImportFile(file);
      setImportPayload(payload);
      setSummary(`${payload.habits.length} habitos, ${payload.habitEntries.length} registros, ${payload.habitSchedules.length} programaciones.`);
    } catch (importError) {
      onError(importError instanceof Error ? importError.message : "Archivo invalido.");
    }
  };

  const applyImport = async (mode: "merge" | "replace") => {
    if (!importPayload) return;
    if (!window.confirm(mode === "replace" ? "Sustituir todos los datos existentes?" : "Fusionar datos importados con los actuales?")) return;
    try {
      if (!user) return;
      if (mode === "replace") await replaceAllData(user.id, importPayload, workspace);
      else await mergeData(user.id, importPayload, workspace);
      setImportPayload(null);
      await onReload();
    } catch {
      onError("La importacion fallo. Se conserva el respaldo automatico anterior.");
    }
  };

  const deleteAll = async () => {
    if (!user) return;
    if (!window.confirm("Eliminar todos los datos locales? Exporta una copia antes si quieres conservarlos.")) return;
    await saveAutomaticBackup(workspace, "pre-delete-all");
    await deleteWorkspaceRemote(user.id);
    await clearLegacyLocalWorkspace();
    await onSignedOut();
  };

  return (
    <section>
      <Header eyebrow="Ajustes" title="Cuenta, datos y preferencias" />
      <div className="grid gap-4 lg:grid-cols-2">
        {user ? (
          <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft lg:col-span-2">
            <h2 className="text-xl font-semibold">Cuenta</h2>
            <p className="mt-2 text-sm text-turquoise-blue-800">
              Datos sincronizados para {userEmail}.
            </p>
            <button className="mt-4 btn-secondary" onClick={() => void onSignedOut()}>
              Cerrar sesion
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft lg:col-span-2">
            <GoogleLogin />
          </div>
        )}
        <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-semibold">Preferencias</h2>
          <div className="mt-4 grid gap-4">
            <Field label="Zona horaria"><input className="input" value={settings.timezone} onChange={(event) => void updateSettings({ timezone: event.target.value })} /></Field>
            <Field label="Final del dia"><input className="input" type="time" min="00:00" max="06:00" value={settings.dayBoundaryTime} onChange={(event) => void updateSettings({ dayBoundaryTime: event.target.value })} /></Field>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={settings.allowHistoricalEditing} onChange={(event) => void updateSettings({ allowHistoricalEditing: event.target.checked })} />
              Permitir edicion de fechas anteriores
            </label>
          </div>
        </div>
        <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
          <h2 className="text-xl font-semibold">Copias de seguridad</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => void exportJsonBlob(workspace).then((blob) => downloadBlob(blob, `habitos-${todayIso()}.json`))}><Download className="h-5 w-5" aria-hidden /> JSON</button>
            <button className="btn-secondary" onClick={() => void exportCsvBlob(workspace).then((blob) => downloadBlob(blob, `historial-${todayIso()}.csv`))}><Download className="h-5 w-5" aria-hidden /> CSV</button>
            <Label.Root className="btn-secondary cursor-pointer"><FileUp className="h-5 w-5" aria-hidden /> Importar<input className="sr-only" type="file" accept="application/json" onChange={(event) => void handleImport(event.target.files?.[0])} /></Label.Root>
          </div>
          {summary ? (
            <div className="mt-4 rounded-md border border-turquoise-blue-100 p-3">
              <p>Resumen: {summary}</p>
              <div className="mt-3 flex gap-2">
                <button className="btn-secondary" onClick={() => void applyImport("merge")}>Fusionar</button>
                <button className="btn-secondary text-red-800" onClick={() => void applyImport("replace")}>Reemplazar</button>
              </div>
            </div>
          ) : null}
          <button className="mt-6 btn-secondary text-red-800" onClick={() => void deleteAll()}><Trash2 className="h-5 w-5" aria-hidden /> Eliminar todos los datos</button>
        </div>
      </div>
    </section>
  );
}

function HelpPanel() {
  return (
    <section>
      <Header eyebrow="Ayuda" title="Uso y limites" />
      <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
        <p>La aplicacion necesita iniciar sesion con Google para cargar el espacio correcto de datos.</p>
        <p className="mt-3">Si la aplicación permanece cerrada, los hábitos pendientes se marcarán como incompletos la próxima vez que se abra.</p>
        <p className="mt-3">La PWA puede hacer comprobaciones oportunistas, pero un navegador cerrado no garantiza ejecucion a medianoche.</p>
      </div>
    </section>
  );
}

function PrivacyPanel() {
  return (
    <section>
      <Header eyebrow="Privacidad" title="Datos en tu dispositivo" />
      <div className="space-y-3 rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
        <p>Se usa tu cuenta de Google para separar tus datos del resto de usuarios.</p>
        <p>Los datos se guardan en Firestore bajo tu UID y también pueden mantener una copia local de respaldo.</p>
        <p>Borrar los datos del navegador puede eliminar el historial o la copia local.</p>
        <p>Debes exportar copias de seguridad si quieres conservar o trasladar los datos manualmente.</p>
        <p>Los datos se sincronizan entre dispositivos cuando inicias sesion con la misma cuenta.</p>
        <p>No hay analitica de terceros, publicidad ni pixeles de seguimiento por defecto.</p>
        <p>Esta aplicación ayuda a registrar hábitos y no sustituye asesoramiento médico.</p>
      </div>
    </section>
  );
}

function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-turquoise-blue-700">{eyebrow}</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
      </div>
      {action}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-turquoise-blue-100 bg-white p-5 shadow-soft">
      <p className="text-sm text-turquoise-blue-800">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled
}: {
  label: string;
  icon: React.ReactElement;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button className="grid min-h-11 min-w-11 place-items-center rounded-md border border-turquoise-blue-200 bg-white text-turquoise-blue-950 disabled:opacity-50" onClick={onClick} disabled={disabled} aria-label={label}>
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="rounded bg-turquoise-blue-950 px-2 py-1 text-sm text-white" sideOffset={4}>
          {label}
          <Tooltip.Arrow className="fill-turquoise-blue-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function scheduleText(schedules: HabitSchedule[]) {
  const enabled = schedules.filter((schedule) => schedule.enabled).map((schedule) => schedule.dayOfWeek).sort();
  if (enabled.length === 7) return "todos los dias";
  if (enabled.join(",") === "1,2,3,4,5") return "dias laborables";
  if (enabled.join(",") === "6,7") return "fin de semana";
  return enabled.map((day) => ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"][day - 1]).join(", ");
}
