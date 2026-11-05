import { describe, expect, it } from "vitest";
import {
  activityForStep,
  daysToExam,
  describeSchedule,
  dueQueue,
  fmtInterval,
  forecast,
  gradeItem,
  isLeech,
  makeReviewItem,
  nextSchedule,
  normalizeSchedule,
  parseSchedule,
  previewIntervals,
  retention,
  reviewSettingsOf,
  reviewStreak,
  spreadOverdue,
  summarize,
  topicsWithoutReview,
  DEFAULT_REVIEW_SETTINGS,
} from "./review";
import { makeTopic } from "./topics";
import type { ReviewItem, ReviewSettings, Subject } from "./types";

const fixed: ReviewSettings = { ...DEFAULT_REVIEW_SETTINGS, schedule: [1, 7, 30, 90], skipRestDays: false, dailyCap: 0 };
const adaptive: ReviewSettings = { ...fixed, method: "adaptativo" };

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: "r1",
  subjectId: "s1",
  title: "Cinemática",
  studiedOn: "2026-11-01",
  due: "2026-11-02",
  step: 0,
  interval: 1,
  ease: 2.5,
  lapses: 0,
  status: "ativa",
  history: [],
  note: "",
  source: "manual",
  createdAt: 0,
  ...over,
});

describe("configurações", () => {
  it("usa o padrão quando o perfil não tem preferências e limpa calendários inválidos", () => {
    expect(reviewSettingsOf(null)).toEqual(DEFAULT_REVIEW_SETTINGS);
    expect(reviewSettingsOf({ review: { schedule: [30, 7, 7, 0, -2, 1.4] } }).schedule).toEqual([1, 7, 30]);
    expect(reviewSettingsOf({ review: { schedule: [] } }).schedule).toEqual(DEFAULT_REVIEW_SETTINGS.schedule);
  });
  it("lê calendários escritos pelo aluno", () => {
    expect(parseSchedule("1, 7 e 30 dias")).toEqual([1, 7, 30]);
    expect(normalizeSchedule([7, 1, 7])).toEqual([1, 7]);
    expect(describeSchedule([1, 7, 30])).toBe("amanhã, em 7 dias e em 30 dias");
  });
});

describe("método fixo (24h · 7 · 30 · 90)", () => {
  it("segue o calendário quando o aluno lembra", () => {
    const r1 = nextSchedule(item(), 2, fixed);
    expect(r1).toMatchObject({ step: 1, interval: 7, status: "ativa" });
    const r2 = nextSchedule({ ...item(), step: 1, interval: 7 }, 2, fixed);
    expect(r2.interval).toBe(30);
    const r3 = nextSchedule({ ...item(), step: 2, interval: 30 }, 2, fixed);
    expect(r3.interval).toBe(90);
  });
  it("depois do calendário entra em manutenção e acaba dominado", () => {
    const r4 = nextSchedule({ ...item(), step: 3, interval: 90 }, 2, fixed);
    expect(r4).toMatchObject({ step: 4, interval: 180, status: "ativa" });
    const r5 = nextSchedule({ ...item(), step: 4, interval: 180 }, 2, fixed);
    expect(r5.status).toBe("dominada");
  });
  it("esqueci volta ao começo e conta um lapso; difícil repete a etapa em menos tempo; fácil pula uma", () => {
    const base = { ...item(), step: 2, interval: 30 };
    expect(nextSchedule(base, 0, fixed)).toMatchObject({ step: 0, interval: 1, lapses: 1 });
    expect(nextSchedule(base, 1, fixed)).toMatchObject({ step: 2, interval: 18 });
    expect(nextSchedule(base, 3, fixed)).toMatchObject({ step: 4, interval: 180 });
  });
  it("dá crédito a quem lembrou mesmo bem atrasado", () => {
    const base = { ...item(), step: 1, interval: 7 };
    expect(nextSchedule(base, 2, fixed, { lateDays: 2 }).interval).toBe(30);
    expect(nextSchedule(base, 2, fixed, { lateDays: 5 }).interval).toBe(90);
  });
  it("perto da prova limita o intervalo a 20% do tempo restante e nunca passa da véspera", () => {
    const base = { ...item(), step: 2, interval: 30 };
    expect(nextSchedule(base, 2, fixed, { daysToExam: 40 }).interval).toBe(8);
    expect(nextSchedule(base, 2, fixed, { daysToExam: 4 }).interval).toBe(1);
    expect(daysToExam("2026-12-01", "2026-11-01")).toBe(30);
    expect(daysToExam("2026-10-01", "2026-11-01")).toBeUndefined();
    expect(daysToExam(undefined, "2026-11-01")).toBeUndefined();
  });
});

describe("método adaptativo (SM-2)", () => {
  it("reproduz a sequência 1 → 6 → 15 → 38 do SM-2 com facilidade 2,5", () => {
    let it1 = nextSchedule(item(), 2, adaptive);
    expect(it1).toMatchObject({ step: 1, interval: 6, ease: 2.5 });
    it1 = nextSchedule({ ...item(), ...it1 }, 2, adaptive);
    expect(it1.interval).toBe(15);
    it1 = nextSchedule({ ...item(), ...it1 }, 2, adaptive);
    expect(it1.interval).toBe(38);
  });
  it("muda a facilidade conforme a nota e nunca abaixo de 1,3", () => {
    expect(nextSchedule(item(), 3, adaptive).ease).toBeCloseTo(2.6);
    expect(nextSchedule(item(), 1, adaptive).ease).toBeCloseTo(2.36);
    expect(nextSchedule(item({ ease: 1.3 }), 0, adaptive).ease).toBe(1.3);
    expect(nextSchedule(item({ step: 3, interval: 20 }), 0, adaptive)).toMatchObject({ step: 0, interval: 1, lapses: 1 });
  });
  it("difícil ×1,2; fácil com bônus de 1,3 e crédito total pelo atraso", () => {
    const base = item({ step: 2, interval: 10 });
    expect(nextSchedule(base, 1, adaptive).interval).toBe(12);
    expect(nextSchedule(base, 3, adaptive, { lateDays: 5 }).interval).toBe(Math.round(15 * 2.6 * 1.3));
  });
});

