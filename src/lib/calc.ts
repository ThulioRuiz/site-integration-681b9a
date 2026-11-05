import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import type { Commitment, Cycle, DayMeta, ExamId, StudySession, Subject } from "./types";

export const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export const SUGGESTED_SUBJECTS: Record<ExamId, string[]> = {
  ITA: ["Matemática", "Física", "Química", "Português", "Inglês"],
  IME: ["Matemática", "Física", "Química", "Português", "Inglês"],
  EFOMM: ["Matemática", "Física", "Português", "Inglês", "Redação"],
  EsPCEx: [
    "Matemática",
    "Física",
    "Química",
    "Português",
    "Redação",
    "História",
    "Geografia",
    "Inglês",
  ],
};

/** Horas da matéria = horas semanais × peso / soma dos pesos */
export function distributeHours(
  totalHours: number,
  subjects: Pick<Subject, "id" | "multiplier">[],
): Record<string, number> {
  const totalWeight = subjects.reduce((s, x) => s + Math.max(0, x.multiplier), 0);
  const out: Record<string, number> = {};
  for (const s of subjects) {
    out[s.id] = totalWeight > 0 ? (totalHours * Math.max(0, s.multiplier)) / totalWeight : 0;
  }
  return out;
}

/** Um dia é de descanso se houver marcação manual, senão segue o padrão semanal. */
export function isRestDay(
  date: string,
  restWeekdays: number[],
  dayMeta: Record<string, DayMeta> = {},
): boolean {
  const meta = dayMeta[date];
  if (meta?.rest !== undefined) return meta.rest;
  return restWeekdays.includes(getDay(parseISO(date)));
}

export function restWeekdaysFromStudy(studyWeekdays: number[]): number[] {
  return [0, 1, 2, 3, 4, 5, 6].filter((d) => !studyWeekdays.includes(d));
}

export function monthDays(ref: Date) {
  return eachDayOfInterval({ start: startOfMonth(ref), end: endOfMonth(ref) }).map(ymd);
}

export function countWorkdays(days: string[], restWeekdays: number[], meta: Record<string, DayMeta>) {
  let work = 0;
  let rest = 0;
  for (const d of days) {
    if (isRestDay(d, restWeekdays, meta)) rest++;
    else work++;
  }
  return { work, rest };
}

/** Quantos ciclos completos cabem no mês: (dias úteis × horas/dia) ÷ horas do ciclo. */
export function cyclesInMonth(workdays: number, dailyHours: number, cycleHours: number) {
  if (cycleHours <= 0) return 0;
  return Math.floor((workdays * dailyHours + 1e-9) / cycleHours);
}

export function cycleTargetHours(c: Pick<Cycle, "goalHours" | "weeklyHours" | "durationDays">) {
  if (c.goalHours > 0) return c.goalHours;
  return (c.weeklyHours * c.durationDays) / 7;
}

export function minutesBy<K extends string>(
  sessions: StudySession[],
  key: (s: StudySession) => K | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    const k = key(s);
    if (!k) continue;
    out[k] = (out[k] ?? 0) + s.minutes;
  }
  return out;
}

export function sumMinutes(sessions: StudySession[]) {
  return sessions.reduce((a, s) => a + s.minutes, 0);
}

export function sessionsBetween(sessions: StudySession[], from: string, to: string) {
  return sessions.filter((s) => s.date >= from && s.date <= to);
}

/** Avança N dias úteis a partir de uma data (inclusive), pulando descansos. Retorna a data do último dia útil. */
export function addWorkdays(
  from: string,
  n: number,
  restWeekdays: number[],
  meta: Record<string, DayMeta>,
): string {
  let d = parseISO(from);
  let guard = 0;
  // garante que o primeiro dia contado é útil
  while (isRestDay(ymd(d), restWeekdays, meta) && guard < 400) {
    d = addDays(d, 1);
    guard++;
  }
  let remaining = Math.max(1, n);
  while (guard < 2000) {
    if (!isRestDay(ymd(d), restWeekdays, meta)) {
      remaining--;
      if (remaining === 0) return ymd(d);
    }
    d = addDays(d, 1);
    guard++;
  }
  return ymd(d);
}

export function nextWorkday(after: string, restWeekdays: number[], meta: Record<string, DayMeta>) {
  let d = addDays(parseISO(after), 1);
  for (let i = 0; i < 400 && isRestDay(ymd(d), restWeekdays, meta); i++) d = addDays(d, 1);
  return ymd(d);
}

export interface CycleSubjectRow {
  subject: Subject;
  weekly: number;
  perWorkday: number;
  target: number;
  studied: number;
  remaining: number;
  pct: number;
}

export interface CycleReport {
  rows: CycleSubjectRow[];
  target: number;
  studied: number;
  remaining: number;
  pct: number;
  workdaysPerWeek: number;
  workdaysNeeded: number;
  weeksNeeded: number;
  projectedEnd: string;
  restartDate: string;
  pending: CycleSubjectRow[];
  fitsThisWeek: number;
}

