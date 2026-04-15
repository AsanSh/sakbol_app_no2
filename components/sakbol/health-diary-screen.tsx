"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMedication,
  listMedications,
  markMedicationTaken,
} from "@/app/actions/medication";
import { MaterialIcon } from "@/components/sakbol/material-icon";
import { SakbolTopBar } from "@/components/sakbol/top-bar";
import { useActiveProfile } from "@/context/active-profile-context";
import { useTabApp } from "@/context/tab-app-context";
import { useTelegramSession } from "@/context/telegram-session-context";
import { cn } from "@/lib/utils";

const LS_MEDS = "sakbol_medications";

type LocalMed = { id: string; name: string; time: string; note: string; taken: boolean };

type ServerMed = { id: string; name: string; dosage: string; timeOfDay: string; takenToday: boolean };

function startOfWeekMonday(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function HealthDiaryScreen() {
  const { closeDiary } = useTabApp();
  const { authReady, isAuthenticated } = useTelegramSession();
  const { activeProfileId } = useActiveProfile();
  const [diaryTab, setDiaryTab] = useState<"meds" | "sleep" | "mood">("meds");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => isoDate(new Date()));

  const weekStart = useMemo(() => {
    const base = startOfWeekMonday(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const todayIso = isoDate(new Date());
  const canStepWeekForward = weekOffset < 0;

  const [localMeds, setLocalMeds] = useState<LocalMed[]>([]);
  const [serverMeds, setServerMeds] = useState<ServerMed[]>([]);
  const [medName, setMedName] = useState("");
  const [medTime, setMedTime] = useState("08:00");
  const [medNote, setMedNote] = useState("");

  const useServer = authReady && isAuthenticated && !!activeProfileId;

  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(LS_MEDS);
      if (!raw) {
        setLocalMeds([]);
        return;
      }
      const parsed = JSON.parse(raw) as LocalMed[];
      setLocalMeds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLocalMeds([]);
    }
  }, []);

  const saveLocal = useCallback((next: LocalMed[]) => {
    setLocalMeds(next);
    localStorage.setItem(LS_MEDS, JSON.stringify(next));
  }, []);

  const reloadServer = useCallback(async () => {
    if (!activeProfileId) {
      setServerMeds([]);
      return;
    }
    const rows = await listMedications(activeProfileId);
    setServerMeds(rows as ServerMed[]);
  }, [activeProfileId]);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    if (useServer) void reloadServer();
    else setServerMeds([]);
  }, [useServer, reloadServer]);

  const medsForUi = useServer
    ? serverMeds.map((m) => ({
        id: m.id,
        name: m.name,
        time: m.timeOfDay,
        note: m.dosage,
        taken: m.takenToday,
        server: true as const,
      }))
    : localMeds.map((m) => ({ ...m, server: false as const }));

  const takenCount = medsForUi.filter((m) => m.taken).length;
  const totalMeds = medsForUi.length;

  const [sleepHours, setSleepHours] = useState("7");
  const [sleepMinutes, setSleepMinutes] = useState("30");
  const [moodNote, setMoodNote] = useState("");
  const [moodSaved, setMoodSaved] = useState(false);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[#f8f9fa]">
      <SakbolTopBar variant="back" title="Дневник" onBack={closeDiary} />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 pb-8 pt-2">
        <h1 className="font-manrope text-xl font-extrabold text-[#191c1d]">Ежедневный журнал</h1>
        <p className="text-sm text-[#70787d]">Дневник здоровья</p>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#40484c] shadow-sm"
            aria-label="Предыдущая неделя"
          >
            <MaterialIcon name="chevron_left" />
          </button>
          <span className="text-xs font-medium text-[#70787d]">
            {weekDays[0].toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
          </span>
          <button
            type="button"
            disabled={!canStepWeekForward}
            onClick={() => canStepWeekForward && setWeekOffset((w) => w + 1)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#40484c] shadow-sm",
              !canStepWeekForward && "cursor-not-allowed opacity-40",
            )}
            aria-label="Следующая неделя"
          >
            <MaterialIcon name="chevron_right" />
          </button>
        </div>

        <div className="mt-3 flex justify-between gap-1">
          {weekDays.map((d) => {
            const iso = isoDate(d);
            const active = selectedDay === iso;
            const isToday = iso === todayIso;
            const past = iso < todayIso;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDay(iso)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center rounded-xl py-2 text-[10px]",
                  active ? "bg-[#004253] text-white shadow-md" : "bg-white text-[#40484c] shadow-sm",
                )}
              >
                <span className="uppercase">
                  {d.toLocaleDateString("ru-RU", { weekday: "short" }).slice(0, 2)}
                </span>
                <span className="font-manrope text-sm font-bold">{d.getDate()}</span>
                <span
                  className={cn(
                    "mt-0.5 h-1 w-1 rounded-full",
                    past || isToday ? "bg-[#8dd0e9]" : "bg-transparent",
                    active && "bg-white",
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex rounded-2xl bg-[#f3f4f5] p-1">
          {(
            [
              { id: "meds" as const, label: "Лекарства", icon: "pill" },
              { id: "sleep" as const, label: "Сон", icon: "bedtime" },
              { id: "mood" as const, label: "Самочувствие", icon: "mood" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDiaryTab(t.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-semibold",
                diaryTab === t.id
                  ? "bg-gradient-to-br from-[#004253] to-[#005b71] text-white shadow-sm"
                  : "text-[#70787d]",
              )}
            >
              <MaterialIcon name={t.icon} filled={diaryTab === t.id} className="text-[20px]" />
              {t.label}
            </button>
          ))}
        </div>

        {diaryTab === "meds" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#191c1d]">
                Принято {takenCount}/{totalMeds || 0}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f3f4f5]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#004253] to-[#005b71]"
                  style={{
                    width: `${totalMeds ? Math.round((takenCount / totalMeds) * 100) : 0}%`,
                  }}
                />
              </div>
              {!useServer ? (
                <p className="mt-2 text-[10px] text-[#70787d]">
                  Локально (localStorage). Войдите — список синхронизируется с аккаунтом.
                </p>
              ) : null}
            </div>

            <ul className="space-y-2">
              {medsForUi.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-3 rounded-2xl border border-[#e7e8e9] bg-white p-3 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={async () => {
                      if (m.server) {
                        await markMedicationTaken(m.id, !m.taken);
                        await reloadServer();
                      } else {
                        saveLocal(
                          localMeds.map((x) =>
                            x.id === m.id ? { ...x, taken: !x.taken } : x,
                          ),
                        );
                      }
                    }}
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                      m.taken
                        ? "border-[#004253] bg-[#004253] text-white"
                        : "border-[#bfc8cc] bg-white text-transparent",
                    )}
                    aria-label="Принято"
                  >
                    <MaterialIcon name="check" className="text-[18px]" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#191c1d]">{m.name}</p>
                    <p className="text-xs text-[#70787d]">
                      {m.time}
                      {m.note ? ` · ${m.note}` : ""}
                    </p>
                  </div>
                  {!m.server ? (
                    <button
                      type="button"
                      onClick={() =>
                        saveLocal(localMeds.filter((x) => x.id !== m.id))
                      }
                      className="text-[#93000a]"
                      aria-label="Удалить"
                    >
                      <MaterialIcon name="delete" className="text-[20px]" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>

            <div className="rounded-2xl bg-[#f3f4f5] p-3">
              <p className="text-xs font-semibold text-[#40484c]">Добавить</p>
              <div className="mt-2 space-y-2">
                <input
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  placeholder="Название"
                  className="w-full rounded-xl border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={medTime}
                  onChange={(e) => setMedTime(e.target.value)}
                  className="w-full rounded-xl border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
                />
                <input
                  value={medNote}
                  onChange={(e) => setMedNote(e.target.value)}
                  placeholder="Заметка"
                  className="w-full rounded-xl border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!medName.trim()) return;
                    if (useServer && activeProfileId) {
                      await addMedication(
                        activeProfileId,
                        medName.trim(),
                        medNote.trim() || "-",
                        medTime,
                      );
                      setMedName("");
                      setMedNote("");
                      await reloadServer();
                    } else {
                      saveLocal([
                        ...localMeds,
                        {
                          id: crypto.randomUUID(),
                          name: medName.trim(),
                          time: medTime,
                          note: medNote.trim(),
                          taken: false,
                        },
                      ]);
                      setMedName("");
                      setMedNote("");
                    }
                  }}
                  className="w-full rounded-xl bg-[#004253] py-2.5 text-sm font-semibold text-white"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {diaryTab === "sleep" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-gradient-to-br from-[#1a1f2e] to-[#0f1219] p-4 text-white shadow-lg">
              <p className="text-xs text-slate-300">Прошлой ночью</p>
              <div className="mt-1 flex items-end justify-between">
                <p className="font-manrope text-3xl font-extrabold">7 ч 24 мин</p>
                <div className="flex text-amber-300">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <MaterialIcon key={i} name="star" filled className="text-[18px]" />
                  ))}
                  <MaterialIcon name="star" className="text-[18px] opacity-40" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <p className="text-slate-400">Заснул</p>
                  <p className="font-semibold">23:40</p>
                </div>
                <div>
                  <p className="text-slate-400">Проснулся</p>
                  <p className="font-semibold">07:04</p>
                </div>
                <div>
                  <p className="text-slate-400">Всего</p>
                  <p className="font-semibold">7:24</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e7e8e9] bg-white p-4 shadow-sm">
              <p className="font-semibold text-[#191c1d]">Фазы сна</p>
              {[
                { label: "Глубокий", pct: 22, color: "bg-indigo-500" },
                { label: "REM", pct: 24, color: "bg-sky-400" },
                { label: "Лёгкий", pct: 54, color: "bg-slate-300" },
              ].map((row) => (
                <div key={row.label} className="mt-3">
                  <div className="flex justify-between text-xs text-[#40484c]">
                    <span>{row.label}</span>
                    <span>{row.pct}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#f3f4f5]">
                    <div className={cn("h-full rounded-full", row.color)} style={{ width: `${row.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-[#f3f4f5] p-3">
              <p className="text-xs font-semibold text-[#40484c]">Ручной ввод (часы · минуты)</p>
              <div className="mt-2 flex gap-2">
                <input
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="w-full rounded-xl border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
                  inputMode="numeric"
                />
                <input
                  value={sleepMinutes}
                  onChange={(e) => setSleepMinutes(e.target.value)}
                  className="w-full rounded-xl border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
                  inputMode="numeric"
                />
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-xl bg-[#004253] py-2 text-sm font-semibold text-white"
              >
                Сохранить
              </button>
            </div>

            <div className="rounded-2xl border border-[#d4e6e9] bg-[#d4e6e9]/40 p-3 text-xs text-[#004253]">
              REM важен для памяти и настроения; недостаток связан с дневной сонливостью (образовательно).
            </div>
          </div>
        ) : null}

        {diaryTab === "mood" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-[#40484c]">Как вы себя чувствуете?</p>
            <div className="flex flex-wrap justify-between gap-2">
              {[
                { icon: "sentiment_very_satisfied", label: "Отлично" },
                { icon: "sentiment_satisfied", label: "Хорошо" },
                { icon: "sentiment_neutral", label: "Норма" },
                { icon: "sentiment_dissatisfied", label: "Тяжело" },
                { icon: "sentiment_very_dissatisfied", label: "Ужасно" },
              ].map((m) => (
                <button
                  key={m.icon}
                  type="button"
                  className="flex flex-col items-center gap-1 rounded-2xl border border-[#e7e8e9] bg-white px-2 py-2 shadow-sm"
                >
                  <MaterialIcon name={m.icon} className="text-[32px] text-[#004253]" />
                  <span className="text-[9px] text-[#70787d]">{m.label}</span>
                </button>
              ))}
            </div>
            <textarea
              value={moodNote}
              onChange={(e) => {
                setMoodNote(e.target.value);
                setMoodSaved(false);
              }}
              placeholder="Заметка дня…"
              rows={3}
              className="w-full rounded-2xl border border-[#e7e8e9] bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setMoodSaved(true);
                window.setTimeout(() => setMoodSaved(false), 2000);
              }}
              className="w-full rounded-xl bg-gradient-to-r from-[#004253] to-[#005b71] py-3 font-semibold text-white"
            >
              {moodSaved ? "Сохранено ✓" : "Сохранить заметку"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
