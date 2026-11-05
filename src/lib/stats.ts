import { parseISO, getDate } from "date-fns";
import {
  countWorkdays,
  grossMinutesOn,
  isRestDay,
  minutesBy,
  monthDays,
  sessionsBetween,
  sumMinutes,
} from "./calc";
import type { Commitment, DayMeta, StudySession, Subject } from "./types";

export interface MonthStats {
  days: string[];
  netMinutes: number;
  grossMinutes: number;
  avgPerDay: number; // minutos por dia do mês
  avgPerWeek: number;
  bySubject: { subject: Subject; minutes: number }[];
  most?: { subject: Subject; minutes: number } | undefined;
  least?: { subject: Subject; minutes: number } | undefined;
  restDays: number;
  workdays: number;
  studiedDays: number;
  daysWithoutStudy: number;
  daily: { day: number; date: string; minutes: number }[];
}

export function monthStats(
  ref: Date,
  sessions: StudySession[],
  subjects: Subject[],
  commitments: Commitment[],
  meta: Record<string, DayMeta>,
  restWeekdays: number[],
  filter?: { subjectId?: string | undefined; from?: string | undefined; to?: string | undefined },
): MonthStats {
  const days = monthDays(ref);
  let ms = sessionsBetween(sessions, days[0] ?? "", days[days.length - 1] ?? "");
  if (filter?.subjectId) ms = ms.filter((s) => s.subjectId === filter.subjectId);
  if (filter?.from) ms = ms.filter((s) => s.date >= filter.from!);
  if (filter?.to) ms = ms.filter((s) => s.date <= filter.to!);
  const netMinutes = sumMinutes(ms);
  const grossMinutes = days.reduce((a, d) => a + grossMinutesOn(commitments, d), 0);
  const byS = minutesBy(ms, (s) => s.subjectId);
  const bySubject = subjects
    .filter((s) => !s.archived || byS[s.id])
    .map((subject) => ({ subject, minutes: byS[subject.id] ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes);
  const withTime = bySubject.filter((x) => x.minutes > 0);
  const byDay = minutesBy(ms, (s) => s.date);
  const { work, rest } = countWorkdays(days, restWeekdays, meta);
  const studiedDays = days.filter((d) => (byDay[d] ?? 0) > 0).length;
  const daysWithoutStudy = days.filter(
    (d) => !((byDay[d] ?? 0) > 0) && !isRestDay(d, restWeekdays, meta),
  ).length;
  return {
    days,
    netMinutes,
    grossMinutes,
    avgPerDay: netMinutes / days.length,
    avgPerWeek: (netMinutes / days.length) * 7,
    bySubject,
    most: withTime[0],
    least: withTime.length > 1 ? withTime[withTime.length - 1] : undefined,
    restDays: rest,
    workdays: work,
    studiedDays,
    daysWithoutStudy,
    daily: days.map((d) => ({ day: getDate(parseISO(d)), date: d, minutes: byDay[d] ?? 0 })),
  };
}
