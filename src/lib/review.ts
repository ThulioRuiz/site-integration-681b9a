import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { isRestDay, ymd } from "./calc";
import { leafTopics } from "./topics";
import type {
  DayMeta,
  Profile,
  ReviewGrade,
  ReviewItem,
  ReviewSettings,
  ReviewStatus,
  Subject,
  Topic,
} from "./types";

/*
 * Revisão espaçada — lógica pura, sem React.
 *
 * Base: curva do esquecimento (Ebbinghaus), efeito do espaçamento (Cepeda et al., 2008: o
 * intervalo ideal entre revisões cresce com o tempo até a prova) e efeito de teste
 * (Roediger & Karpicke, 2006: tentar lembrar fixa mais do que reler).
 *
 * Dois métodos:
 *  - fixo: calendário de intervalos (1 · 7 · 30 · 90 dias, o "24h / 7 dias / 30 dias" dos
 *    cursinhos). A nota ajusta o passo: "esqueci" volta ao início; "fácil" pula uma etapa.
 *  - adaptativo: SM-2 (SuperMemo, usado pelo Anki). Um fator de facilidade por assunto faz os
 *    intervalos crescerem rápido no que o aluno domina e devagar no que ele erra.
 */

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = {
  method: "fixo",
  schedule: [1, 7, 15, 30, 60, 90],
  dailyCap: 10,
  skipRestDays: true,
  autoFromTopics: true,
};

/** A partir de quantos "esqueci" o assunto vira um caso-problema (limiar de "leech" do Anki). */
export const LEECH_LAPSES = 8;

/** Cepeda et al. (2008): o intervalo ideal fica em torno de 10 a 20% do tempo até a prova. */
const EXAM_GAP_RATIO = 0.2;

export const SCHEDULE_PRESETS: { id: string; name: string; schedule: number[]; help: string }[] = [
  {
    id: "1-7-30",
    name: "24h · 7 dias · 30 dias",
    schedule: [1, 7, 30],
    help: "O clássico dos cursinhos (Folha Dirigida, Estratégia). Três revisões; depois, manutenção a cada dois meses.",
  },
  {
    id: "1-7-15-30",
    name: "1 · 7 · 15 · 30 dias",
    schedule: [1, 7, 15, 30],
    help: "Escada do Gran Cursos e do Estudaqui: a revisão de 15 dias segura o conteúdo entre a semana e o mês.",
  },
  {
    id: "1-7-15-30-60-90",
    name: "1 · 7 · 15 · 30 · 60 · 90 dias",
    schedule: [1, 7, 15, 30, 60, 90],
    help: "Seis revisões por assunto, como nos apps Revizze e Revisefy. Padrão recomendado para quem tem meses até a prova.",
  },
  {
    id: "1-3-7-14-30-60-120",
    name: "1 · 3 · 7 · 14 · 30 · 60 · 120 dias",
    schedule: [1, 3, 7, 14, 30, 60, 120],
    help: "Intervalos que dobram, no ritmo do Anki. Mais revisões no começo, quando o esquecimento é mais rápido.",
  },
];

/** O que fazer em cada etapa (Gran Cursos, Provas Brasil, Passo Estratégico). Revisar é tentar lembrar, não reler. */
export function activityForStep(step: number) {
  if (step === 0)
    return {
      title: "Revisão de 24h",
      minutes: 15,
      what: "Antes de abrir o material, escreva de cabeça o que lembra do assunto (folha em branco). Depois confira nos grifos ou no mapa mental e resolva 5 questões rápidas.",
    };
  if (step === 1)
    return {
      title: "Revisão da semana",
      minutes: 15,
      what: "Resolva 10 questões da banca sobre o tópico, sem consultar. Releia só o que errou ou ficou em dúvida.",
    };
  return {
    title: step === 2 ? "Revisão do mês" : "Manutenção",
    minutes: 10,
    what: "Só questões e caderno de erros. Refaça as questões erradas deste tópico e explique em voz alta a regra de cada uma.",
  };
}

export const GRADE_INFO: Record<ReviewGrade, { label: string; help: string }> = {
  0: { label: "Esqueci", help: "Não lembrei o essencial. O assunto volta para o começo do calendário." },
  1: { label: "Difícil", help: "Lembrei com esforço ou com lacunas. Repete esta etapa em menos tempo." },
  2: { label: "Lembrei", help: "Lembrei bem. Segue para a próxima etapa." },
  3: { label: "Fácil", help: "Lembrei sem esforço. Pula uma etapa." },
};