export function cycleReport(
  cycle: Cycle,
  subjects: Subject[],
  sessions: StudySession[],
  meta: Record<string, DayMeta>,
  today: string,
): CycleReport {
  const active = subjects.filter((s) => cycle.subjectIds.includes(s.id) && !s.archived);
  const target = cycleTargetHours(cycle);
  const weekly = distributeHours(cycle.weeklyHours, active);
  const targets = distributeHours(target, active);
  const workdaysPerWeek = Math.max(1, 7 - cycle.restWeekdays.length);
  const inCycle = sessions.filter(
    (s) => s.date >= cycle.startDate && s.date <= today && s.subjectId,
  );
  const byS = minutesBy(inCycle, (s) => s.subjectId);
  const rows: CycleSubjectRow[] = active.map((subject) => {
    const studied = (byS[subject.id] ?? 0) / 60;
    const t = targets[subject.id] ?? 0;
    const remaining = Math.max(0, t - studied);
    return {
      subject,
      weekly: weekly[subject.id] ?? 0,
      perWorkday: (weekly[subject.id] ?? 0) / workdaysPerWeek,
      target: t,
      studied,
      remaining,
      pct: t > 0 ? Math.min(100, (studied / t) * 100) : 0,
    };
  });
  const studied = rows.reduce((a, r) => a + Math.min(r.studied, r.target), 0);
  const remaining = rows.reduce((a, r) => a + r.remaining, 0);
  const daily = cycle.dailyHours > 0 ? cycle.dailyHours : cycle.weeklyHours / workdaysPerWeek;
  const workdaysNeeded = daily > 0 ? Math.ceil(remaining / daily - 1e-9) : 0;
  const projectedEnd =
    workdaysNeeded > 0 ? addWorkdays(today, workdaysNeeded, cycle.restWeekdays, meta) : today;
  const restartDate = nextWorkday(projectedEnd, cycle.restWeekdays, meta);

  // quantas matérias pendentes cabem no tempo útil restante desta semana
  const weekEnd = ymd(endOfWeek(parseISO(today), { weekStartsOn: 1 }));
  const remainingWeekDays = eachDayOfInterval({ start: parseISO(today), end: parseISO(weekEnd) })
    .map(ymd)
    .filter((d) => !isRestDay(d, cycle.restWeekdays, meta)).length;
  let budget = remainingWeekDays * daily;
  let fitsThisWeek = 0;
  const pending = rows.filter((r) => r.remaining > 0.001);
  for (const r of [...pending].sort((a, b) => a.remaining - b.remaining)) {
    if (r.remaining <= budget + 1e-9) {
      budget -= r.remaining;
      fitsThisWeek++;
    }
  }

  return {
    rows,
    target,
    studied,
    remaining,
    pct: target > 0 ? Math.min(100, (studied / target) * 100) : 0,
    workdaysPerWeek,
    workdaysNeeded,
    weeksNeeded: workdaysNeeded / workdaysPerWeek,
    projectedEnd,
    restartDate,
    pending,
    fitsThisWeek,
  };
}

export interface GoalReport {
  goal: number;
  studied: number;
  remaining: number;
  pct: number;
  workdays: number;
  restDays: number;
  totalDays: number;
  remainingWorkdays: number;
  pacePerWorkday: number;
  neededPerWorkday: number;
  projected: number;
  onTrack: boolean;
}

/** Meta mensal: considera dias úteis restantes (incluindo hoje) e o ritmo médio dos dias úteis já passados. */
export function monthGoalReport(
  ref: Date,
  goalHours: number,
  sessions: StudySession[],
  restWeekdays: number[],
  meta: Record<string, DayMeta>,
  today: string,
): GoalReport {
  const days = monthDays(ref);
  const { work, rest } = countWorkdays(days, restWeekdays, meta);
  const studied = sumMinutes(sessionsBetween(sessions, days[0] ?? "", days[days.length - 1] ?? "")) / 60;
  const past = days.filter((d) => d < today);
  const pastWork = past.filter((d) => !isRestDay(d, restWeekdays, meta)).length;
  const upcoming = days.filter((d) => d >= today);
  const remainingWorkdays = upcoming.filter((d) => !isRestDay(d, restWeekdays, meta)).length;
  const remaining = Math.max(0, goalHours - studied);
  const pacePerWorkday = pastWork > 0 ? studied / pastWork : studied;
  const projected = studied + pacePerWorkday * remainingWorkdays;
  return {
    goal: goalHours,
    studied,
    remaining,
    pct: goalHours > 0 ? Math.min(100, (studied / goalHours) * 100) : 0,
    workdays: work,
    restDays: rest,
    totalDays: days.length,
    remainingWorkdays,
    pacePerWorkday,
    neededPerWorkday: remainingWorkdays > 0 ? remaining / remainingWorkdays : remaining,
    projected,
    onTrack: projected + 1e-9 >= goalHours,
  };
}

export function weekRange(ref: Date) {
  return {
    from: ymd(startOfWeek(ref, { weekStartsOn: 1 })),
    to: ymd(endOfWeek(ref, { weekStartsOn: 1 })),
  };
}

export function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function commitmentOccursOn(c: Commitment, date: string) {
  if (date < c.date) return false;
  if (c.repeat === "nenhuma") return c.date === date;
  if (c.repeat === "diaria") return true;
  return getDay(parseISO(c.date)) === getDay(parseISO(date));
}

export function commitmentMinutes(c: Commitment) {
  const diff = timeToMin(c.end) - timeToMin(c.start);
  return diff >= 0 ? diff : diff + 24 * 60;
}

export function grossMinutesOn(commitments: Commitment[], date: string) {
  return commitments
    .filter((c) => commitmentOccursOn(c, date))
    .reduce((a, c) => a + commitmentMinutes(c), 0);
}

/** Divide minutos igualmente; o resto vai para as primeiras matérias. */
export function splitEvenly(totalMinutes: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalMinutes / n);
  const rest = totalMinutes - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

export function fmtHours(h: number) {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}min`;
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, "0")}`;
}

export function fmtMin(m: number) {
  return fmtHours(m / 60);
}

export function fmtDec(n: number, digits = 2) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}
