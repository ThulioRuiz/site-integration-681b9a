import { describe, expect, it } from "vitest";
import {
  applyFilters,
  attachPending,
  dupKey,
  EMPTY_FILTERS,
  exportCSV,
  inErrorBook,
  parseCSV,
  parseImportText,
  parsePastedQuestion,
  pendingBySource,
  seedTaxonomy,
  shouldSuggestNextLevel,
  upgradeQuestionData,
  validateImport,
  visibleSubjects,
} from "./qbank";
import type { BankQuestion, QuestionAttempt } from "./types";

const attempt = (result: QuestionAttempt["result"], reviewLater = false): QuestionAttempt => ({
  id: Math.random().toString(36),
  date: "2026-11-01",
  result,
  note: "",
  reviewLater,
  createdAt: 1,
});

const q = (p: Partial<BankQuestion>): BankQuestion => ({
  id: Math.random().toString(36),
  exam: "EFOMM",
  subjectId: "s",
  topicId: "t",
  level: 1,
  source: "",
  statement: "x",
  options: [],
  answer: "",
  resolution: "",
  tags: [],
  createdAt: 0,
  attempts: [],
  ...p,
});

describe("taxonomia", () => {
  it("carrega as matérias e mostra só as do concurso", () => {
    const tax = seedTaxonomy();
    expect(tax.subjects.map((s) => s.name)).toContain("Geografia");
    expect(visibleSubjects(tax, "EFOMM").map((s) => s.name)).toEqual(["Matemática", "Física", "Português", "Inglês", "Redação"]);
    expect(visibleSubjects(tax, "EsPCEx")).toHaveLength(8);
    // concursos e "pular" dos tópicos começam vazios
    expect(tax.subjects.every((s) => s.topics.every((t) => t.exams.length === 0 && !t.skip))).toBe(true);
  });
});

describe("importação", () => {
  it("lê CSV com aspas, ponto e vírgula e quebra de linha", () => {
    expect(parseCSV('a;b\n"x; y";"linha 1\nlinha 2"\n')).toEqual([["a", "b"], ["x; y", "linha 1\nlinha 2"]]);
  });

  it("valida e gera relatório com motivos", () => {
    const tax = seedTaxonomy();
    const csv = [
      "concurso,materia,topico,nivel,fonte,enunciado,A,B,C,D,E,gabarito,resolucao",
      "EFOMM,Matemática,Trigonometria,2,Lista 1,Quanto vale sen 30°?,1/2,1,0,√2/2,√3/2,a,",
      "EFOMM,Matemática,Trigonometria,4,Lista 1,Outra,,,,,,,",
      "EFOMM,Matemática,Trigonometria,1,Lista 1,,,,,,,,",
      "EFOMM,Astronomia,Estrelas,1,Lista 1,O que é?,,,,,,,",
      "EFOMM,Matemática,Trigonometria,1,lista 1,quanto vale sen 30?,,,,,,,",
    ].join("\n");
    const { rows } = parseImportText(csv);
    const r = validateImport(rows, tax, [], { createMissing: false, defaultExam: "EFOMM" });
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0]!.answer).toBe("A");
    expect(r.questions[0]!.level).toBe(2);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      'Nível fora de 1 a 3 ("4")',
      "Enunciado vazio",
      "Matéria desconhecida: Astronomia",
      "Duplicada (mesma fonte e enunciado)",
    ]);
    const created = validateImport(rows, tax, [], { createMissing: true, defaultExam: "EFOMM" });
    expect(created.questions).toHaveLength(2);
    expect(created.taxonomy.subjects.some((s) => s.name === "Astronomia")).toBe(true);
  });

  it("aceita JSON com alternativas em lista e exporta no mesmo formato", () => {
    const tax = seedTaxonomy();
    const { rows } = parseImportText(JSON.stringify([{ materia: "Física", topico: "Cinemática", nivel: 1, enunciado: "v = ?", alternativas: ["1", "2"], gabarito: "B" }]));
    const r = validateImport(rows, tax, [], { createMissing: false, defaultExam: "ITA" });
    expect(r.questions[0]).toMatchObject({ exam: "ITA", options: ["1", "2"], answer: "B" });
    const csv = exportCSV(r.questions, r.taxonomy);
    const again = validateImport(parseImportText(csv).rows, r.taxonomy, r.questions, { createMissing: false, defaultExam: "ITA" });
    expect(again.rejected[0]?.reason).toMatch(/Duplicada/);
  });

  it("normaliza duplicatas", () => {
    expect(dupKey("EFOMM 2023, Q12", "Calcule  o VALOR!")).toBe(dupKey("efomm 2023 q12", "calcule o valor"));
  });
});

