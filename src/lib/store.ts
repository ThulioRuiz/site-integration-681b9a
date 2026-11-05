import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { addDays, format, parseISO } from "date-fns";
import { useMemo } from "react";
import { SUGGESTED_SUBJECTS, ymd } from "./calc";
import { mapTopic, suggestedTopics } from "./topics";
import { attachPending, DATA_VERSION, makeQTopic, restoreDefaultSubjects, seedTaxonomy, upgradeQuestionData } from "./qbank";
import { dueQueue, gradeItem, makeReviewItem, restartItem, reviewSettingsOf, spreadOverdue, type MakeReviewInput } from "./review";
import type {
  BankQuestion,
  Book,
  Commitment,
  Cycle,
  DayMeta,
  ExamId,
  Note,
  PracticeAnswer,
  Profile,
  QSubject,
  QTaxonomy,
  QuestionAttempt,
  QuestionLog,
  ReviewGrade,
  ReviewItem,
  ReviewStatus,
  StudySession,
  Subject,
  TimerState,
} from "./types";

export const SUBJECT_COLORS = [
  "oklch(0.55 0.12 135)",
  "oklch(0.6 0.13 30)",
  "oklch(0.58 0.11 230)",
  "oklch(0.72 0.13 80)",
  "oklch(0.55 0.13 320)",
  "oklch(0.6 0.1 180)",
  "oklch(0.5 0.1 270)",
  "oklch(0.65 0.14 55)",
  "oklch(0.5 0.06 110)",
  "oklch(0.6 0.15 0)",
];

export const pickColor = (i: number): string =>
  SUBJECT_COLORS[((i % SUBJECT_COLORS.length) + SUBJECT_COLORS.length) % SUBJECT_COLORS.length] ?? "oklch(0.55 0.1 130)";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const DIFFICULTY_DEFAULT: Record<string, 1 | 2 | 3> = {
  Matemática: 3,
  Física: 3,
  Química: 2,
};

export function buildSuggestedSubjects(exam: ExamId): Subject[] {
  return SUGGESTED_SUBJECTS[exam].map((name, i) => {
    const d = DIFFICULTY_DEFAULT[name] ?? 1;
    return {
      id: uid(),
      name,
      difficulty: d,
      multiplier: d,
      color: pickColor(i),
      notes: "",
      archived: false,
      ...suggestedTopics(exam, name),
    };
  });
}

export interface AppData {
  /** 1 = antes do banco de questões; 2 = com banco (ver upgradeQuestionData). */
  version: 1 | 2;
  profile: Profile | null;
  subjects: Subject[];
  cycles: Cycle[];
  sessions: StudySession[];
  dayMeta: Record<string, DayMeta>;
  commitments: Commitment[];
  notes: Note[];
  books: Book[];
  /** Registros em lote (só contagem de certas/erradas). */
  questionLogs: QuestionLog[];
  /** Legado da antiga aba "Praticar"; migrado para questionBank. */
  practice: Record<string, PracticeAnswer>;
  /** Banco de questões do aluno. */
  questionBank: BankQuestion[];
  /** Matérias e tópicos do banco (null até a primeira abertura da aba). */
  qTaxonomy: QTaxonomy | null;
  /** Revisões espaçadas (ver src/lib/review.ts). */
  reviews: ReviewItem[];
  timer: TimerState;
  lastReviewedMonth?: string | undefined; // yyyy-MM
}

interface Actions {
  completeSetup: (p: Profile, subjects: Subject[]) => void;
  updateProfile: (p: Partial<Profile>) => void;
  switchExam: (exam: ExamId, addSuggested: boolean) => void;

  upsertSubject: (s: Subject) => void;
  removeSubject: (id: string) => void;

  upsertCycle: (c: Cycle) => void;
  removeCycle: (id: string) => void;
  duplicateCycle: (id: string) => void;
  activateCycle: (id: string) => void;

