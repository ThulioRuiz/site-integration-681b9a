import type { Book, ExamId, Subject } from "./types";

export interface BookSuggestion {
  title: string;
  author: string;
  subject: string;
  level: 1 | 2 | 3; // 1 base, 2 intermediário, 3 aprofundado
  exams: ExamId[];
  why: string;
}

const ALL: ExamId[] = ["ITA", "IME", "EFOMM", "EsPCEx"];
const MIL: ExamId[] = ["ITA", "IME"];

export const BOOK_CATALOG: BookSuggestion[] = [
  // Matemática
  { title: "Fundamentos de Matemática Elementar (coleção)", author: "Gelson Iezzi et al.", subject: "Matemática", level: 2, exams: ALL, why: "Teoria completa e muitos exercícios por assunto." },
  { title: "A Matemática do Ensino Médio", author: "Elon Lages Lima et al. (SBM)", subject: "Matemática", level: 3, exams: MIL, why: "Rigor conceitual exigido no ITA e no IME." },
  { title: "Problemas Selecionados de Matemática", author: "Antonio Luiz Santos et al.", subject: "Matemática", level: 3, exams: MIL, why: "Questões resolvidas de vestibulares militares de alto nível." },
  { title: "Matemática: Ciência e Aplicações", author: "Gelson Iezzi et al.", subject: "Matemática", level: 1, exams: ["EFOMM", "EsPCEx"], why: "Base sólida e direta para EFOMM e EsPCEx." },
  { title: "Matemática Paiva", author: "Manoel Paiva", subject: "Matemática", level: 1, exams: ["EsPCEx", "EFOMM"], why: "Didático, bom para revisar conteúdo do médio." },
  // Física
  { title: "Tópicos de Física", author: "Helou, Gualter e Newton", subject: "Física", level: 2, exams: ALL, why: "Exercícios graduados do básico ao avançado." },
  { title: "Física Clássica", author: "Calçada e Sampaio", subject: "Física", level: 2, exams: ALL, why: "Teoria bem explicada com exercícios de vestibulares." },
  { title: "Os Fundamentos da Física", author: "Ramalho, Nicolau e Toledo", subject: "Física", level: 1, exams: ["EFOMM", "EsPCEx"], why: "Ótimo para construir a base." },
  { title: "Curso de Física Básica", author: "H. Moysés Nussenzveig", subject: "Física", level: 3, exams: MIL, why: "Aprofundamento com cálculo para ITA/IME." },
  { title: "Problems in General Physics", author: "I. E. Irodov", subject: "Física", level: 3, exams: MIL, why: "Clássico de problemas difíceis." },
  { title: "Problemas Selecionados de Física Elementar", author: "Saraeva et al.", subject: "Física", level: 3, exams: MIL, why: "Problemas conceituais no nível do IME." },
  // Química
  { title: "Química (volumes 1 a 3)", author: "Ricardo Feltre", subject: "Química", level: 2, exams: ALL, why: "Cobertura completa do médio." },
  { title: "Química Geral", author: "John B. Russell", subject: "Química", level: 3, exams: MIL, why: "Aprofunda físico-química e química geral." },
  { title: "Química: a Ciência Central", author: "Brown, LeMay e Bursten", subject: "Química", level: 3, exams: MIL, why: "Referência universitária muito usada no ITA/IME." },
  { title: "Química Orgânica", author: "Solomons e Fryhle", subject: "Química", level: 3, exams: MIL, why: "Orgânica no nível cobrado pelo IME." },
  { title: "Química", author: "Martha Reis", subject: "Química", level: 1, exams: ["EsPCEx"], why: "Linguagem acessível para a EsPCEx." },
  // Português
  { title: "Moderna Gramática Portuguesa", author: "Evanildo Bechara", subject: "Português", level: 3, exams: ALL, why: "Gramática de referência." },
  { title: "Novíssima Gramática da Língua Portuguesa", author: "Domingos Paschoal Cegalla", subject: "Português", level: 2, exams: ALL, why: "Objetiva, ótima para consulta." },
  { title: "Gramática Reflexiva", author: "Cereja e Cochar", subject: "Português", level: 1, exams: ["EFOMM", "EsPCEx"], why: "Gramática com interpretação de texto." },
  // Inglês
  { title: "Essential Grammar in Use", author: "Raymond Murphy", subject: "Inglês", level: 1, exams: ALL, why: "Base gramatical com exercícios curtos." },
  { title: "English Grammar in Use", author: "Raymond Murphy", subject: "Inglês", level: 2, exams: ALL, why: "Nível intermediário, muito usado." },
  { title: "Advanced Grammar in Use", author: "Martin Hewings", subject: "Inglês", level: 3, exams: MIL, why: "Para textos e gramática avançados do ITA/IME." },
  // Redação
  { title: "Para Entender o Texto", author: "Platão e Fiorin", subject: "Redação", level: 2, exams: ["EFOMM", "EsPCEx"], why: "Leitura e produção de texto." },
  { title: "Comunicação em Prosa Moderna", author: "Othon M. Garcia", subject: "Redação", level: 3, exams: ["EFOMM", "EsPCEx"], why: "Clássico sobre argumentação e estilo." },
  // História
  { title: "História Geral e do Brasil", author: "Cláudio Vicentino e Gianpaolo Dorigo", subject: "História", level: 1, exams: ["EsPCEx"], why: "Cobre todo o edital de História." },
  { title: "História do Brasil", author: "Boris Fausto", subject: "História", level: 3, exams: ["EsPCEx"], why: "Aprofunda História do Brasil." },
  // Geografia
  { title: "Geografia Geral e do Brasil", author: "Eustáquio de Sene e João Carlos Moreira", subject: "Geografia", level: 1, exams: ["EsPCEx"], why: "Material completo para a EsPCEx." },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Sugestões variam com o concurso, as matérias cadastradas e a dificuldade:
 * matérias difíceis priorizam livros aprofundados; fáceis priorizam base.
 */
export function suggestBooks(exam: ExamId, subjects: Subject[], books: Book[], subjectFilter?: string) {
  const owned = new Set(books.map((b) => norm(b.title)));
  const active = subjects.filter((s) => !s.archived);
  const bySubject = new Map(active.map((s) => [norm(s.name), s]));
  return BOOK_CATALOG.filter((b) => b.exams.includes(exam))
    .filter((b) => !owned.has(norm(b.title)))
    .filter((b) => bySubject.has(norm(b.subject)))
    .filter((b) => !subjectFilter || norm(b.subject) === norm(subjectFilter))
    .map((b) => {
      const s = bySubject.get(norm(b.subject))!;
      const fit = 3 - Math.abs(s.difficulty - b.level);
      const examBoost = b.exams.length === 1 ? 1 : b.exams.length <= 2 ? 0.5 : 0;
      return { book: b, subject: s, score: fit + examBoost };
    })
    .sort((a, b) => b.score - a.score || a.book.subject.localeCompare(b.book.subject));
}