describe("colar questão", () => {
  it("separa enunciado e alternativas", () => {
    const r = parsePastedQuestion("Quanto é 2+2?\nA) 3\n(B) 4\nc. 5\nD - 6\nE) 7");
    expect(r).toEqual({ statement: "Quanto é 2+2?", options: ["3", "4", "5", "6", "7"] });
    expect(parsePastedQuestion("Explique a lei de Ohm.").options).toEqual([]);
  });
});

describe("situação e filtros", () => {
  it("caderno de erros e filtro de status", () => {
    const a = q({ attempts: [attempt("errada")] });
    const b = q({ attempts: [attempt("certa", true)] });
    const c = q({ attempts: [attempt("certa")] });
    const d = q({});
    expect([a, b, c, d].filter(inErrorBook)).toEqual([a, b]);
    expect(applyFilters([a, b, c, d], { ...EMPTY_FILTERS, status: "nao-feita" })).toEqual([d]);
    expect(applyFilters([a, b, c, d], { ...EMPTY_FILTERS, status: "revisar" })).toEqual([b]);
  });

  it("sugere o próximo nível quando a maioria está certa", () => {
    const l1 = [q({ attempts: [attempt("certa")] }), q({ attempts: [attempt("certa")] }), q({})];
    const l2 = [q({ level: 2 })];
    expect(shouldSuggestNextLevel([...l1, ...l2], "t", 1)).toBe(true);
    expect(shouldSuggestNextLevel(l1, "t", 1)).toBe(false); // não há nível 2
    expect(shouldSuggestNextLevel([l1[0]!, q({}), q({}), ...l2], "t", 1)).toBe(false);
  });
});

describe("migração", () => {
  it("converte respostas da antiga aba Praticar sem perder nada e sem duplicar", () => {
    const old = {
      version: 1,
      practice: { "ita-m1": { chosen: 0, correct: true, date: "2026-10-01" }, "espcex-p1": { chosen: 1, correct: false, date: "2026-10-02" } },
      questionLogs: [{ id: "l1" }],
    };
    const up = upgradeQuestionData(old);
    expect(up.version).toBe(2);
    expect(up.questionLogs).toEqual([{ id: "l1" }]);
    expect(up.questionBank).toHaveLength(2);
    const m1 = up.questionBank.find((x) => x.id === "legacy-ita-m1")!;
    expect(m1.attempts[0]).toMatchObject({ result: "certa", chosen: 0, date: "2026-10-01" });
    const topic = up.qTaxonomy!.subjects.find((s) => s.id === m1.subjectId)!.topics.find((t) => t.id === m1.topicId);
    expect(topic?.name).toBe("Números complexos");
    const twice = upgradeQuestionData({ ...up, practice: old.practice });
    expect(twice.questionBank).toHaveLength(2);
  });

  it("dados sem prática não ganham taxonomia antes da primeira abertura", () => {
    const up = upgradeQuestionData({ version: 1 });
    expect(up.questionBank).toEqual([]);
    expect(up.qTaxonomy).toBeNull();
  });
});