describe("itens, fila e datas", () => {
  it("cria o item com a primeira revisão para o dia seguinte e desvia de dias de descanso", () => {
    const base = makeReviewItem({ id: "a", subjectId: "s", title: " MRU ", studiedOn: "2026-11-07", source: "topico" }, { ...fixed, skipRestDays: true }, [0], {});
    // 07/11/2026 é sábado; a revisão de 24h cairia no domingo (descanso) e vai para segunda
    expect(base.title).toBe("MRU");
    expect(base.due).toBe("2026-11-09");
    const noSkip = makeReviewItem({ id: "a", subjectId: "s", title: "MRU", studiedOn: "2026-11-07", source: "topico" }, fixed, [0], {});
    expect(noSkip.due).toBe("2026-11-08");
  });
  it("aplica a nota, remarca e guarda o histórico", () => {
    const g = gradeItem(item(), 2, "2026-11-02", fixed);
    expect(g.due).toBe("2026-11-09");
    expect(g.history).toHaveLength(1);
    expect(g.history[0]).toMatchObject({ date: "2026-11-02", grade: 2, interval: 7 });
  });
  it("ordena a fila pela retenção estimada e respeita o limite diário", () => {
    const items = [
      item({ id: "fresh", due: "2026-11-10", interval: 7, history: [{ date: "2026-11-03", grade: 2, interval: 7, createdAt: 0 }] }),
      item({ id: "late", due: "2026-11-05", interval: 1, history: [{ date: "2026-11-04", grade: 2, interval: 1, createdAt: 0 }] }),
      item({ id: "future", due: "2026-11-20" }),
      item({ id: "paused", due: "2026-11-01", status: "pausada" }),
    ];
    const q = dueQueue(items, "2026-11-10", fixed);
    expect(q.queue.map((i) => i.id)).toEqual(["late", "fresh"]);
    expect(q.overdue).toBe(1);
    const capped = dueQueue(items, "2026-11-10", { ...fixed, dailyCap: 1 });
    expect(capped.queue.map((i) => i.id)).toEqual(["late"]);
    expect(capped.deferred).toBe(1);
  });
  it("estima a memória: 90% no dia marcado, menos depois", () => {
    const onTime = item({ interval: 7, history: [{ date: "2026-11-01", grade: 2, interval: 7, createdAt: 0 }] });
    expect(retention(onTime, "2026-11-08")).toBeCloseTo(0.9, 2);
    expect(retention(onTime, "2026-11-01")).toBe(1);
    expect(retention(onTime, "2026-11-22")).toBeLessThan(0.8);
  });
  it("resume, prevê e espalha atrasadas", () => {
    const items = [
      item({ id: "a", due: "2026-11-08" }),
      item({ id: "b", due: "2026-11-09" }),
      item({ id: "c", due: "2026-11-10", history: [{ date: "2026-11-10", grade: 2, interval: 7, createdAt: 0 }] }),
      item({ id: "d", due: "2026-11-12" }),
      item({ id: "e", due: "2026-11-20", status: "dominada" }),
    ];
    const s = summarize(items, "2026-11-10");
    expect(s).toMatchObject({ dueToday: 3, overdue: 2, doneToday: 1, next7: 1, active: 4, mastered: 1 });
    const fc = forecast(items, "2026-11-10", 3);
    expect(fc.map((d) => d.count)).toEqual([3, 0, 1]);
    const spread = spreadOverdue(items, "2026-11-10", 5, 1);
    expect(spread.find((i) => i.id === "a")?.due).toBe("2026-11-10");
    expect(spread.find((i) => i.id === "b")?.due).toBe("2026-11-11");
    expect(reviewStreak(items, "2026-11-10")).toBe(1);
    expect(reviewStreak(items, "2026-11-11")).toBe(1);
    expect(reviewStreak(items, "2026-11-12")).toBe(0);
  });
  it("mostra o intervalo de cada botão e formata", () => {
    expect(previewIntervals(item(), fixed, "2026-11-02")).toEqual({ 0: 1, 1: 1, 2: 7, 3: 30 });
    expect(fmtInterval(1)).toBe("amanhã");
    expect(fmtInterval(7)).toBe("7 dias");
    expect(fmtInterval(30)).toBe("4 sem");
    expect(fmtInterval(90)).toBe("3 meses");
  });
  it("identifica casos-problema e sugere a atividade da etapa", () => {
    expect(isLeech(item({ lapses: 8 }))).toBe(true);
    expect(isLeech(item({ lapses: 2 }))).toBe(false);
    expect(activityForStep(0).title).toBe("Revisão de 24h");
    expect(activityForStep(5).title).toBe("Manutenção");
  });
  it("lista só os tópicos (folhas) sem revisão ativa", () => {
    const parent = makeTopic("Mecânica", ["MRU", "MRUV"]);
    const subject: Subject = { id: "s1", name: "Física", difficulty: 3, multiplier: 3, color: "", notes: "", archived: false, topics: [parent, makeTopic("Óptica")] };
    const covered = item({ topicId: parent.children[0]!.id });
    const mastered = item({ id: "m", topicId: parent.children[1]!.id, status: "dominada" });
    expect(topicsWithoutReview(subject, [covered, mastered]).map((t) => t.title)).toEqual(["MRUV", "Óptica"]);
  });
});
