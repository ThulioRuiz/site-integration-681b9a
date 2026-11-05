import { format, parseISO, startOfWeek, subWeeks, addDays } from "date-fns";
import taxonomyData from "@/data/taxonomia.json";
import { LEGACY_PRACTICE } from "./legacy-practice";
import type {
  AttemptResult,
  BankQuestion,
  PracticeAnswer,
  QLevel,
  QSubject,
  QTaxonomy,
  QTopic,
  QuestionAttempt,
} from "./types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const LETTERS = ["A", "B", "C", "D", "E"] as const;
export const LEVELS: QLevel[] = [1, 2, 3];

export const LEVEL_INFO: Record<QLevel, { name: string; help: string }> = {
  1: { name: "Embasamento", help: "Para se familiarizar com o tópico. Aplicação direta do conceito." },
  2: { name: "Fixação", help: "Para gravar o conteúdo. Variações do que o tópico ensina." },
  3: { name: "Desafio", help: "As mais difíceis. Exigem raciocínio extra, cruzam tópicos ou tomam muito tempo." },
};

export const RESULT_LABEL: Record<AttemptResult, string> = { certa: "Certa", errada: "Errada", branco: "Em branco" };

/* ───────────── Taxonomia ───────────── */

interface TaxonomyFile {
  concursos: Record<string, string[]>;
  materias: Record<string, string[]>;
}

export function seedTaxonomy(): QTaxonomy {
  const data = taxonomyData as unknown as TaxonomyFile;
  const examsOf = (subject: string) =>
    Object.entries(data.concursos)
      .filter(([, list]) => list.includes(subject))
      .map(([exam]) => exam);
  return {
    subjects: Object.entries(data.materias).map(([name, topics]) => ({
      id: newId(),
      name,
      exams: examsOf(name),
      visibility: "auto",
      custom: false,
      topics: topics.map((t) => makeQTopic(t)),
    })),
  };
}

/** Matérias da taxonomia inicial que não estão (pelo nome) na lista do aluno. */
export function missingDefaultSubjects(tax: QTaxonomy): string[] {
  const data = taxonomyData as unknown as TaxonomyFile;
  return Object.keys(data.materias).filter((name) => !findSubjectByName(tax, name));
}

/**
 * Devolve as matérias padrão indicadas (com os tópicos originais), cada uma perto da posição em que estava
 * na lista inicial. Matérias que já existem ficam como estão.
 */
export function restoreDefaultSubjects(tax: QTaxonomy, names: string[]): QTaxonomy {
  const seed = seedTaxonomy().subjects;
  const wanted = new Set(names.map(normalizeText));
  const subjects = [...tax.subjects];
  seed.forEach((def, seedIndex) => {
    if (!wanted.has(normalizeText(def.name)) || findSubjectByName({ subjects }, def.name)) return;
    // Entra logo depois da última matéria padrão que vinha antes dela na lista inicial.
    let at = 0;
    for (let k = seedIndex - 1; k >= 0; k--) {
      const prev = findSubjectByName({ subjects }, seed[k]!.name);
      if (prev) { at = subjects.indexOf(prev) + 1; break; }
    }
    subjects.splice(at, 0, def);
  });
  return { subjects };
}

export const makeQTopic = (name: string): QTopic => ({ id: newId(), name, hidden: false, exams: [], skip: false });

export const makeQSubject = (name: string): QSubject => ({
  id: newId(),
  name,
  exams: [],
  visibility: "on",
  custom: true,
  topics: [],
});

export function isSubjectVisible(s: QSubject, profileExam: string | undefined) {
  if (s.visibility === "on") return true;
  if (s.visibility === "off") return false;
  return s.custom || (!!profileExam && s.exams.includes(profileExam));
}

export function visibleSubjects(tax: QTaxonomy, profileExam: string | undefined) {
  return tax.subjects.filter((s) => isSubjectVisible(s, profileExam));
}

/** Texto comparável: sem acento, minúsculo, sem pontuação e com espaços únicos. */
export function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export const dupKey = (source: string, statement: string) => `${normalizeText(source)}|${normalizeText(statement)}`;

export function findSubjectByName(tax: QTaxonomy, name: string) {
  const n = normalizeText(name);
  return tax.subjects.find((s) => normalizeText(s.name) === n);
}

export function findTopicByName(subject: QSubject, name: string) {
  const n = normalizeText(name);
  return subject.topics.find((t) => normalizeText(t.name) === n);
}