export const STATUS_LABEL: Record<ReviewStatus, string> = { ativa: "Ativa", pausada: "Pausada", dominada: "Dominada" };

/** Intervalo a partir do qual o assunto é considerado dominado (sai da fila). */
export const MASTERY_DAYS = 180;
const START_EASE = 2.5;
const MIN_EASE = 1.3;

export function reviewSettingsOf(profile: Pick<Profile, "review"> | null | undefined): ReviewSettings {
  const r = profile?.review ?? {};
  const schedule = normalizeSchedule(r.schedule ?? DEFAULT_REVIEW_SETTINGS.schedule);
  return {
    method: r.method ?? DEFAULT_REVIEW_SETTINGS.method,
    schedule: schedule.length ? schedule : DEFAULT_REVIEW_SETTINGS.schedule,
    dailyCap: Math.max(0, Math.round(r.dailyCap ?? DEFAULT_REVIEW_SETTINGS.dailyCap)),
    skipRestDays: r.skipRestDays ?? DEFAULT_REVIEW_SETTINGS.skipRestDays,
    autoFromTopics: r.autoFromTopics ?? DEFAULT_REVIEW_SETTINGS.autoFromTopics,
  };
}

/** Só inteiros positivos, sem repetição, em ordem crescente. */
export function normalizeSchedule(list: number[]): number[] {
  return [...new Set(list.map((n) => Math.round(n)).filter((n) => Number.isFinite(n) && n >= 1))].sort((a, b) => a - b);
}

/** "1, 7, 30 e 90" → [1, 7, 30, 90] */
export function parseSchedule(text: string): number[] {
  return normalizeSchedule(
    text
      .split(/[^\d]+/)
      .filter(Boolean)
      .map(Number),
  );
}

export const scheduleId = (schedule: number[]) => normalizeSchedule(schedule).join("-");

const shift = (date: string, days: number) => ymd(addDays(parseISO(date), days));

/** Empurra a data para o próximo dia útil quando cai em descanso (no máximo uma semana). */
export function avoidRestDays(date: string, settings: ReviewSettings, restWeekdays: number[], meta: Record<string, DayMeta>) {
  if (!settings.skipRestDays) return date;
  let d = date;
  for (let i = 0; i < 7 && isRestDay(d, restWeekdays, meta); i++) d = shift(d, 1);
  return d;
}

export interface Scheduling {
  interval: number;
  step: number;
  ease: number;
  lapses: number;
  status: ReviewStatus;
}

/** Primeiro intervalo depois do estudo: a revisão de 24h. */
export function firstInterval(settings: ReviewSettings) {
  return settings.method === "fixo" ? (settings.schedule[0] ?? 1) : 1;
}

type Core = Pick<ReviewItem, "step" | "interval" | "ease" | "lapses">;

export interface ScheduleContext {
  /** Dias de atraso em relação à data marcada (0 = em dia). Atraso lembrado vale crédito. */
  lateDays?: number | undefined;
  /** Dias até a prova (undefined = sem data). Limita o intervalo a ~20% desse tempo. */
  daysToExam?: number | undefined;
}

/**
 * Calcula a próxima etapa a partir da nota. Não mexe em datas: quem chama aplica o intervalo
 * sobre o dia da revisão (e desvia de dias de descanso).
 */
export function nextSchedule(item: Core, grade: ReviewGrade, settings: ReviewSettings, ctx: ScheduleContext = {}): Scheduling {
  const late = Math.max(0, ctx.lateDays ?? 0);
  const result = settings.method === "fixo" ? nextFixed(item, grade, settings.schedule, late) : nextAdaptive(item, grade, late);
  let interval = Math.max(1, Math.round(result.interval));
  const status: ReviewStatus = interval > MASTERY_DAYS ? "dominada" : "ativa";
  if (ctx.daysToExam !== undefined && ctx.daysToExam > 2 && status === "ativa") {
    // perto da prova, revisões mais frequentes: intervalo ≤ 20% do tempo restante e nunca depois da véspera
    interval = Math.min(interval, Math.max(1, Math.floor(ctx.daysToExam * EXAM_GAP_RATIO)), ctx.daysToExam - 2);
  }
  return { ...result, interval, status };
}

