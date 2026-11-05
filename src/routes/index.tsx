import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, ArrowRight, Brain, CheckCircle2, Play, Target, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bar, Dot, Panel, Stamp, Stat, Tag } from "@/components/kit";
import { MonthCalendar } from "@/components/MonthCalendar";
import { ReviewScheduleDialog } from "@/components/ReviewScheduleDialog";
import { useNow } from "@/hooks/use-now";
import { useActiveCycle, useApp, useDueReviews, useRestWeekdays, useSubjectMap } from "@/lib/store";
import { activityForStep, fmtRelativeDue, retention, summarize } from "@/lib/review";
import {
  countWorkdays,
  cycleReport,
  cyclesInMonth,
  fmtDec,
  fmtHours,
  fmtMin,
  grossMinutesOn,
  monthDays,
  monthGoalReport,
  sessionsBetween,
  sumMinutes,
  weekRange,
  ymd,
} from "@/lib/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Quartel de Estudos" },
      { name: "description", content: "Seu painel diário: horas líquidas, revisões do dia, metas, ciclo ativo e calendário de estudos." },
      { property: "og:title", content: "Painel — Quartel de Estudos" },
      { property: "og:description", content: "Horas líquidas, revisões do dia, metas, ciclo ativo e calendário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const now = useNow(1000);
  const navigate = useNavigate();
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const subjects = useApp((s) => s.subjects);
  const commitments = useApp((s) => s.commitments);
  const meta = useApp((s) => s.dayMeta);
  const timer = useApp((s) => s.timer);
  const timerStart = useApp((s) => s.timerStart);
  const reviews = useApp((s) => s.reviews);
  const cycle = useActiveCycle();
  const rest = useRestWeekdays();

  const today = ymd(now);
  const dayKey = today; // recalcula apenas quando o dia muda
  const due = useDueReviews(dayKey);
  const data = useMemo(() => {
    const d = parseISO(dayKey);
    const wk = weekRange(d);
    const days = monthDays(d);
    const todayMin = sumMinutes(sessions.filter((s) => s.date === dayKey));
    const weekMin = sumMinutes(sessionsBetween(sessions, wk.from, wk.to));
    const month = monthGoalReport(d, profile.monthlyGoal, sessions, rest, meta, dayKey);
    const { work, rest: restCount } = countWorkdays(days, rest, meta);
    const cr = cycle ? cycleReport(cycle, subjects, sessions, meta, dayKey) : null;
    const cMonth = cycle && cr ? cyclesInMonth(work, cycle.dailyHours, cr.target) : 0;
    const rev = summarize(reviews, dayKey);
    return { todayMin, weekMin, month, work, restCount, cr, cMonth, gross: grossMinutesOn(commitments, dayKey), rev };
  }, [dayKey, sessions, subjects, commitments, meta, rest, cycle, profile.monthlyGoal, reviews]);

  const weekPct = profile.weeklyGoal > 0 ? (data.weekMin / 60 / profile.weeklyGoal) * 100 : 0;
  const dayPct = profile.dailyHours > 0 ? (data.todayMin / 60 / profile.dailyHours) * 100 : 0;
  const examDays = profile.examDate ? differenceInCalendarDays(parseISO(profile.examDate), now) : null;
  const firstName = profile.name.split(" ")[0] ?? profile.name;
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  const quickStart = () => {
    if (timer.status === "parado") timerStart();
    navigate({ to: "/cronometro" });
  };

  const reviewsDone = due.queue.length === 0 && data.rev.doneToday > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Ordem do dia */}
      <section className="bg-field relative overflow-hidden rounded-2xl text-primary-foreground shadow-lift animate-rise">
        <div className="grid-paper-strong pointer-events-none absolute inset-0 opacity-40" />
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brass/20 blur-3xl" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
          <div>
            <p className="eyebrow text-brass">{greeting}, {firstName}</p>
            <p className="numeral mt-2 text-7xl md:text-8xl" aria-live="polite">
              {format(now, "HH:mm")}
              <span className="text-3xl opacity-50 md:text-4xl">:{format(now, "ss")}</span>
            </p>
            <p className="mt-3 font-display text-xl uppercase tracking-wide md:text-2xl">
              {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="brass" size="lg" className="press h-12 px-6" onClick={quickStart}>
                {timer.status === "parado" ? <><Play /> Iniciar estudo</> : <><Timer /> Ver cronômetro</>}
              </Button>
              <Button asChild variant="outline" size="lg" className="press h-12 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
                <Link to="/revisoes"><Brain /> {due.queue.length > 0 ? `Revisar ${due.queue.length}` : "Revisões"}</Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 md:items-end md:text-right">
            {examDays !== null && examDays >= 0 ? (
              <div className="md:pt-1">
                <Stamp className="text-brass">{profile.exam}</Stamp>
                <p className="numeral mt-3 text-6xl md:text-7xl">{examDays}</p>
                <p className="eyebrow text-primary-foreground/70">{examDays === 1 ? "dia para a prova" : "dias para a prova"}</p>
              </div>
            ) : (
              <div className="md:pt-1">
                <Stamp className="text-brass">{profile.exam}</Stamp>
                <p className="mt-3 text-sm text-primary-foreground/70">Informe a data da prova em Configurações para ver a contagem regressiva.</p>
              </div>
            )}
            <ul className="grid w-full gap-1.5 text-sm md:max-w-xs">
              <OrderRow ok={dayPct >= 100} label="Meta do dia" value={`${fmtMin(data.todayMin)} / ${fmtHours(profile.dailyHours)}`} />
              <OrderRow ok={reviewsDone} label="Revisões" value={due.queue.length ? `${due.queue.length} na fila` : data.rev.doneToday ? `${data.rev.doneToday} feitas` : "nada hoje"} alert={due.overdue > 0} />
              <OrderRow ok={!!data.cr && data.cr.pending.length === 0} label="Ciclo" value={data.cr ? `${data.cr.pending.length} matérias pendentes` : "sem ciclo"} />
            </ul>
          </div>
        </div>
      </section>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Líquidas hoje" value={fmtMin(data.todayMin)} hint={`Meta diária ${fmtHours(profile.dailyHours)}`} icon={<Timer />} tone={dayPct >= 100 ? "success" : "default"} />
        <Stat label="Brutas hoje" value={fmtMin(data.gross)} hint="Compromissos — não somam ao estudo" />
        <Stat label="Líquidas na semana" value={fmtMin(data.weekMin)} hint={`${Math.round(weekPct)}% da meta semanal`} />
        <Stat label="Líquidas no mês" value={fmtHours(data.month.studied)} hint={`${Math.round(data.month.pct)}% da meta mensal`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <Panel
            title={<span className="flex items-center gap-2"><Brain className="size-5 text-status-review" /> Revisões de hoje</span>}
            description={due.overdue > 0 ? `${due.overdue} ${due.overdue === 1 ? "atrasada" : "atrasadas"} · ${data.rev.next7} nos próximos 7 dias` : `${data.rev.next7} nos próximos 7 dias · ${data.rev.active} assuntos ativos`}
            action={<Link to="/revisoes" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">Abrir fila <ArrowRight className="size-3.5" /></Link>}
          >
            <TodayReviews queue={due.queue} today={dayKey} doneToday={data.rev.doneToday} />
          </Panel>

          <Panel title="Calendário">
            <MonthCalendar today={now} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={<span className="flex items-center gap-2"><Target className="size-5 text-brass" /> Metas</span>}>
            <div className="space-y-5">
              <GoalRow label="Semanal" studied={data.weekMin / 60} goal={profile.weeklyGoal} pct={weekPct} />
              <GoalRow label="Mensal" studied={data.month.studied} goal={profile.monthlyGoal} pct={data.month.pct} />
              {profile.monthlyGoal > 0 && data.month.remaining > 0 && (
                <div className={`flex gap-2 rounded-lg p-3 text-sm ${data.month.onTrack ? "bg-success/10" : "bg-warning/15"}`}>
                  {!data.month.onTrack && <AlertTriangle className="size-4 shrink-0 text-warning" />}
                  <p>
                    {data.month.onTrack ? "No ritmo atual você atinge a meta do mês. " : "O ritmo atual não é suficiente para a meta do mês. "}
                    Estude <b className="tabular">{fmtHours(data.month.neededPerWorkday)}</b> por dia útil nos{" "}
                    <b className="tabular">{data.month.remainingWorkdays}</b> dias úteis restantes.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Mês com <b>{data.work}</b> dias úteis e <b>{data.restCount}</b> de descanso.
              </p>
            </div>
          </Panel>

          <Panel title="Ciclo ativo" action={<Link to="/ciclos" className="text-sm text-primary underline-offset-4 hover:underline">Gerenciar</Link>}>
            {!cycle || !data.cr ? (
              <p className="text-sm text-muted-foreground">Nenhum ciclo ativo. <Link to="/ciclos" className="text-primary underline">Criar ciclo</Link></p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-display text-2xl font-bold uppercase">{cycle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtHours(data.cr.studied)} de {fmtHours(data.cr.target)}
                    </p>
                  </div>
                  <p className="numeral text-4xl">{Math.round(data.cr.pct)}%</p>
                </div>
                <Bar value={data.cr.pct} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Faltam" value={fmtHours(data.cr.remaining)} />
                  <Info label="Previsão de término" value={data.cr.remaining > 0 ? format(parseISO(data.cr.projectedEnd), "dd/MM") : "Concluído"} />
                  <Info label="Matérias pendentes" value={String(data.cr.pending.length)} />
                  <Info label="Ciclos no mês" value={fmtDec(data.cMonth, 0)} />
                </div>
                {data.cr.pending.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {data.cr.pending.map((r) => (
                      <span key={r.subject.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
                        <Dot color={r.subject.color} /> {r.subject.name} · {fmtHours(r.remaining)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function OrderRow({ ok, label, value, alert }: { ok: boolean; label: string; value: string; alert?: boolean }) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-primary-foreground/10 px-3 py-1.5 md:flex-row-reverse">
      {ok ? <CheckCircle2 className="size-4 shrink-0 text-brass" /> : <i className={cn("size-4 shrink-0 rounded-full border-2", alert ? "border-warning" : "border-primary-foreground/40")} aria-hidden />}
      <span className="flex-1 text-left font-medium md:text-right">{label}</span>
      <span className="tabular text-xs text-primary-foreground/80">{value}</span>
    </li>
  );
}

function TodayReviews({ queue, today, doneToday }: { queue: ReturnType<typeof useDueReviews>["queue"]; today: string; doneToday: number }) {
  const subj = useSubjectMap();
  if (queue.length === 0) {
    return (
      <div className="grid-paper flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4 text-sm">
        <p className="text-muted-foreground">
          {doneToday > 0 ? <><b className="text-foreground">Fila zerada.</b> Você revisou {doneToday} {doneToday === 1 ? "assunto" : "assuntos"} hoje.</> : <>Nenhuma revisão marcada para hoje. Estudou algo novo? Agende a revisão de 24h.</>}
        </p>
        <ReviewScheduleDialog>
          <Button size="sm" variant="outline">Agendar revisão</Button>
        </ReviewScheduleDialog>
      </div>
    );
  }
  const shown = queue.slice(0, 4);
  return (
    <div>
      <ul className="divide-y rounded-xl border">
        {shown.map((r) => {
          const s = subj[r.subjectId];
          const mem = Math.round(retention(r, today) * 100);
          return (
            <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
              <Dot color={s?.color ?? "gray"} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {s?.name ?? "Matéria removida"} · R{r.step + 1} {activityForStep(r.step).title.toLowerCase()}
                  {r.due < today && <span className="text-destructive"> · {fmtRelativeDue(r, today)}</span>}
                </p>
              </div>
              <Tag tone={mem < 70 ? "alert" : mem < 85 ? "warning" : "success"} title="Memória estimada">{mem}%</Tag>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{queue.length > shown.length ? `+${queue.length - shown.length} na fila` : `${queue.length} ${queue.length === 1 ? "assunto" : "assuntos"} · ~${queue.reduce((a, r) => a + activityForStep(r.step).minutes, 0)} min`}</p>
        <Button asChild size="sm">
          <Link to="/revisoes"><Brain /> Revisar agora</Link>
        </Button>
      </div>
    </div>
  );
}

function GoalRow({ label, studied, goal, pct }: { label: string; studied: number; goal: number; pct: number }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted-foreground">
          {fmtHours(studied)} / {fmtHours(goal)} · <b className="text-foreground">{Math.round(Math.min(pct, 999))}%</b>
        </span>
      </div>
      <Bar value={pct} color={pct >= 100 ? "var(--status-goal)" : undefined} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 p-2.5">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="tabular font-semibold">{value}</p>
    </div>
  );
}