/** Garante matéria e tópico (cria os que faltam). Devolve a taxonomia nova e os ids. */
export function ensureTopic(tax: QTaxonomy, subjectName: string, topicName: string) {
  let subjects = tax.subjects;
  let subject = findSubjectByName(tax, subjectName);
  if (!subject) {
    subject = makeQSubject(subjectName.trim());
    subjects = [...subjects, subject];
  }
  let topic = findTopicByName(subject, topicName);
  if (!topic) {
    topic = makeQTopic(topicName.trim());
    const updated: QSubject = { ...subject, topics: [...subject.topics, topic] };
    subjects = subjects.map((s) => (s.id === updated.id ? updated : s));
  }
  return { tax: { subjects }, subjectId: subject.id, topicId: topic.id };
}

/* ───────────── Situação de cada questão ───────────── */

export type QStatus = "nao-feita" | "certa" | "errada" | "branco";

export const lastAttempt = (q: BankQuestion): QuestionAttempt | undefined => q.attempts[q.attempts.length - 1];

export function questionStatus(q: BankQuestion): QStatus {
  return lastAttempt(q)?.result ?? "nao-feita";
}

/** Entra no caderno de erros: última tentativa errada/em branco ou marcada para revisar. */
export function inErrorBook(q: BankQuestion) {
  const last = lastAttempt(q);
  return !!last && (last.result !== "certa" || last.reviewLater);
}

export type StatusFilter = "" | "nao-feita" | "certa" | "errada" | "revisar" | "pendencia";

export interface QFilters {
  exam: string;
  subjectId: string;
  topicId: string;
  level: "" | "1" | "2" | "3";
  source: string;
  status: StatusFilter;
}

export const EMPTY_FILTERS: QFilters = { exam: "", subjectId: "", topicId: "", level: "", source: "", status: "" };

export function matchesStatus(q: BankQuestion, status: StatusFilter) {
  if (!status) return true;
  const st = questionStatus(q);
  if (status === "revisar") return !!lastAttempt(q)?.reviewLater;
  if (status === "pendencia") return !!q.pending?.length;
  if (status === "errada") return st === "errada" || st === "branco";
  return st === status;
}

export function applyFilters(list: BankQuestion[], f: QFilters, skip: Partial<Record<keyof QFilters, boolean>> = {}) {
  const src = normalizeText(f.source);
  return list.filter(
    (q) =>
      (skip.exam || !f.exam || q.exam === f.exam) &&
      (skip.subjectId || !f.subjectId || q.subjectId === f.subjectId) &&
      (skip.topicId || !f.topicId || q.topicId === f.topicId) &&
      (skip.level || !f.level || String(q.level) === f.level) &&
      (skip.source || !src || normalizeText(q.source).includes(src)) &&
      (skip.status || matchesStatus(q, f.status)),
  );
}

/* ───────────── Estatísticas ───────────── */

export interface AttemptStats {
  questions: number;
  done: number; // questões com ao menos uma tentativa
  attempts: number;
  correct: number;
  wrong: number;
  blank: number;
  /** % de acerto sobre as tentativas (0–100) */
  rate: number;
}

export function attemptStats(list: BankQuestion[]): AttemptStats {
  const s = { questions: list.length, done: 0, attempts: 0, correct: 0, wrong: 0, blank: 0, rate: 0 };
  for (const q of list) {
    if (q.attempts.length) s.done++;
    for (const a of q.attempts) {
      s.attempts++;
      if (a.result === "certa") s.correct++;
      else if (a.result === "errada") s.wrong++;
      else s.blank++;
    }
  }
  s.rate = s.attempts ? (s.correct / s.attempts) * 100 : 0;
  return s;
}

/**
 * Sugere o próximo nível quando a maioria das questões do nível atual
 * (no mesmo tópico) está com a última tentativa certa. Nunca trava nada.
 */
export function shouldSuggestNextLevel(list: BankQuestion[], topicId: string, level: QLevel) {
  if (level >= 3) return false;
  const same = list.filter((q) => q.topicId === topicId && q.level === level);
  if (!same.length) return false;
  const right = same.filter((q) => questionStatus(q) === "certa").length;
  const hasNext = list.some((q) => q.topicId === topicId && q.level === level + 1);
  return hasNext && right > same.length / 2;
}