function nextFixed(item: Core, grade: ReviewGrade, schedule: number[], late: number): Omit<Scheduling, "status"> {
  const sched = normalizeSchedule(schedule);
  const at = (i: number) => sched[i];
  const last = sched[sched.length - 1] ?? 30;
  // Depois do calendário, "manutenção": o intervalo dobra a cada acerto.
  const after = (i: number, fallback: number) => at(i) ?? Math.max(last, fallback) * 2 ** (i - sched.length + 1);
  const current = at(item.step) ?? item.interval;
  // Lembrou mesmo bem atrasado (mais da metade do intervalo)? O conteúdo está mais firme do que o calendário supunha.
  const bonus = late > current * 0.5 ? 1 : 0;
  switch (grade) {
    case 0:
      return { step: 0, interval: at(0) ?? 1, ease: item.ease, lapses: item.lapses + 1 };
    case 1:
      return { step: item.step, interval: Math.max(1, Math.round(current * 0.6)), ease: item.ease, lapses: item.lapses };
    case 2:
      return { step: item.step + 1 + bonus, interval: after(item.step + 1 + bonus, item.interval), ease: item.ease, lapses: item.lapses };
    case 3:
      return { step: item.step + 2, interval: after(item.step + 2, item.interval), ease: item.ease, lapses: item.lapses };
  }
}

/**
 * SM-2 com os ajustes do Anki: quatro botões (q = 1, 3, 4, 5), "difícil" ×1,2, "fácil" com bônus
 * de 1,3 e crédito pelo atraso (metade dele no "lembrei", todo ele no "fácil").
 */
function nextAdaptive(item: Core, grade: ReviewGrade, late: number): Omit<Scheduling, "status"> {
  const q = [1, 3, 4, 5][grade] ?? 4;
  const ease = Math.max(MIN_EASE, item.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (grade === 0) return { step: 0, interval: 1, ease, lapses: item.lapses + 1 };
  if (item.step === 0) {
    // primeira revisão (a de 24h): I(2) = 6 no SM-2; "difícil" encurta, "fácil" alonga
    const interval = grade === 1 ? 3 : grade === 3 ? 10 : 6;
    return { step: 1, interval, ease, lapses: item.lapses };
  }
  const base = item.interval;
  const interval = grade === 1 ? base * 1.2 : grade === 3 ? (base + late) * ease * 1.3 : (base + late / 2) * ease;
  return { step: item.step + 1, interval: Math.max(base + 1, interval), ease, lapses: item.lapses };
}

export function daysToExam(examDate: string | undefined, today: string) {
  if (!examDate) return undefined;
  const d = differenceInCalendarDays(parseISO(examDate), parseISO(today));
  return d >= 0 ? d : undefined;
}

export interface MakeReviewInput {
  id: string;
  subjectId: string;
  topicId?: string | undefined;
  title: string;
  studiedOn: string;
  source: ReviewItem["source"];
  note?: string | undefined;
}

export function makeReviewItem(
  input: MakeReviewInput,
  settings: ReviewSettings,
  restWeekdays: number[] = [],
  meta: Record<string, DayMeta> = {},
  now = Date.now(),
): ReviewItem {
  const interval = firstInterval(settings);
  const studiedOn = input.studiedOn || ymd(new Date(now));
  return {
    id: input.id,
    subjectId: input.subjectId,
    topicId: input.topicId,
    title: input.title.trim(),
    studiedOn,
    due: avoidRestDays(shift(studiedOn, interval), settings, restWeekdays, meta),
    step: 0,
    interval,
    ease: START_EASE,
    lapses: 0,
    status: "ativa",
    history: [],
    note: input.note ?? "",
    source: input.source,
    createdAt: now,
  };
}

/** Aplica a nota de uma revisão feita em `today`. */
export function gradeItem(
  item: ReviewItem,
  grade: ReviewGrade,
  today: string,
  settings: ReviewSettings,
  restWeekdays: number[] = [],
  meta: Record<string, DayMeta> = {},
  now = Date.now(),
  examDate?: string | undefined,
): ReviewItem {
  const next = nextSchedule(item, grade, settings, { lateDays: overdueDays(item, today), daysToExam: daysToExam(examDate, today) });
  return {
    ...item,
    ...next,
    due: avoidRestDays(shift(today, next.interval), settings, restWeekdays, meta),
    history: [...item.history, { date: today, grade, interval: next.interval, createdAt: now }],
  };
}

/** Volta ao começo do calendário, como se tivesse sido estudado hoje. */
export function restartItem(item: ReviewItem, today: string, settings: ReviewSettings, restWeekdays: number[] = [], meta: Record<string, DayMeta> = {}): ReviewItem {
  const interval = firstInterval(settings);
  return { ...item, step: 0, interval, ease: START_EASE, status: "ativa", studiedOn: today, due: avoidRestDays(shift(today, interval), settings, restWeekdays, meta) };
}

export const isDue = (item: ReviewItem, today: string) => item.status === "ativa" && item.due <= today;

export const overdueDays = (item: ReviewItem, today: string) => Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(item.due)));