describe("CSV por matéria + pendências (formato das listas extraídas dos PDFs)", () => {
  const questoes = `\uFEFF"concurso","materia","topico","nivel","fonte","enunciado","A","B","C","D","E","gabarito"
"EFOMM","Matemática","Sequências (PA e PG)","3","Matematica_-_EFOMM.pdf, Q5, p.1","Observe as três progressões, ""com aspas"".","1","2","3","4","5",""
"EFOMM","Matemática","Geometria espacial","3","Matematica_-_EFOMM.pdf, Q4, p.1","Determine o volume.","","","","","",""
"EFOMM","Matemática","tópico a confirmar","2","Matematica_-_EFOMM.pdf, Q23, p.11","Lei de formação?","a","","c","d","e",""`;
  const pend = `"materia","questao","pagina","motivo","fonte"
"Matemática","23","11","alternativa(s) B sem texto (provável imagem)","Matematica_-_EFOMM.pdf, Q23, p.11"
"Matemática","23","11","tópico a confirmar (rótulo do PDF: Lei de formação)","Matematica_-_EFOMM.pdf, Q23, p.11"
"Matemática","412","163","duplicada; não incluída","Matematica_-_EFOMM.pdf, Q412, p.163"`;

  it("lê o CSV com BOM, aspas e gabarito vazio", () => {
    const parsed = parseImportText(questoes);
    expect(parsed.kind).toBe("questoes");
    const r = validateImport(parsed.rows, seedTaxonomy(), [], { createMissing: false, defaultExam: "EFOMM" });
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0]!.statement).toContain('"com aspas"');
    expect(r.questions[0]!.answer).toBe("");
    expect(r.questions[1]!.options).toEqual([]);
    expect(r.rejected[0]!.missing?.topic).toBe("tópico a confirmar");
    const all = validateImport(parsed.rows, seedTaxonomy(), [], { createMissing: true, defaultExam: "EFOMM" });
    expect(all.questions).toHaveLength(3);
    expect(all.questions[2]!.options).toEqual(["a", "", "c", "d", "e"]);
  });

  it("reconhece o arquivo de pendências e liga pela fonte", () => {
    const parsed = parseImportText(pend);
    expect(parsed.kind).toBe("pendencias");
    expect(parsed.error).toBeUndefined();
    const map = pendingBySource(parsed.rows);
    const qs = validateImport(parseImportText(questoes).rows, seedTaxonomy(), [], { createMissing: true, defaultExam: "EFOMM" }).questions;
    const r = attachPending(qs, map);
    expect(r.matched).toBe(1);
    expect(r.unmatched).toBe(1);
    const flagged = r.list.find((x) => x.source.includes("Q23"))!;
    expect(flagged.pending).toHaveLength(2);
    expect(applyFilters(r.list, { ...EMPTY_FILTERS, status: "pendencia" })).toHaveLength(1);
    // Aplicar de novo não duplica nem conta outra vez.
    const again = attachPending(r.list, map);
    expect(again.matched).toBe(0);
    expect(again.list.find((x) => x.source.includes("Q23"))!.pending).toHaveLength(2);
  });
});

describe("restoreDefaultSubjects", () => {
  it("traz de volta uma matéria apagada, com tópicos, na posição original", async () => {
    const { seedTaxonomy, missingDefaultSubjects, restoreDefaultSubjects } = await import("./qbank");
    const seed = seedTaxonomy();
    const without = { subjects: seed.subjects.filter((s) => s.name !== "Matemática") };
    expect(missingDefaultSubjects(without)).toEqual(["Matemática"]);
    const back = restoreDefaultSubjects(without, ["Matemática"]);
    expect(back.subjects[0]!.name).toBe("Matemática");
    expect(back.subjects[0]!.topics.length).toBe(seed.subjects[0]!.topics.length);
    expect(back.subjects.length).toBe(seed.subjects.length);
    expect(missingDefaultSubjects(back)).toEqual([]);
  });
});