/** Acertos e erros por semana (segunda a domingo), das últimas `weeks` semanas. */
export function weeklyEvolution(list: BankQuestion[], weeks = 8, now = new Date()) {
  const first = startOfWeek(subWeeks(now, weeks - 1), { weekStartsOn: 1 });
  const rows = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(first, i * 7);
    return { key: format(start, "yyyy-MM-dd"), name: format(start, "dd/MM"), Acertos: 0, Erros: 0, "Em branco": 0 };
  });
  for (const q of list)
    for (const a of q.attempts) {
      const d = parseISO(a.date);
      const idx = Math.floor((d.getTime() - first.getTime()) / (7 * 86400000));
      const row = rows[idx];
      if (!row || idx < 0) continue;
      if (a.result === "certa") row.Acertos++;
      else if (a.result === "errada") row.Erros++;
      else row["Em branco"]++;
    }
  return rows;
}

/* ───────────── Colar questão ───────────── */

/** Separa enunciado e alternativas de um texto colado ("A) ...", "(B) ...", "c. ..."). */
export function parsePastedQuestion(text: string): { statement: string; options: string[] } {
  const lines = text.replace(/\r/g, "").split("\n");
  const re = /^\s*\(?([A-Ea-e])\s*[).\-–:]\s*(.*)$/;
  const statement: string[] = [];
  const options: string[] = [];
  let expected = 0;
  for (const line of lines) {
    const m = re.exec(line);
    const letter = m?.[1]?.toUpperCase();
    if (m && letter === LETTERS[expected]) {
      options.push((m[2] ?? "").trim());
      expected++;
    } else if (options.length) {
      options[options.length - 1] = `${options[options.length - 1]} ${line.trim()}`.trim();
    } else {
      statement.push(line);
    }
  }
  if (options.length < 2) return { statement: text.trim(), options: [] };
  return { statement: statement.join("\n").trim(), options };
}

/* ───────────── Importação ───────────── */

export const IMPORT_COLUMNS = [
  "concurso",
  "materia",
  "topico",
  "nivel",
  "fonte",
  "enunciado",
  "A",
  "B",
  "C",
  "D",
  "E",
  "gabarito",
  "resolucao",
] as const;

/** CSV com aspas; separador detectado na primeira linha (vírgula, ponto e vírgula ou tab). */
export function parseCSV(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split("\n", 1)[0] ?? "";
  const sep = [";", "\t", ","].reduce((best, c) => (firstLine.split(c).length > firstLine.split(best).length ? c : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const KEY_ALIASES: Record<string, string> = {
  materia: "materia",
  disciplina: "materia",
  topico: "topico",
  assunto: "topico",
  nivel: "nivel",
  concurso: "concurso",
  prova: "concurso",
  fonte: "fonte",
  enunciado: "enunciado",
  gabarito: "gabarito",
  resposta: "gabarito",
  resolucao: "resolucao",
  tags: "tags",
  motivo: "motivo",
  pendencia: "motivo",
  pendencias: "motivo",
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
};

const canonKey = (k: string) => KEY_ALIASES[normalizeText(k).replace(/ /g, "")] ?? normalizeText(k);

export type ImportRow = Record<string, string>;
export type ImportKind = "questoes" | "pendencias";

/**
 * Aceita JSON (lista ou { questoes: [...] }) ou CSV com cabeçalho.
 * Um CSV com a coluna "motivo" e sem "enunciado" é uma lista de pendências
 * (materia, questao, pagina, motivo, fonte), ligada às questões pela fonte.
 */
export function parseImportText(text: string): { rows: ImportRow[]; kind: ImportKind; error?: string } {
  const t = text.replace(/^\uFEFF/, "").trim();
  if (!t) return { rows: [], kind: "questoes", error: "Cole o conteúdo em JSON ou CSV." };
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const data = JSON.parse(t) as unknown;
      const list = Array.isArray(data)
        ? data
        : data && typeof data === "object" && Array.isArray((data as { questoes?: unknown }).questoes)
          ? ((data as { questoes: unknown[] }).questoes)
          : null;
      if (!list) return { rows: [], kind: "questoes", error: "O JSON deve ser uma lista de questões ou { \"questoes\": [...] }." };
      const rows = list.map((item) => {
        const row: ImportRow = {};
        if (!item || typeof item !== "object") return row;
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          const key = canonKey(k);
          if (key === "alternativas" && Array.isArray(v)) {
            v.forEach((o, i) => {
              const L = LETTERS[i];
              if (L) row[L] = String(o ?? "");
            });
          } else if (key === "alternativas" && v && typeof v === "object") {
            for (const [lk, lv] of Object.entries(v as Record<string, unknown>)) row[lk.toUpperCase()] = String(lv ?? "");
          } else if (key === "tags" && Array.isArray(v)) row["tags"] = v.join(", ");
          else row[key] = v == null ? "" : String(v);
        }
        return row;
      });
      return { rows, kind: "questoes" };
    } catch {
      return { rows: [], kind: "questoes", error: "JSON inválido. Confira vírgulas e aspas." };
    }
  }
  const table = parseCSV(t);
  const header = table[0]?.map(canonKey) ?? [];
  const rows = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
  if (!header.includes("enunciado")) {
    if (header.includes("motivo") && header.includes("fonte")) return { rows, kind: "pendencias" };
    return { rows: [], kind: "questoes", error: "O CSV precisa de uma linha de cabeçalho com a coluna \"enunciado\"." };
  }
  return { rows, kind: "questoes" };
}