  addSessions: (s: StudySession[]) => void;
  updateSession: (s: StudySession) => void;
  removeSession: (id: string) => void;
  removeGroup: (groupId: string) => void;

  setDayMeta: (date: string, patch: Partial<DayMeta>) => void;

  upsertCommitment: (c: Commitment) => void;
  removeCommitment: (id: string) => void;

  upsertNote: (n: Note) => void;
  removeNote: (id: string) => void;

  upsertBook: (b: Book) => void;
  removeBook: (id: string) => void;

  upsertQuestionLog: (q: QuestionLog) => void;
  removeQuestionLog: (id: string) => void;

  ensureTaxonomy: () => void;
  setTaxonomy: (t: QTaxonomy) => void;
  restoreQSubjects: (names: string[]) => void;
  upsertQSubject: (s: QSubject) => void;
  removeQSubject: (id: string) => void;
  moveQSubject: (id: string, dir: -1 | 1) => void;
  addQTopic: (subjectId: string, name: string) => void;
  removeQTopic: (subjectId: string, topicId: string) => void;
  upsertQuestion: (q: BankQuestion) => void;
  /** Anexa avisos (pendências) às questões já salvas, pela fonte. */
  applyPending: (pending: Map<string, string[]>) => { matched: number; unmatched: number };
  setQuestionAnswer: (questionId: string, answer: string) => void;
  clearPending: (questionId: string) => void;
  addQuestions: (qs: BankQuestion[]) => void;
  removeQuestion: (id: string) => void;
  addAttempt: (questionId: string, a: QuestionAttempt) => void;
  setReviewLater: (questionId: string, value: boolean) => void;

  /** Agenda revisões; ignora tópicos que já têm revisão ativa. Devolve as criadas. */
  scheduleReviews: (inputs: Omit<MakeReviewInput, "id">[], studiedOn?: string) => ReviewItem[];
  upsertReview: (r: ReviewItem) => void;
  removeReview: (id: string) => void;
  /** Registra a nota de hoje, remarca a próxima data e marca o tópico como revisado. */
  gradeReview: (id: string, grade: ReviewGrade) => ReviewItem | undefined;
  postponeReview: (id: string, days: number) => void;
  setReviewStatus: (id: string, status: ReviewStatus) => void;
  restartReview: (id: string) => void;
  /** Espalha as atrasadas pelos próximos dias. Devolve quantas foram remarcadas. */
  spreadOverdue: (days: number) => number;

  timerStart: () => void;
  timerPause: () => void;
  timerResume: () => void;
  timerReset: () => void;

  setLastReviewedMonth: (m: string) => void;
  importData: (d: AppData) => void;
  resetAll: () => void;
}

const initial: AppData = {
  version: 2,
  profile: null,
  subjects: [],
  cycles: [],
  sessions: [],
  dayMeta: {},
  commitments: [],
  notes: [],
  books: [],
  questionLogs: [],
  practice: {},
  questionBank: [],
  qTaxonomy: null,
  reviews: [],
  timer: { status: "parado", accumulatedMs: 0 },
};

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

/**
 * Os dados ficam no IndexedDB do navegador: o banco de questões pode ter milhares de
 * enunciados e passar do limite do localStorage (~5 MB). Dados antigos que ainda estão
 * no localStorage são lidos de lá e migram na primeira gravação. Sem IndexedDB, usa o
 * localStorage. Se faltar espaço, avisa em vez de perder a gravação em silêncio.
 */
const IDB_NAME = "quartel-estudos";
const IDB_STORE = "kv";
let idbPromise: Promise<IDBDatabase> | null = null;

function openIdb() {
  idbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((err: unknown) => {
    idbPromise = null;
    throw err;
  });
  return idbPromise;
}

async function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  const db = await openIdb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode);
    const req = run(tx.objectStore(IDB_STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
  });
}