export const lastReviewDate = (item: ReviewItem) => item.history[item.history.length - 1]?.date ?? item.studiedOn;

export const daysSinceStudy = (item: ReviewItem, today: string) => Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(item.studiedOn)));

/**
 * Quanto o aluno ainda deve lembrar (0 a 1), pela curva de potência do FSRS-4.5:
 * R = (1 + 19/81 · t/S)^-0,5, em que S é a estabilidade (aqui, o intervalo marcado) e t são os
 * dias desde a última revisão. No dia marcado a retenção estimada é 90%.
 */
export function retention(item: ReviewItem, today: string) {
  const t = Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(lastReviewDate(item))));
  const s = Math.max(1, item.interval);
  return Math.pow(1 + (19 / 81) * (t / s), -0.5);
}

/** Caso-problema: esqueceu muitas vezes. Vale reestudar a teoria em vez de só revisar. */
export const isLeech = (item: ReviewItem) => item.lapses >= LEECH_LAPSES;

/** Ordem da fila (como o Anki com FSRS): primeiro o que está mais perto de ser esquecido. */
export function compareDue(today: string) {
  return (a: ReviewItem, b: ReviewItem) =>
    retention(a, today) - retention(b, today) || overdueDays(b, today) - overdueDays(a, today) || b.lapses - a.lapses || a.title.localeCompare(b.title, "pt-BR");
}

/**
 * Espalha as revisões atrasadas pelos próximos `days` dias (o "postpone" do SuperMemo), mantendo
 * primeiro as que estão mais perto de ser esquecidas. As que já caem hoje continuam hoje.
 */
export function spreadOverdue(items: ReviewItem[], today: string, days: number, perDay: number): ReviewItem[] {
  const late = items.filter((i) => i.status === "ativa" && i.due < today).sort(compareDue(today));
  const slots = Math.max(1, perDay);
  const target = new Map<string, string>();
  late.forEach((i, idx) => target.set(i.id, shift(today, Math.min(Math.max(1, days), Math.floor(idx / slots)))));
  return items.map((i) => (target.has(i.id) ? { ...i, due: target.get(i.id)! } : i));
}

export interface DueQueue {
  queue: ReviewItem[];
  /** Vencidas que ficaram de fora por causa do limite diário. */
  deferred: number;
  overdue: number;
}

export function dueQueue(items: ReviewItem[], today: string, settings: ReviewSettings): DueQueue {
  const due = items.filter((i) => isDue(i, today)).sort(compareDue(today));
  const queue = settings.dailyCap > 0 ? due.slice(0, settings.dailyCap) : due;
  return { queue, deferred: due.length - queue.length, overdue: due.filter((i) => i.due < today).length };
}

export interface ReviewSummary {
  dueToday: number;
  overdue: number;
  doneToday: number;
  next7: number;
  active: number;
  mastered: number;
  paused: number;
}

export function summarize(items: ReviewItem[], today: string): ReviewSummary {
  const week = shift(today, 7);
  let dueToday = 0, overdue = 0, doneToday = 0, next7 = 0, active = 0, mastered = 0, paused = 0;
  for (const i of items) {
    if (i.history.some((h) => h.date === today)) doneToday++;
    if (i.status === "dominada") mastered++;
    else if (i.status === "pausada") paused++;
    else {
      active++;
      if (i.due <= today) {
        dueToday++;
        if (i.due < today) overdue++;
      } else if (i.due <= week) next7++;
    }
  }
  return { dueToday, overdue, doneToday, next7, active, mastered, paused };
}