/* ───────────── Pendências ───────────── */

const sourceKey = (s: string) => normalizeText(s);

/** Agrupa os motivos das pendências pela fonte da questão. */
export function pendingBySource(rows: ImportRow[]) {
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const src = (r["fonte"] ?? "").trim();
    const motivo = (r["motivo"] ?? "").trim();
    if (!src || !motivo) continue;
    const k = sourceKey(src);
    const list = map.get(k) ?? [];
    if (!list.includes(motivo)) list.push(motivo);
    map.set(k, list);
  }
  return map;
}

/**
 * Anexa as pendências às questões com a mesma fonte. Devolve a lista nova,
 * quantas questões receberam aviso e as fontes que não bateram com nenhuma questão.
 */
export function attachPending(list: BankQuestion[], pending: Map<string, string[]>) {
  const used = new Set<string>();
  let matched = 0;
  const out = list.map((q) => {
    const add = q.source ? pending.get(sourceKey(q.source)) : undefined;
    if (!add) return q;
    used.add(sourceKey(q.source));
    const merged = [...(q.pending ?? [])];
    for (const m of add) if (!merged.includes(m)) merged.push(m);
    if (merged.length === (q.pending?.length ?? 0)) return q;
    matched++;
    return { ...q, pending: merged };
  });
  const unmatched = [...pending.keys()].filter((k) => !used.has(k)).length;
  return { list: out, matched, unmatched };
}

export interface ImportIssue {
  line: number;
  file?: string | undefined;
  reason: string;
  missing?: { subject: string; topic: string } | undefined;
}

export interface ImportReport {
  questions: BankQuestion[];
  rejected: ImportIssue[];
  taxonomy: QTaxonomy;
  createdTopics: string[];
}

/**
 * Valida as linhas. Com `createMissing`, matérias e tópicos desconhecidos são criados;
 * sem isso, a linha é recusada com o motivo.
 */
export function validateImport(
  rows: ImportRow[],
  taxonomy: QTaxonomy,
  existing: BankQuestion[],
  opts: { createMissing: boolean; defaultExam: string },
): ImportReport {
  let tax = taxonomy;
  const seen = new Set(existing.map((q) => dupKey(q.source, q.statement)));
  const questions: BankQuestion[] = [];
  const rejected: ImportIssue[] = [];
  const createdTopics: string[] = [];
  rows.forEach((r, i) => {
    const get = (k: string) => (r[k] ?? "").trim();
    const line = Number(r["__line"]) || i + 1;
    const file = r["__file"] || undefined;
    const reject = (issue: Omit<ImportIssue, "line" | "file">) => rejected.push({ line, file, ...issue });
    const statement = get("enunciado");
    const subjectName = get("materia");
    const topicName = get("topico");
    const levelRaw = get("nivel");
    const level = Number(levelRaw || "1");
    if (!statement) return reject({ reason: "Enunciado vazio" });
    if (!subjectName) return reject({ reason: "Matéria não informada" });
    if (!topicName) return reject({ reason: "Tópico não informado" });
    if (![1, 2, 3].includes(level)) return reject({ reason: `Nível fora de 1 a 3 ("${levelRaw}")` });
    const subject = findSubjectByName(tax, subjectName);
    const topic = subject && findTopicByName(subject, topicName);
    if (!subject && !opts.createMissing)
      return reject({ reason: `Matéria desconhecida: ${subjectName}`, missing: { subject: subjectName, topic: topicName } });
    if (!topic && !opts.createMissing)
      return reject({ reason: `Tópico desconhecido: ${subjectName} › ${topicName}`, missing: { subject: subjectName, topic: topicName } });
    const source = get("fonte");
    const key = dupKey(source, statement);
    if (seen.has(key)) return reject({ reason: "Duplicada (mesma fonte e enunciado)" });
    seen.add(key);
    const ensured = ensureTopic(tax, subjectName, topicName);
    if (!subject || !topic) createdTopics.push(`${subject?.name ?? subjectName} › ${topicName}`);
    tax = ensured.tax;
    const options = LETTERS.map((L) => get(L));
    while (options.length && !options[options.length - 1]) options.pop();
    const ans = get("gabarito");
    questions.push({
      id: newId(),
      exam: get("concurso") || opts.defaultExam,
      subjectId: ensured.subjectId,
      topicId: ensured.topicId,
      level: level as QLevel,
      source,
      statement,
      options,
      answer: /^[a-e]$/i.test(ans) ? ans.toUpperCase() : ans,
      resolution: get("resolucao"),
      tags: get("tags").split(/[,;]/).map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now() + i,
      attempts: [],
      ...(get("motivo") ? { pending: [get("motivo")] } : {}),
    });
    return undefined;
  });
  return { questions, rejected, taxonomy: tax, createdTopics };
}

