import { describe, expect, it } from "vitest";
import {
  addWorkdays,
  commitmentMinutes,
  countWorkdays,
  cycleReport,
  cyclesInMonth,
  distributeHours,
  grossMinutesOn,
  isRestDay,
  monthDays,
  monthGoalReport,
  splitEvenly,
} from "./calc";
import type { Commitment, Cycle, StudySession, Subject } from "./types";

const subj = (id: string, multiplier: number, archived = false): Subject => ({
  id, name: id, difficulty: 1, multiplier, color: "x", notes: "", archived,
});

describe("distribuição de horas por peso", () => {
  it("20h semanais com pesos 1, 2 e 3 dão 3,33h / 6,67h / 10h", () => {
    const r = distributeHours(20, [subj("pt", 1), subj("mat", 2), subj("fis", 3)]);
    expect(r["pt"]).toBeCloseTo(3.333, 2);
    expect(r["mat"]).toBeCloseTo(6.667, 2);
    expect(r["fis"]).toBeCloseTo(10, 5);
  });
});

describe("dias de descanso", () => {
  it("domingo é descanso quando 0 está nos dias de descanso", () => {
    expect(isRestDay("2026-11-01", [0], {})).toBe(true); // domingo
    expect(isRestDay("2026-11-02", [0], {})).toBe(false);
  });
  it("marcação manual do dia tem prioridade", () => {
    expect(isRestDay("2026-11-02", [0], { "2026-11-02": { rest: true } })).toBe(true);
    expect(isRestDay("2026-11-01", [0], { "2026-11-01": { rest: false } })).toBe(false);
  });
  it("novembro/2026 com domingos de descanso tem 25 dias úteis e 5 de descanso", () => {
    const { work, rest } = countWorkdays(monthDays(new Date(2026, 10, 1)), [0], {});
    expect(work).toBe(25);
    expect(rest).toBe(5);
  });
});

describe("ciclos no mês", () => {
  it("25 dias úteis × 4h ÷ ciclo de 20h = 5 ciclos completos", () => {
    expect(cyclesInMonth(25, 4, 20)).toBe(5);
  });
  it("arredonda para baixo: 24 dias × 3h ÷ 20h = 3", () => {
    expect(cyclesInMonth(24, 3, 20)).toBe(3);
  });
});

describe("relatório do ciclo", () => {
  const cycle: Cycle = {
    id: "c", name: "A", subjectIds: ["pt", "mat", "fis", "arq"], dailyHours: 4, weeklyHours: 20,
    durationDays: 7, restWeekdays: [0], goalHours: 20, startDate: "2026-11-02", status: "ativo",
  };
  const subjects = [subj("pt", 1), subj("mat", 2), subj("fis", 3), subj("arq", 5, true)];
  const s = (subjectId: string, minutes: number, date = "2026-11-02"): StudySession => ({
    id: subjectId + minutes, date, subjectId, minutes, kind: "estudo", note: "", source: "manual", createdAt: 0,
  });

  it("ignora matérias arquivadas no peso", () => {
    const r = cycleReport(cycle, subjects, [], {}, "2026-11-02");
    expect(r.rows).toHaveLength(3);
    expect(r.rows.find((x) => x.subject.id === "fis")?.target).toBeCloseTo(10, 5);
  });

  it("16h restantes a 4h/dia = 4 dias úteis, pulando o domingo", () => {
    // estuda as 3,33h de português e 0,67h de matemática => restam 16h
    const r = cycleReport(cycle, subjects, [s("pt", 200), s("mat", 40)], {}, "2026-11-06"); // sexta
    expect(r.remaining).toBeCloseTo(16, 1);
    expect(r.workdaysNeeded).toBe(4);
    // sex 06, sáb 07, (dom 08 descanso), seg 09, ter 10
    expect(r.projectedEnd).toBe("2026-11-10");
    expect(r.restartDate).toBe("2026-11-11");
  });
});

describe("addWorkdays", () => {
  it("começando num domingo de descanso conta a partir de segunda", () => {
    expect(addWorkdays("2026-11-01", 1, [0], {})).toBe("2026-11-02");
  });
});

describe("meta mensal", () => {
  it("horas necessárias por dia útil = restante ÷ dias úteis restantes", () => {
    const sessions: StudySession[] = [
      { id: "1", date: "2026-11-02", subjectId: "a", minutes: 600, kind: "estudo", note: "", source: "manual", createdAt: 0 },
    ];
    const r = monthGoalReport(new Date(2026, 10, 1), 80, sessions, [0], {}, "2026-11-30");
    expect(r.studied).toBe(10);
    expect(r.remaining).toBe(70);
    expect(r.remainingWorkdays).toBe(1); // segunda 30/11
    expect(r.neededPerWorkday).toBe(70);
    expect(r.onTrack).toBe(false);
  });
});

describe("horas brutas", () => {
  const c: Commitment = { id: "t", name: "Trabalho", date: "2026-11-02", start: "08:00", end: "12:30", repeat: "semanal", note: "", color: "x" };
  it("compromisso de 08:00 às 12:30 vale 270 minutos", () => {
    expect(commitmentMinutes(c)).toBe(270);
  });
  it("repetição semanal aparece só no mesmo dia da semana", () => {
    expect(grossMinutesOn([c], "2026-11-09")).toBe(270);
    expect(grossMinutesOn([c], "2026-11-10")).toBe(0);
    expect(grossMinutesOn([c], "2026-10-26")).toBe(0); // antes do início
  });
});

describe("divisão do cronômetro", () => {
  it("100 minutos em 3 matérias somam exatamente 100", () => {
    const parts = splitEvenly(100, 3);
    expect(parts).toEqual([34, 33, 33]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
  });
});
