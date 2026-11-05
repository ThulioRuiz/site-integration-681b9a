import { useEffect, useRef } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useApp } from "./store";
import { minutesBy, sumMinutes, weekRange, ymd } from "./calc";
import { topicProgress } from "./topics";
import type { AppData } from "./store";

export type RankingPeriod = "semana" | "mes" | "total";

export interface RankingEntry {
  userId: string;
  name: string;
  exam: string;
  minutes: number;
  topicsDone: number;
  streakDays: number;
  questionsCorrect: number;
  me: boolean;
}

/** Resumo enviado ao ranking: só números agregados, nunca anotações ou registros. */
export function computeRankingStats(d: Pick<AppData, "profile" | "sessions" | "subjects" | "questionLogs"> & Partial<Pick<AppData, "questionBank">>, now = new Date()) {
  const today = ymd(now);
  const wk = weekRange(now);
  const monthKey = format(now, "yyyy-MM");
  const byDay = minutesBy(d.sessions, (s) => s.date);
  let streak = 0;
  // Sequência de dias com estudo; hoje ainda sem estudo não quebra a sequência.
  let cursor = (byDay[today] ?? 0) > 0 ? today : ymd(addDays(parseISO(today), -1));
  while ((byDay[cursor] ?? 0) > 0 && streak < 3650) {
    streak++;
    cursor = ymd(addDays(parseISO(cursor), -1));
  }
  const round = (n: number) => Math.max(0, Math.round(n));
  return {
    displayName: d.profile?.name?.trim().slice(0, 40) || undefined,
    exam: d.profile?.exam ?? "",
    totalMinutes: round(sumMinutes(d.sessions)),
    weekKey: wk.from,
    weekMinutes: round(sumMinutes(d.sessions.filter((s) => s.date >= wk.from && s.date <= wk.to))),
    monthKey,
    monthMinutes: round(sumMinutes(d.sessions.filter((s) => s.date.slice(0, 7) === monthKey))),
    topicsDone: d.subjects.reduce((a, s) => a + topicProgress(s.topics).done, 0),
    streakDays: streak,
    questionsCorrect: round(
      d.questionLogs.reduce((a, q) => a + (q.correct || 0), 0) +
        (d.questionBank ?? []).reduce((a, q) => a + q.attempts.filter((t) => t.result === "certa").length, 0),
    ),
  };
}

export async function fetchRanking(period: RankingPeriod): Promise<RankingEntry[]> {
  const now = new Date();
  const qs = new URLSearchParams({ periodo: period, semana: weekRange(now).from, mes: format(now, "yyyy-MM") });
  const res = await fetch(`/api/ranking?${qs}`, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Não foi possível carregar o ranking.");
  return ((await res.json()) as { entries: RankingEntry[] }).entries;
}

export async function pushRankingStats() {
  const s = useApp.getState();
  if (!s.profile) return;
  await fetch("/api/ranking", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(computeRankingStats(s)),
  });
}

/** Mantém o ranking atualizado: envia o resumo alguns segundos depois de cada mudança. */
export function useRankingSync(enabled: boolean) {
  const sessions = useApp((s) => s.sessions);
  const subjects = useApp((s) => s.subjects);
  const logs = useApp((s) => s.questionLogs);
  const questionBank = useApp((s) => s.questionBank);
  const profile = useApp((s) => s.profile);
  const last = useRef("");
  useEffect(() => {
    if (!enabled || !profile) return;
    const payload = JSON.stringify(computeRankingStats({ profile, sessions, subjects, questionLogs: logs, questionBank }));
    if (payload === last.current) return;
    const t = window.setTimeout(() => {
      last.current = payload;
      void pushRankingStats().catch(() => {
        last.current = "";
      });
    }, 4000);
    return () => window.clearTimeout(t);
  }, [enabled, profile, sessions, subjects, logs, questionBank]);
}
