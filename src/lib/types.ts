export type ExamId = "ITA" | "IME" | "EFOMM" | "EsPCEx";
export const EXAMS: ExamId[] = ["ITA", "IME", "EFOMM", "EsPCEx"];

export type ThemePref = "light" | "dark" | "system";

export interface Profile {
  name: string;
  exam: ExamId;
  examDate?: string | undefined; // yyyy-MM-dd
  weeklyHours: number;
  dailyHours: number;
  studyWeekdays: number[]; // 0 = domingo ... 6 = sábado
  weeklyGoal: number;
  monthlyGoal: number;
  reviewMinutes: number;
  readingMinutes: number;
  theme: ThemePref;
  reminders: { study?: string | undefined; review?: string | undefined; reading?: string | undefined };
  /** Preferências do sistema de revisão espaçada (ausente = padrão; ver reviewSettingsOf). */
  review?: Partial<ReviewSettings> | undefined;
}

/* ───────────── Revisão espaçada ───────────── */

/**
 * fixo = calendário de intervalos (ex.: 1, 7, 30, 90 dias), o método clássico dos concurseiros;
 * adaptativo = os intervalos crescem ou encolhem conforme a nota (SM-2, o algoritmo do Anki).
 */
export type ReviewMethod = "fixo" | "adaptativo";

/** 0 = esqueci, 1 = difícil, 2 = lembrei, 3 = fácil (os quatro botões do Anki). */
export type ReviewGrade = 0 | 1 | 2 | 3;

export interface ReviewSettings {
  method: ReviewMethod;
  /** Intervalos em dias do método fixo, em ordem crescente. */
  schedule: number[];
  /** Máximo de revisões na fila de um dia (0 = sem limite). O excedente fica para o dia seguinte. */
  dailyCap: number;
  /** Empurra revisões que caem em dia de descanso para o próximo dia útil. */
  skipRestDays: boolean;
  /** Agenda revisão sozinho quando um tópico passa para "estudado". */
  autoFromTopics: boolean;
}

export interface ReviewLog {
  date: string; // yyyy-MM-dd
  grade: ReviewGrade;
  /** Intervalo (dias) marcado depois desta revisão. */
  interval: number;
  createdAt: number;
}

export type ReviewStatus = "ativa" | "pausada" | "dominada";

/** Um assunto a ser revisado em intervalos crescentes. Normalmente nasce de um tópico da matéria. */
export interface ReviewItem {
  id: string;
  subjectId: string;
  /** Tópico (folha) da matéria, quando existe. */
  topicId?: string | undefined;
  title: string;
  /** Dia em que o conteúdo foi estudado pela primeira vez. */
  studiedOn: string;
  /** Próxima revisão (yyyy-MM-dd). */
  due: string;
  /** Posição no calendário fixo (0 = primeira revisão) / revisões certas seguidas no adaptativo. */
  step: number;
  /** Intervalo atual em dias. */
  interval: number;
  /** Fator de facilidade do SM-2 (começa em 2,5; mínimo 1,3). */
  ease: number;
  lapses: number;
  status: ReviewStatus;
  history: ReviewLog[];
  note: string;
  source: "topico" | "sessao" | "manual";
  createdAt: number;
}

/** 0 = não visto, 1 = estudando, 2 = estudado, 3 = revisado */
export type TopicStatus = 0 | 1 | 2 | 3;

/** Tópico de uma matéria. Pode ser dividido em subtópicos (children). */
export interface Topic {
  id: string;
  title: string;
  status: TopicStatus;
  /** Fora do programa: não entra nas contas de progresso. */
  skip: boolean;
  children: Topic[];
}

export interface Subject {
  id: string;
  name: string;
  difficulty: 1 | 2 | 3;
  multiplier: number;
  color: string;
  notes: string;
  archived: boolean;
  hourGoal?: number | undefined;
  /** Onde estudar (materiais, aulas, apostilas). */
  material?: string | undefined;
  /** Tópicos e subtópicos do programa. */
  topics?: Topic[] | undefined;
}

export type CycleStatus = "ativo" | "pausado" | "concluido" | "arquivado";

