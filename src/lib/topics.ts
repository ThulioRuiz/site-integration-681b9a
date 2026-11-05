import type { ExamId, Subject, Topic, TopicStatus } from "./types";

export const TOPIC_STATUS_LABEL = ["Não visto", "Estudando", "Estudado", "Revisado"] as const;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const makeTopic = (title: string, children: string[] = []): Topic => ({
  id: newId(),
  title,
  status: 0,
  skip: false,
  children: children.map((c) => makeTopic(c)),
});

/** Itens que contam no progresso: subtópicos quando existem, senão o próprio tópico. */
export function leafTopics(topics: Topic[] | undefined): Topic[] {
  const out: Topic[] = [];
  const walk = (list: Topic[], parentSkip: boolean) => {
    for (const t of list) {
      const skip = parentSkip || t.skip;
      if (t.children.length) walk(t.children, skip);
      else if (!skip) out.push(t);
    }
  };
  walk(topics ?? [], false);
  return out;
}

export function topicProgress(topics: Topic[] | undefined) {
  const leaves = leafTopics(topics);
  const done = leaves.filter((t) => t.status >= 2).length;
  return { done, total: leaves.length, pct: leaves.length ? (done / leaves.length) * 100 : 0 };
}

/** Estado agregado de um tópico com subtópicos (o menor estado entre os filhos ativos). */
export function aggregateStatus(t: Topic): TopicStatus {
  const active = t.children.filter((c) => !c.skip);
  if (!active.length) return t.status;
  return Math.min(...active.map(aggregateStatus)) as TopicStatus;
}

/** Aplica `fn` ao tópico com o id dado, em qualquer nível. */
export function mapTopic(topics: Topic[], id: string, fn: (t: Topic) => Topic | null): Topic[] {
  const out: Topic[] = [];
  for (const t of topics) {
    if (t.id === id) {
      const r = fn(t);
      if (r) out.push(r);
    } else {
      out.push({ ...t, children: mapTopic(t.children, id, fn) });
    }
  }
  return out;
}

export const nextStatus = (s: TopicStatus): TopicStatus => ((s + 1) % 4) as TopicStatus;

/** Separa linhas coladas: "Tópico" e, com recuo ou "-", subtópicos do tópico anterior. */
export function parseTopicLines(text: string): Topic[] {
  const out: Topic[] = [];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const isSub = /^(\s{2,}|\t|\s*[-–•*]\s)/.test(raw);
    const title = raw.replace(/^\s*[-–•*]?\s*/, "").trim();
    if (!title) continue;
    const last = out[out.length - 1];
    if (isSub && last) last.children.push(makeTopic(title));
    else out.push(makeTopic(title));
  }
  return out;
}

/** Programa da EFOMM (blocos e tópicos), herdado do planejador de ciclo. */
const EFOMM_PROGRAM: Record<string, { topics: [string, string[]][]; material: string }> = {
  Matemática: {
    material:
      "Universo Narrado e FME (volumes 1 a 11). Vetores: Winterle ou Boulos e Camargo. Cálculo: FME 8, Stewart ou Guidorizzi.",
    topics: [
      [
        "Matemática 1 — Funções, sequências, estatística e finanças",
        ["Conjuntos e Venn", "Lógica proposicional", "Funções afim, quadrática e modular", "Exponencial e logaritmo", "PA e PG", "Porcentagem e juros", "Estatística", "Análise combinatória e binômio", "Probabilidade"],
      ],
      [
        "Matemática 2 — Álgebra, polinômios e trigonometria",
        ["Matrizes e determinantes", "Sistemas lineares", "Números complexos", "Polinômios e equações algébricas", "Trigonometria: ciclo e funções", "Arcos compostos e transformações", "Equações e inequações trigonométricas", "Lei dos senos e dos cossenos"],
      ],
      ["Matemática 3 — Geometria e vetores", ["Geometria plana", "Geometria espacial", "Geometria analítica plana", "Cônicas", "Vetores (produto interno e vetorial)"]],
      ["Matemática 4 — Cálculo", ["Limites e continuidade", "Derivadas e aplicações", "Integrais e técnicas de integração"]],
    ],
  },
  Português: {
    material: "Curso de Português (aulas 00 a 13). Apoio: Cegalla ou Bechara e VOLP. Treino: provas anteriores.",
    topics: [
      ["Português 1 — Leitura e interpretação", ["Coesão e coerência", "Modos do discurso", "Discurso direto, indireto e indireto livre", "Significação: sinônimos, antônimos, parônimos", "Inferências e sentido global"]],
      ["Português 2 — Gramática", ["Ortografia e acentuação", "Formação de palavras", "Classes de palavras", "Flexão verbal", "Sintaxe e período composto", "Concordância, regência e crase", "Pontuação e colocação pronominal", "Figuras de linguagem"]],
    ],
  },
  Física: {
    material: "Tópicos de Física (volumes 1 a 3). Complemento: Halliday, Resnick e Walker.",
    topics: [
      ["Física 1 — Mecânica", ["Cinemática", "Leis de Newton e dinâmica", "Trabalho e energia", "Impulso e quantidade de movimento", "Gravitação", "Estática e hidrostática"]],
      ["Física 2 — Ondas e termologia", ["MHS", "Ondas em cordas", "Ondas sonoras e Doppler", "Termometria e dilatação", "Calorimetria e gases", "Termodinâmica"]],
      ["Física 3 — Eletromagnetismo", ["Eletrostática", "Capacitores", "Eletrodinâmica e Kirchhoff", "Magnetismo", "Indução de Faraday-Lenz"]],
    ],
  },
  Inglês: {
    material: "Curso de Inglês (aulas 00 a 10). Murphy. Vocabulário no Anki.",
    topics: [
      ["Leitura e interpretação", []],
      ["Gramática", ["Tempos verbais", "Modais e voz passiva", "Condicionais", "Conectivos e relative clauses"]],
      ["Vocabulário", ["Phrasal verbs e idioms", "Falsos cognatos", "Prefixos e sufixos"]],
    ],
  },
  Redação: {
    material: "Curso de Redação (R00 a R08). Treino em 20 a 30 linhas.",
    topics: [
      ["Estrutura dissertativo-argumentativa", ["Tema e tese", "Introdução", "Desenvolvimento", "Conclusão"]],
      ["Coesão e coerência", []],
      ["Temas navais e institucionais", []],
    ],
  },
};

/** Tópicos sugeridos para uma matéria de um concurso (por enquanto só a EFOMM tem o programa completo). */
export function suggestedTopics(exam: ExamId, subjectName: string): Pick<Subject, "topics" | "material"> {
  const prog = exam === "EFOMM" ? EFOMM_PROGRAM[subjectName] : undefined;
  if (!prog) return { topics: [], material: "" };
  return { topics: prog.topics.map(([t, c]) => makeTopic(t, c)), material: prog.material };
}
