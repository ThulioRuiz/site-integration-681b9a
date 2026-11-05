import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addMonths, endOfWeek, format, parseISO, startOfMonth, startOfWeek, subMonths, eachWeekOfInterval, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download, TrendingDown, TrendingUp } from "lucide-react";
import { Bar as RBar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Stat } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { useApp, useRestWeekdays } from "@/lib/store";
import { monthStats } from "@/lib/stats";
import { fmtDec, fmtMin, ymd } from "@/lib/calc";

export const Route = createFileRoute("/estatisticas")({
  head: () => ({
    meta: [
      { title: "Estatísticas — Quartel de Estudos" },
      { name: "description", content: "Relatório mensal de horas líquidas, matérias, dias estudados e evolução." },
      { property: "og:title", content: "Estatísticas — Quartel de Estudos" },
      { property: "og:description", content: "Relatório mensal de horas líquidas e evolução." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const [ref, setRef] = useState(() => startOfMonth(new Date()));
  const [subjectId, setSubjectId] = useState("");
  const [week, setWeek] = useState("");
  const [cycleId, setCycleId] = useState("");
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const subjects = useApp((s) => s.subjects);
  const cycles = useApp((s) => s.cycles);
  const commitments = useApp((s) => s.commitments);
  const meta = useApp((s) => s.dayMeta);
  const rest = useRestWeekdays();

  const weeks = eachWeekOfInterval({ start: ref, end: endOfMonth(ref) }, { weekStartsOn: 1 });
  const cycle = cycles.find((c) => c.id === cycleId);
  const scopedSubjects = cycle ? subjects.filter((s) => cycle.subjectIds.includes(s.id)) : subjects;
  const scopedSessions = cycle ? sessions.filter((s) => s.subjectId && cycle.subjectIds.includes(s.subjectId)) : sessions;
  const wFrom = week ? ymd(startOfWeek(parseISO(week), { weekStartsOn: 1 })) : undefined;
  const wTo = week ? ymd(endOfWeek(parseISO(week), { weekStartsOn: 1 })) : undefined;

  const st = useMemo(
    () => monthStats(ref, scopedSessions, scopedSubjects, commitments, meta, rest, { subjectId: subjectId || undefined, from: wFrom, to: wTo }),
    [ref, scopedSessions, scopedSubjects, commitments, meta, rest, subjectId, wFrom, wTo],
  );
  const prev = useMemo(
    () => monthStats(subMonths(ref, 1), scopedSessions, scopedSubjects, commitments, meta, rest, { subjectId: subjectId || undefined }),
    [ref, scopedSessions, scopedSubjects, commitments, meta, rest, subjectId],
  );
  const goalPct = profile.monthlyGoal > 0 ? (st.netMinutes / 60 / profile.monthlyGoal) * 100 : 0;
  const diff = prev.netMinutes > 0 ? ((st.netMinutes - prev.netMinutes) / prev.netMinutes) * 100 : null;
  const chartBars = st.bySubject.filter((x) => x.minutes > 0).map((x) => ({ name: x.subject.name, horas: +(x.minutes / 60).toFixed(2), color: x.subject.color }));
  const chartLine = st.daily.map((d) => ({ dia: d.day, horas: +(d.minutes / 60).toFixed(2) }));

  const exportCsv = () => {
    const lines = [
      ["Relatório", format(ref, "MMMM yyyy", { locale: ptBR })],
      ["Concurso", profile.exam],
      ["Horas líquidas", fmtDec(st.netMinutes / 60)],
      ["Horas brutas", fmtDec(st.grossMinutes / 60)],
      ["Média por dia (h)", fmtDec(st.avgPerDay / 60)],
      ["Média por semana (h)", fmtDec(st.avgPerWeek / 60)],
      ["Dias estudados", st.studiedDays],
      ["Dias sem estudo", st.daysWithoutStudy],
      ["Dias de descanso", st.restDays],
      ["Meta cumprida (%)", Math.round(goalPct)],
      [],
      ["Matéria", "Horas"],
      ...st.bySubject.map((x) => [x.subject.name, fmtDec(x.minutes / 60)]),
      [],
      ["Data", "Horas"],
      ...st.daily.map((d) => [d.date, fmtDec(d.minutes / 60)]),
    ];
    const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${format(ref, "yyyy-MM")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={`Concurso ${profile.exam}`} title="Estatísticas">
        <Button variant="outline" onClick={exportCsv}><Download /> Exportar relatório</Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          <Button size="icon" variant="ghost" onClick={() => { setRef(subMonths(ref, 1)); setWeek(""); }} aria-label="Mês anterior"><ChevronLeft /></Button>
          <span className="w-40 text-center font-display text-lg font-semibold uppercase">{format(ref, "MMMM yyyy", { locale: ptBR })}</span>
          <Button size="icon" variant="ghost" onClick={() => { setRef(addMonths(ref, 1)); setWeek(""); }} aria-label="Próximo mês"><ChevronRight /></Button>
        </div>
        <NativeSelect className="w-auto" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Todas as matérias</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
        <NativeSelect className="w-auto" value={week} onChange={(e) => setWeek(e.target.value)}>
          <option value="">Mês inteiro</option>
          {weeks.map((w, i) => <option key={ymd(w)} value={ymd(w)}>Semana {i + 1} ({format(w, "dd/MM")})</option>)}
        </NativeSelect>
        <NativeSelect className="w-auto" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
          <option value="">Todos os ciclos</option>
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Horas líquidas" value={fmtMin(st.netMinutes)}
          hint={diff === null ? "Sem dados do mês anterior" : (
            <span className={`inline-flex items-center gap-1 ${diff >= 0 ? "text-success" : "text-destructive"}`}>
              {diff >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{diff >= 0 ? "+" : ""}{Math.round(diff)}% vs mês anterior
            </span>
          )} />
        <Stat label="Horas brutas" value={fmtMin(st.grossMinutes)} hint="Compromissos do mês" />
        <Stat label="Média por dia" value={fmtMin(st.avgPerDay)} hint={`Por semana: ${fmtMin(st.avgPerWeek)}`} />
        <Stat label="Meta mensal" value={`${Math.round(goalPct)}%`} hint={`de ${profile.monthlyGoal}h`} />
        <Stat label="Dias estudados" value={st.studiedDays} />
        <Stat label="Dias sem estudo" value={st.daysWithoutStudy} hint="Dias úteis sem registro" />
        <Stat label="Dias de descanso" value={st.restDays} />
        <Stat label="Mais / menos estudada" value={<span className="text-base">{st.most?.subject.name ?? "—"} / {st.least?.subject.name ?? "—"}</span>} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Horas por matéria">
          {chartBars.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados neste período.</p> : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <RBar dataKey="horas" radius={[6, 6, 0, 0]}>
                    {chartBars.map((b) => <Cell key={b.name} fill={b.color} />)}
                  </RBar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel title="Evolução diária">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartLine}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="horas" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