export interface Cycle {
  id: string;
  name: string;
  subjectIds: string[];
  dailyHours: number;
  weeklyHours: number;
  durationDays: number;
  restWeekdays: number[];
  goalHours: number;
  startDate: string;
  endDate?: string | undefined;
  status: CycleStatus;
}

export type SessionKind = "estudo" | "revisao" | "leitura";

export interface StudySession {
  id: string;
  date: string; // yyyy-MM-dd
  subjectId?: string | undefined;
  minutes: number;
  kind: SessionKind;
  note: string;
  source: "cronometro" | "manual";
  createdAt: number;
  groupId?: string | undefined;
}

export interface DayMeta {
  rest?: boolean | undefined; // override; undefined = usa padrão do perfil
  reviewDone?: boolean | undefined;
  readingDone?: boolean | undefined;
}

export type Repeat = "nenhuma" | "diaria" | "semanal";

export interface Commitment {
  id: string;
  name: string;
  date: string;
  start: string; // HH:mm
  end: string;
  repeat: Repeat;
  note: string;
  color: string;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  subjectId?: string | undefined;
  date: string;
  important: boolean;
  pinned: boolean;
  updatedAt: number;
}

export type BookStatus = "quero" | "lendo" | "concluido";

export interface Book {
  id: string;
  title: string;
  author: string;
  subjectId?: string | undefined;
  status: BookStatus;
  pagesTotal: number;
  pagesRead: number;
  notes: string;
  exam?: ExamId | undefined;
  finishedAt?: string | undefined;
  /** PDF correspondente na biblioteca online, se houver. */
  libraryId?: string | undefined;
}

export interface QuestionLog {
  id: string;
  date: string;
  exam: ExamId;
  subjectId?: string | undefined;
  topic: string;
  solved: number;
  correct: number;
  wrong: number;
  difficult: boolean;
  reviewLater: boolean;
  notes: string;
}

export interface PracticeAnswer {
  chosen: number;
  correct: boolean;
  date: string;
}

/* ───────────── Banco de questões ───────────── */

/** 1 = embasamento, 2 = fixação, 3 = desafio */
export type QLevel = 1 | 2 | 3;
export type AttemptResult = "certa" | "errada" | "branco";

export interface QuestionAttempt {
  id: string;
  date: string; // yyyy-MM-dd
  result: AttemptResult;
  timeSec?: number | undefined;
  /** Alternativa marcada (0 = A), se o aluno marcou alguma. */
  chosen?: number | undefined;
  note: string;
  reviewLater: boolean;
  createdAt: number;
}

export interface BankQuestion {
  id: string;
  /** Concurso de origem (ITA, EFOMM...), "Geral" ou um nome próprio. */
  exam: string;
  subjectId: string; // QSubject.id
  topicId: string; // QTopic.id
  level: QLevel;
  source: string;
  statement: string;
  /** Alternativas A a E; vazio quando a questão é discursiva. */
  options: string[];
  /** Letra (A–E) ou resposta por extenso. */
  answer: string;
  resolution: string;
  tags: string[];
  createdAt: number;
  attempts: QuestionAttempt[];
  /** Avisos de quem montou a questão (ex.: "alternativa sem texto (provável imagem)"). */
  pending?: string[];
}

export interface QTopic {
  id: string;
  name: string;
  hidden: boolean;
  /** Concursos em que o tópico costuma aparecer (vazio = não informado). */
  exams: string[];
  /** O aluno marcou que não consta no programa dele. */
  skip: boolean;
}

/** auto = aparece se a matéria é do concurso do perfil. */
export type QSubjectVisibility = "auto" | "on" | "off";

export interface QSubject {
  id: string;
  name: string;
  /** Concursos que cobram a matéria (vem da taxonomia). */
  exams: string[];
  visibility: QSubjectVisibility;
  custom: boolean;
  topics: QTopic[];
}

export interface QTaxonomy {
  subjects: QSubject[];
}

export interface TimerState {
  status: "parado" | "rodando" | "pausado";
  startedAt?: number | undefined; // epoch ms do trecho atual
  accumulatedMs: number;
}