let quotaWarned = false;
function warnStorageFull(err: unknown) {
  console.error("Falha ao salvar os dados", err);
  if (quotaWarned) return;
  quotaWarned = true;
  window.dispatchEvent(new CustomEvent("quartel:storage-full"));
}

const appStorage: StateStorage = {
  getItem: async (k) => {
    try {
      const v = await idb<unknown>("readonly", (s) => s.get(k));
      if (typeof v === "string") return v;
    } catch {
      /* sem IndexedDB: segue para o localStorage */
    }
    return localStorage.getItem(k);
  },
  setItem: async (k, v) => {
    try {
      await idb("readwrite", (s) => s.put(v, k));
      quotaWarned = false;
      if (localStorage.getItem(k) !== null) localStorage.removeItem(k);
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "QuotaExceededError") return warnStorageFull(err);
    }
    try {
      localStorage.setItem(k, v);
      quotaWarned = false;
    } catch (err) {
      warnStorageFull(err);
    }
  },
  removeItem: async (k) => {
    localStorage.removeItem(k);
    try {
      await idb("readwrite", (s) => s.delete(k));
    } catch {
      /* nada a apagar */
    }
  },
};

export const useApp = create<AppData & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      completeSetup: (profile, subjects) => {
        const today = ymd(new Date());
        const rest = [0, 1, 2, 3, 4, 5, 6].filter((d) => !profile.studyWeekdays.includes(d));
        const cycle: Cycle = {
          id: uid(),
          name: "Ciclo A",
          subjectIds: subjects.filter((s) => !s.archived).map((s) => s.id),
          dailyHours: profile.dailyHours,
          weeklyHours: profile.weeklyHours,
          durationDays: 7,
          restWeekdays: rest,
          goalHours: profile.weeklyHours,
          startDate: today,
          status: "ativo",
        };
        set({
          profile,
          subjects,
          cycles: [cycle],
          lastReviewedMonth: format(new Date(), "yyyy-MM"),
        });
      },
      updateProfile: (p) => {
        const cur = get().profile;
        if (cur) set({ profile: { ...cur, ...p } });
      },
      switchExam: (exam, addSuggested) => {
        const cur = get().profile;
        if (!cur) return;
        let subjects = get().subjects;
        if (addSuggested) {
          const names = new Set(subjects.map((s) => s.name.toLowerCase()));
          const extra = buildSuggestedSubjects(exam).filter((s) => !names.has(s.name.toLowerCase()));
          subjects = [...subjects, ...extra];
        }
        set({ profile: { ...cur, exam }, subjects });
      },

      upsertSubject: (s) => set({ subjects: upsert(get().subjects, s) }),
      removeSubject: (id) =>
        set({
          subjects: get().subjects.filter((s) => s.id !== id),
          cycles: get().cycles.map((c) => ({
            ...c,
            subjectIds: c.subjectIds.filter((x) => x !== id),
          })),
        }),

      upsertCycle: (c) => set({ cycles: upsert(get().cycles, c) }),
      removeCycle: (id) => set({ cycles: get().cycles.filter((c) => c.id !== id) }),
      duplicateCycle: (id) => {
        const c = get().cycles.find((x) => x.id === id);
        if (!c) return;
        set({
          cycles: [
            ...get().cycles,
            { ...c, id: uid(), name: `${c.name} (cópia)`, status: "pausado", startDate: ymd(new Date()) },
          ],
        });
      },
      activateCycle: (id) =>
        set({
          cycles: get().cycles.map((c) =>
            c.id === id
              ? { ...c, status: "ativo" }
              : c.status === "ativo"
                ? { ...c, status: "pausado" }
                : c,
          ),
        }),

      addSessions: (s) => set({ sessions: [...get().sessions, ...s] }),
      updateSession: (s) => set({ sessions: upsert(get().sessions, s) }),
      removeSession: (id) => set({ sessions: get().sessions.filter((s) => s.id !== id) }),
      removeGroup: (groupId) => set({ sessions: get().sessions.filter((s) => s.groupId !== groupId) }),

      setDayMeta: (date, patch) =>
        set({ dayMeta: { ...get().dayMeta, [date]: { ...get().dayMeta[date], ...patch } } }),

      upsertCommitment: (c) => set({ commitments: upsert(get().commitments, c) }),
      removeCommitment: (id) => set({ commitments: get().commitments.filter((c) => c.id !== id) }),

      upsertNote: (n) => set({ notes: upsert(get().notes, n) }),
      removeNote: (id) => set({ notes: get().notes.filter((n) => n.id !== id) }),

      upsertBook: (b) => set({ books: upsert(get().books, b) }),
      removeBook: (id) => set({ books: get().books.filter((b) => b.id !== id) }),

      upsertQuestionLog: (q) => set({ questionLogs: upsert(get().questionLogs, q) }),
      removeQuestionLog: (id) => set({ questionLogs: get().questionLogs.filter((q) => q.id !== id) }),

      ensureTaxonomy: () => {
        if (!get().qTaxonomy) set({ qTaxonomy: seedTaxonomy() });
      },
      setTaxonomy: (t) => set({ qTaxonomy: t }),
      restoreQSubjects: (names) => set({ qTaxonomy: restoreDefaultSubjects(get().qTaxonomy ?? seedTaxonomy(), names) }),
      upsertQSubject: (subj) => {
        const t = get().qTaxonomy ?? seedTaxonomy();
        set({ qTaxonomy: { subjects: upsert(t.subjects, subj) } });
      },
      removeQSubject: (id) => {
        const t = get().qTaxonomy;
        if (!t) return;
        set({
          qTaxonomy: { subjects: t.subjects.filter((x) => x.id !== id) },
          questionBank: get().questionBank.filter((q) => q.subjectId !== id),
        });
      },
      moveQSubject: (id, dir) => {
        const t = get().qTaxonomy;
        if (!t) return;
        const list = [...t.subjects];
        const i = list.findIndex((x) => x.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j]!, list[i]!];
        set({ qTaxonomy: { subjects: list } });
      },
      addQTopic: (subjectId, name) => {
        const t = get().qTaxonomy;
        if (!t) return;
        set({
          qTaxonomy: {
            subjects: t.subjects.map((x) => (x.id === subjectId ? { ...x, topics: [...x.topics, makeQTopic(name)] } : x)),
          },
        });
      },
      removeQTopic: (subjectId, topicId) => {
        const t = get().qTaxonomy;
        if (!t) return;
        set({
          qTaxonomy: {
            subjects: t.subjects.map((x) =>
              x.id === subjectId ? { ...x, topics: x.topics.filter((tp) => tp.id !== topicId) } : x,
            ),
          },
          questionBank: get().questionBank.filter((q) => q.topicId !== topicId),
        });
      },
      upsertQuestion: (q) => set({ questionBank: upsert(get().questionBank, q) }),
      addQuestions: (qs) => set({ questionBank: [...get().questionBank, ...qs] }),
      applyPending: (pending) => {
        const r = attachPending(get().questionBank, pending);
        if (r.matched) set({ questionBank: r.list });
        return { matched: r.matched, unmatched: r.unmatched };
      },
      setQuestionAnswer: (questionId, answer) =>
        set({ questionBank: get().questionBank.map((q) => (q.id === questionId ? { ...q, answer } : q)) }),
      clearPending: (questionId) =>
        set({
          questionBank: get().questionBank.map((q) => {
            if (q.id !== questionId || !q.pending) return q;
            const { pending: _drop, ...rest } = q;
            return rest;
          }),
        }),
      removeQuestion: (id) => set({ questionBank: get().questionBank.filter((q) => q.id !== id) }),
      addAttempt: (questionId, a) =>
        set({
          questionBank: get().questionBank.map((q) => (q.id === questionId ? { ...q, attempts: [...q.attempts, a] } : q)),
        }),
      setReviewLater: (questionId, value) =>
        set({
          questionBank: get().questionBank.map((q) => {
            if (q.id !== questionId || !q.attempts.length) return q;
            const attempts = [...q.attempts];
            attempts[attempts.length - 1] = { ...attempts[attempts.length - 1]!, reviewLater: value };
            return { ...q, attempts };
          }),
        }),

      scheduleReviews: (inputs, studiedOn) => {
        const st = get();
        const settings = reviewSettingsOf(st.profile);
        const rest = st.profile ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !st.profile!.studyWeekdays.includes(d)) : [];
        const active = new Set(st.reviews.filter((r) => r.status !== "dominada" && r.topicId).map((r) => r.topicId));
        const day = studiedOn ?? ymd(new Date());
        const created: ReviewItem[] = [];
        for (const input of inputs) {
          if (input.topicId && active.has(input.topicId)) continue;
          if (!input.title.trim()) continue;
          if (input.topicId) active.add(input.topicId);
          created.push(makeReviewItem({ ...input, id: uid(), studiedOn: input.studiedOn || day }, settings, rest, st.dayMeta));
        }
        if (created.length) set({ reviews: [...st.reviews, ...created] });
        return created;
      },
      upsertReview: (r) => set({ reviews: upsert(get().reviews, r) }),
      removeReview: (id) => set({ reviews: get().reviews.filter((r) => r.id !== id) }),
      gradeReview: (id, grade) => {
        const st = get();
        const item = st.reviews.find((r) => r.id === id);
        if (!item) return undefined;
        const settings = reviewSettingsOf(st.profile);
        const rest = st.profile ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !st.profile!.studyWeekdays.includes(d)) : [];
        const today = ymd(new Date());
        const graded = gradeItem(item, grade, today, settings, rest, st.dayMeta, Date.now(), st.profile?.examDate);
        const reviews = st.reviews.map((r) => (r.id === id ? graded : r));
        // Tópico da matéria acompanha: lembrou → "revisado"; esqueceu → volta a "estudado".
        const subjects = item.topicId
          ? st.subjects.map((s) =>
              s.id === item.subjectId && s.topics
                ? { ...s, topics: mapTopic(s.topics, item.topicId!, (t) => ({ ...t, status: grade >= 2 ? 3 : t.status === 3 ? 2 : t.status })) }
                : s,
            )
          : st.subjects;
        const left = dueQueue(reviews, today, settings).queue.length;
        const dayMeta = left === 0 ? { ...st.dayMeta, [today]: { ...st.dayMeta[today], reviewDone: true } } : st.dayMeta;
        set({ reviews, subjects, dayMeta });
        return graded;
      },
      postponeReview: (id, days) => {
        const today = ymd(new Date());
        set({ reviews: get().reviews.map((r) => (r.id === id ? { ...r, due: ymd(addDays(parseISO(r.due < today ? today : r.due), days)) } : r)) });
      },
      setReviewStatus: (id, status) => set({ reviews: get().reviews.map((r) => (r.id === id ? { ...r, status } : r)) }),
      spreadOverdue: (days) => {
        const st = get();
        const today = ymd(new Date());
        const settings = reviewSettingsOf(st.profile);
        const perDay = settings.dailyCap > 0 ? settings.dailyCap : 5;
        const late = st.reviews.filter((r) => r.status === "ativa" && r.due < today).length;
        if (late) set({ reviews: spreadOverdue(st.reviews, today, days, perDay) });
        return late;
      },
      restartReview: (id) => {
        const st = get();
        const rest = st.profile ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !st.profile!.studyWeekdays.includes(d)) : [];
        set({ reviews: st.reviews.map((r) => (r.id === id ? restartItem(r, ymd(new Date()), reviewSettingsOf(st.profile), rest, st.dayMeta) : r)) });
      },

      timerStart: () => set({ timer: { status: "rodando", startedAt: Date.now(), accumulatedMs: 0 } }),
      timerPause: () => {
        const t = get().timer;
        if (t.status !== "rodando" || !t.startedAt) return;
        set({
          timer: { status: "pausado", accumulatedMs: t.accumulatedMs + (Date.now() - t.startedAt) },
        });
      },
      timerResume: () => {
        const t = get().timer;
        if (t.status !== "pausado") return;
        set({ timer: { ...t, status: "rodando", startedAt: Date.now() } });
      },
      timerReset: () => set({ timer: { status: "parado", accumulatedMs: 0 } }),

      setLastReviewedMonth: (m) => set({ lastReviewedMonth: m }),
      importData: (d) => set({ ...initial, ...upgradeQuestionData(d), reviews: Array.isArray(d.reviews) ? d.reviews : [] }),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: "quartel-estudos-v1",
      storage: createJSONStorage(() => appStorage),
      skipHydration: true,
      version: DATA_VERSION,
      // Dados salvos antes do banco de questões: converte e mantém tudo o que já existia.
      migrate: (persisted) => upgradeQuestionData((persisted ?? {}) as Partial<AppData>) as unknown as AppData & Actions,
      partialize: (s) => {
        const { version, profile, subjects, cycles, sessions, dayMeta, commitments, notes, books, questionLogs, practice, questionBank, qTaxonomy, reviews, timer, lastReviewedMonth } = s;
        return { version, profile, subjects, cycles, sessions, dayMeta, commitments, notes, books, questionLogs, practice, questionBank, qTaxonomy, reviews, timer, lastReviewedMonth };
      },
    },
  ),
);