/** Revisões previstas por dia, a partir de hoje. As atrasadas entram no dia de hoje. */
export function forecast(items: ReviewItem[], today: string, days: number) {
  const out: { date: string; count: number }[] = Array.from({ length: days }, (_, i) => ({ date: shift(today, i), count: 0 }));
  const index = new Map(out.map((o, i) => [o.date, i]));
  for (const i of items) {
    if (i.status !== "ativa") continue;
    const idx = i.due <= today ? 0 : index.get(i.due);
    if (idx !== undefined) out[idx]!.count++;
  }
  return out;
}

/** Revisões com data marcada (ou feitas) em um dia específico. */
export function reviewsOn(items: ReviewItem[], date: string) {
  return {
    scheduled: items.filter((i) => i.status === "ativa" && i.due === date),
    done: items.filter((i) => i.history.some((h) => h.date === date)),
  };
}

/** Intervalo resultante de cada nota, para mostrar embaixo dos botões (como o Anki faz). */
export function previewIntervals(item: ReviewItem, settings: ReviewSettings, today: string, examDate?: string | undefined): Record<ReviewGrade, number> {
  const ctx: ScheduleContext = { lateDays: overdueDays(item, today), daysToExam: daysToExam(examDate, today) };
  return {
    0: nextSchedule(item, 0, settings, ctx).interval,
    1: nextSchedule(item, 1, settings, ctx).interval,
    2: nextSchedule(item, 2, settings, ctx).interval,
    3: nextSchedule(item, 3, settings, ctx).interval,
  };
}

export function fmtInterval(days: number) {
  if (days <= 1) return "amanhã";
  if (days < 14) return `${days} dias`;
  if (days < 60) return `${Math.round(days / 7)} sem`;
  if (days < 365) return `${Math.round(days / 30)} ${Math.round(days / 30) === 1 ? "mês" : "meses"}`;
  return `${(days / 365).toFixed(1)} ano`;
}

export function fmtRelativeDue(item: ReviewItem, today: string) {
  const diff = differenceInCalendarDays(parseISO(item.due), parseISO(today));
  if (diff < -1) return `atrasada ${-diff} dias`;
  if (diff === -1) return "atrasada 1 dia";
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  return `em ${diff} dias`;
}

/** Tópicos (folhas) da matéria que ainda não têm revisão ativa. */
export function topicsWithoutReview(subject: Subject, items: ReviewItem[]): Topic[] {
  const covered = new Set(items.filter((i) => i.status !== "dominada" && i.topicId).map((i) => i.topicId));
  return leafTopics(subject.topics).filter((t) => !covered.has(t.id));
}

export const findByTopic = (items: ReviewItem[], topicId: string) => items.find((i) => i.topicId === topicId && i.status !== "dominada");

/** Nome do calendário em texto corrido: "amanhã, em 7 dias, em 30 dias e em 90 dias". */
export function describeSchedule(schedule: number[]) {
  const parts = normalizeSchedule(schedule).map((d, i) => (i === 0 && d === 1 ? "amanhã" : `em ${d} dias`));
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/** Sequência de dias seguidos com alguma revisão feita (hoje sem revisão ainda não quebra). */
export function reviewStreak(items: ReviewItem[], today: string) {
  const days = new Set(items.flatMap((i) => i.history.map((h) => h.date)));
  let streak = 0;
  let cursor = days.has(today) ? today : shift(today, -1);
  while (days.has(cursor) && streak < 3650) {
    streak++;
    cursor = shift(cursor, -1);
  }
  return streak;
}

/** Tópicos já marcados como estudados/revisados em Matérias que não têm revisão (para migrar quem já usava o app). */
export function leafTopicsStudiedWithoutReview(subjects: Subject[], items: ReviewItem[]) {
  const out: { subject: Subject; topic: Topic }[] = [];
  for (const subject of subjects) {
    if (subject.archived) continue;
    for (const topic of topicsWithoutReview(subject, items)) if (topic.status >= 2) out.push({ subject, topic });
  }
  return out;
}