/* ───────────── Exportação ───────────── */

export function questionsToRows(list: BankQuestion[], tax: QTaxonomy) {
  const subj = new Map(tax.subjects.map((s) => [s.id, s]));
  return list.map((q) => {
    const s = subj.get(q.subjectId);
    const row: Record<string, string> = {
      concurso: q.exam,
      materia: s?.name ?? "",
      topico: s?.topics.find((t) => t.id === q.topicId)?.name ?? "",
      nivel: String(q.level),
      fonte: q.source,
      enunciado: q.statement,
    };
    LETTERS.forEach((L, i) => (row[L] = q.options[i] ?? ""));
    row["gabarito"] = q.answer;
    row["resolucao"] = q.resolution;
    row["tags"] = q.tags.join(", ");
    row["motivo"] = (q.pending ?? []).join("; ");
    return row;
  });
}

export function exportJSON(list: BankQuestion[], tax: QTaxonomy) {
  return JSON.stringify(questionsToRows(list, tax), null, 2);
}

export function exportCSV(list: BankQuestion[], tax: QTaxonomy) {
  const cols = [...IMPORT_COLUMNS, "tags", "motivo"];
  const esc = (v: string) => (/[",;\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = questionsToRows(list, tax);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
}

/* ───────────── Migração ───────────── */

export const DATA_VERSION = 2;

interface Upgradable {
  version?: number;
  practice?: Record<string, PracticeAnswer> | undefined;
  questionBank?: BankQuestion[] | undefined;
  qTaxonomy?: QTaxonomy | null | undefined;
}

/**
 * Converte dados salvos antes do banco de questões (versão 1):
 * - respostas da antiga aba "Praticar" viram questões do banco do aluno, com a tentativa;
 * - os registros em lote (questionLogs) continuam como estão.
 * Pode rodar mais de uma vez sem duplicar nada.
 */
export function upgradeQuestionData<T extends Upgradable>(d: T): T & { questionBank: BankQuestion[]; qTaxonomy: QTaxonomy | null; version: 2 } {
  let bank = Array.isArray(d.questionBank) ? d.questionBank : [];
  let tax = d.qTaxonomy ?? null;
  const practice = d.practice ?? {};
  const entries = Object.entries(practice);
  if (entries.length) {
    tax ??= seedTaxonomy();
    const ids = new Set(bank.map((q) => q.id));
    const migrated: BankQuestion[] = [];
    for (const [qid, ans] of entries) {
      const legacy = LEGACY_PRACTICE.find((q) => q.id === qid);
      if (!legacy || ids.has(`legacy-${qid}`)) continue;
      const ensured = ensureTopic(tax, legacy.subject, legacy.topic);
      tax = ensured.tax;
      migrated.push({
        id: `legacy-${qid}`,
        exam: legacy.exam,
        subjectId: ensured.subjectId,
        topicId: ensured.topicId,
        level: 1,
        source: "Treino do app (versão anterior)",
        statement: legacy.statement,
        options: legacy.options,
        answer: LETTERS[legacy.answer] ?? "",
        resolution: legacy.explanation,
        tags: ["treino-antigo"],
        createdAt: Date.now(),
        attempts: [
          {
            id: newId(),
            date: ans.date,
            result: ans.correct ? "certa" : "errada",
            chosen: ans.chosen,
            note: "",
            reviewLater: false,
            createdAt: Date.now(),
          },
        ],
      });
    }
    bank = [...bank, ...migrated];
  }
  return { ...d, version: 2, questionBank: bank, qTaxonomy: tax, practice: {} };
}