/**
 * Cada conta tem seus próprios dados neste aparelho. Chame antes da primeira hidratação;
 * trocar de conta recarrega a página (ver AppShell).
 */
export function bindStoreToUser(userId: string) {
  useApp.persist.setOptions({ name: `quartel-estudos-v1:${userId}` });
}

export function exportSnapshot(): AppData {
  const s = useApp.getState();
  return {
    version: 2,
    profile: s.profile,
    subjects: s.subjects,
    cycles: s.cycles,
    sessions: s.sessions,
    dayMeta: s.dayMeta,
    commitments: s.commitments,
    notes: s.notes,
    books: s.books,
    questionLogs: s.questionLogs,
    practice: s.practice,
    questionBank: s.questionBank,
    qTaxonomy: s.qTaxonomy,
    reviews: s.reviews,
    timer: s.timer,
    lastReviewedMonth: s.lastReviewedMonth,
  };
}

export function timerElapsedMs(t: TimerState, now = Date.now()) {
  return t.accumulatedMs + (t.status === "rodando" && t.startedAt ? now - t.startedAt : 0);
}

export function useSubjectMap() {
  const subjects = useApp((s) => s.subjects);
  return useMemo(
    () => Object.fromEntries(subjects.map((s) => [s.id, s])) as Record<string, Subject>,
    [subjects],
  );
}

export function useRestWeekdays() {
  const study = useApp((s) => s.profile?.studyWeekdays);
  return useMemo(
    () => (study ? [0, 1, 2, 3, 4, 5, 6].filter((d) => !study.includes(d)) : [0]),
    [study],
  );
}

export function useActiveCycle() {
  return useApp((s) => s.cycles.find((c) => c.status === "ativo"));
}

export function useReviewSettings() {
  const review = useApp((s) => s.profile?.review);
  return useMemo(() => reviewSettingsOf({ review }), [review]);
}

/** Fila de revisões de hoje (com limite diário) e resumo, recalculados quando o dia muda. */
export function useDueReviews(today: string) {
  const reviews = useApp((s) => s.reviews);
  const settings = useReviewSettings();
  return useMemo(() => dueQueue(reviews, today, settings), [reviews, today, settings]);
}
