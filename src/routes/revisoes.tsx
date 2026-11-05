import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Brain,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  ListChecks,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bar, Dot, Empty, PageHeader, Panel, SectionLabel, Stat, Tag } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { ReviewScheduleDialog } from "@/components/ReviewScheduleDialog";
import { SessionDialog } from "@/components/SessionDialog";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { useNow } from "@/hooks/use-now";
import { useApp, useDueReviews, useReviewSettings, useSubjectMap } from "@/lib/store";
import {
  activityForStep,
  daysSinceStudy,
  describeSchedule,
  fmtInterval,
  fmtRelativeDue,
  forecast,
  GRADE_INFO,
  isLeech,
  leafTopicsStudiedWithoutReview,
  previewIntervals,
  retention,
  reviewStreak,
  STATUS_LABEL,
  summarize,
} from "@/lib/review";
import { inErrorBook, normalizeText } from "@/lib/qbank";
import { ymd } from "@/lib/calc";
import type { ReviewGrade, ReviewItem, ReviewStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revisoes")({
  head: () => ({
    meta: [
      { title: "Revisões — Quartel de Estudos" },
      { name: "description", content: "Revisão espaçada: fila do dia, calendário 24h/7/30 ou adaptativo, memória estimada e caderno de erros." },
      { property: "og:title", content: "Revisões — Quartel de Estudos" },
      { property: "og:description", content: "Revisão espaçada com fila diária e memória estimada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RevisoesPage,
});

const GRADE_STYLE: Record<ReviewGrade, string> = {
  0: "border-destructive/50 text-destructive hover:bg-destructive/10 data-[big=true]:bg-destructive/10",
  1: "border-warning/60 text-foreground hover:bg-warning/15",
  2: "border-success/60 text-success hover:bg-success/10",
  3: "border-status-review/60 text-foreground hover:bg-status-review/15",
};

function RevisoesPage() {
  const now = useNow(60000);
  const today = ymd(now);
  const reviews = useApp((s) => s.reviews);
  const profile = useApp((s) => s.profile)!;
  const subjects = useApp((s) => s.subjects);
  const settings = useReviewSettings();
  const { queue, deferred, overdue } = useDueReviews(today);
  const { spreadOverdue, scheduleReviews } = useApp.getState();
  const [showAll, setShowAll] = useState(false);

  const summary = useMemo(() => summarize(reviews, today), [reviews, today]);
  const streak = useMemo(() => reviewStreak(reviews, today), [reviews, today]);
  const fc = useMemo(() => forecast(reviews, today, 14), [reviews, today]);
  const uncovered = useMemo(() => leafTopicsStudiedWithoutReview(subjects, reviews), [subjects, reviews]);
  const examDays = profile.examDate ? differenceInCalendarDays(parseISO(profile.examDate), now) : null;

  const scheduleUncovered = () => {
    const created = scheduleReviews(
      uncovered.map((u) => ({ subjectId: u.subject.id, topicId: u.topic.id, title: u.topic.title, studiedOn: today, source: "topico" as const })),
      today,
    );
    toast.success(`${created.length} revisões agendadas a partir dos tópicos já estudados.`);
  };

  const doneToday = summary.doneToday;
  const planned = doneToday + queue.length;
  const progress = planned > 0 ? (doneToday / planned) * 100 : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow="Memória"
        title="Revisões"
        description="Revisar é tentar lembrar antes de reler. Cada assunto volta em intervalos crescentes: o conteúdo se fixa com menos tempo total de estudo."
      >
        <SessionDialog date={today} defaultKind="revisao">
          <Button variant="outline"><Clock /> Registrar tempo</Button>
        </SessionDialog>
        <ReviewScheduleDialog>
          <Button><CalendarPlus /> Agendar revisão</Button>
        </ReviewScheduleDialog>
      </PageHeader>

      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="Para hoje" value={queue.length} tone={queue.length ? "review" : "default"} icon={<Brain />} hint={deferred ? `+${deferred} aguardando (limite diário)` : "Inclui as atrasadas"} />
        <Stat label="Atrasadas" value={overdue} tone={overdue ? "alert" : "default"} icon={<AlertTriangle />} hint={overdue ? "Primeiro as mais perto de esquecer" : "Tudo em dia"} />
        <Stat label="Feitas hoje" value={doneToday} tone={doneToday ? "success" : "default"} icon={<CheckCircle2 />} hint={planned ? `${Math.round(progress)}% do plano do dia` : "Nada planejado"} />
        <Stat label="Próximos 7 dias" value={summary.next7} icon={<CalendarClock />} hint={`${summary.active} assuntos ativos · ${summary.mastered} dominados`} />
        <Stat label="Sequência" value={`${streak}d`} tone={streak >= 3 ? "brass" : "default"} icon={<Flame />} hint={streak ? "dias seguidos revisando" : "Revise hoje para começar"} className="col-span-2 md:col-span-1" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Panel
            title={`Fila de hoje · ${format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}`}
            description={
              settings.method === "fixo"
                ? `Calendário fixo: ${describeSchedule(settings.schedule)}.`
                : "Adaptativo (SM-2): os intervalos crescem conforme você lembra."
            }
            action={
              overdue > 1 && (
                <Button size="sm" variant="outline" onClick={() => { const n = spreadOverdue(5); toast.success(`${n} atrasadas distribuídas pelos próximos 5 dias.`); }}>
                  <Shuffle /> Distribuir atrasadas
                </Button>
              )
            }
          >
            {planned > 0 && (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{doneToday} de {planned} revisões feitas</span>
                  <span className="tabular">{Math.round(progress)}%</span>
                </div>
                <Bar value={progress} color="var(--status-review)" className={cn(progress > 0 && progress < 100 && "shimmer")} />
              </div>
            )}
            {queue.length === 0 ? (
              doneToday > 0 ? (
                <Empty title="Fila zerada" action={<ReviewScheduleDialog><Button variant="outline"><Plus /> Agendar mais</Button></ReviewScheduleDialog>}>
                  Você revisou {doneToday} {doneToday === 1 ? "assunto" : "assuntos"} hoje. Próxima revisão {fc.slice(1).find((d) => d.count > 0) ? `em ${format(parseISO(fc.slice(1).find((d) => d.count > 0)!.date), "EEEE, dd/MM", { locale: ptBR })}` : "ainda não marcada"}.
                </Empty>
              ) : (
                <Empty
                  title="Nenhuma revisão para hoje"
                  action={
                    <>
                      {uncovered.length > 0 && <Button onClick={scheduleUncovered}><ListChecks /> Agendar {uncovered.length} tópicos já estudados</Button>}
                      <ReviewScheduleDialog><Button variant={uncovered.length ? "outline" : "default"}><CalendarPlus /> Agendar revisão</Button></ReviewScheduleDialog>
                    </>
                  }
                >
                  Quando um tópico passa para "estudado" em Matérias, ou quando você finaliza o cronômetro, a primeira revisão é marcada para {settings.method === "fixo" ? describeSchedule(settings.schedule.slice(0, 1)) : "amanhã"}.
                </Empty>
              )
            ) : (
              <ul className="stagger space-y-3">
                {queue.map((item, i) => (
                  <ReviewCard key={item.id} item={item} today={today} examDate={profile.examDate} first={i === 0} />
                ))}
              </ul>
            )}
            {deferred > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Mais {deferred} vencidas ficaram fora da fila pelo limite diário de {settings.dailyCap}. Elas entram amanhã, ou agora se você aumentar o limite em Configurações.
              </p>
            )}
          </Panel>

          <Panel
            title="Todas as revisões"
            description={`${reviews.length} assuntos no total`}
            action={
              <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
                {showAll ? "Ocultar" : "Mostrar"} <ChevronDown className={cn("transition-transform", showAll && "rotate-180")} />
              </Button>
            }
          >
            {showAll ? <AllReviews today={today} /> : <p className="text-sm text-muted-foreground">Pausar, reiniciar ou remover assuntos; ver a próxima data de cada um.</p>}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Próximos 14 dias" description="Carga prevista por dia; as atrasadas entram em hoje.">
            <Forecast data={fc} cap={settings.dailyCap} />
          </Panel>

          {uncovered.length > 0 && (
            <Panel tone="muted" title="Estudados sem revisão">
              <p className="text-sm">
                {uncovered.length} {uncovered.length === 1 ? "tópico marcado" : "tópicos marcados"} como estudado em Matérias ainda não {uncovered.length === 1 ? "tem" : "têm"} revisão agendada.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {uncovered.slice(0, 6).map((u) => (
                  <span key={u.topic.id} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs">
                    <Dot color={u.subject.color} /> {u.topic.title}
                  </span>
                ))}
                {uncovered.length > 6 && <span className="text-xs text-muted-foreground">+{uncovered.length - 6}</span>}
              </div>
              <Button size="sm" className="mt-3" onClick={scheduleUncovered}><ListChecks /> Agendar todos a partir de hoje</Button>
            </Panel>
          )}

          <Panel tone="field" title="Como funciona">
            <ul className="space-y-3 text-sm leading-relaxed text-primary-foreground/90">
              <li>
                <b className="text-brass">Esquecimento.</b> Sem revisar, um dia depois da aula resta cerca de um terço do que foi aprendido (Ebbinghaus; Murre &amp; Dros, 2015). Cada revisão achata a curva.
              </li>
              <li>
                <b className="text-brass">Lembrar vale mais que reler.</b> Quem se testa retém 50% a mais depois de uma semana do que quem relê (Roediger &amp; Karpicke, 2006). Por isso cada etapa pede folha em branco e questões.
              </li>
              <li>
                <b className="text-brass">Intervalos crescentes.</b> O espaço ideal entre revisões é de 10 a 20% do tempo até a prova (Cepeda et al., 2008).
                {examDays !== null && examDays > 2 && <> Com {examDays} dias para o {profile.exam}, nenhum intervalo passa de {Math.max(1, Math.floor(examDays * 0.2))} dias.</>}
              </li>
              <li>
                <b className="text-brass">Quatro notas.</b> "Esqueci" volta ao começo; "difícil" repete a etapa em menos tempo; "lembrei" segue o calendário; "fácil" pula uma etapa. Depois de {describeSchedule(settings.schedule.slice(-1)).replace("em ", "")} o intervalo dobra até o assunto ser dado como dominado.
              </li>
            </ul>
            <Link to="/configuracoes" className="mt-4 inline-block text-sm text-brass underline-offset-4 hover:underline">Ajustar método e limites</Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Quantas questões do caderno de erros batem com a matéria/tópico desta revisão. */
function useErrorCount(subjectName: string | undefined, title: string) {
  const bank = useApp((s) => s.questionBank);
  const tax = useApp((s) => s.qTaxonomy);
  return useMemo(() => {
    if (!subjectName || !tax) return { count: 0, topicMatched: false };
    const qs = tax.subjects.find((s) => normalizeText(s.name) === normalizeText(subjectName));
    if (!qs) return { count: 0, topicMatched: false };
    const qt = qs.topics.find((t) => normalizeText(t.name) === normalizeText(title));
    const list = bank.filter((q) => q.subjectId === qs.id && (!qt || q.topicId === qt.id) && inErrorBook(q));
    return { count: list.length, topicMatched: !!qt };
  }, [bank, tax, subjectName, title]);
}

function ReviewCard({ item, today, examDate, first }: { item: ReviewItem; today: string; examDate: string | undefined; first: boolean }) {
  const subj = useSubjectMap();
  const settings = useReviewSettings();
  const { gradeReview, upsertReview, postponeReview, setReviewStatus, restartReview } = useApp.getState();
  const [open, setOpen] = useState(first);
  const s = subj[item.subjectId];
  const preview = previewIntervals(item, settings, today, examDate);
  const mem = Math.round(retention(item, today) * 100);
  const late = item.due < today;
  const act = activityForStep(item.step);
  const errors = useErrorCount(s?.name, item.title);
  const leech = isLeech(item);

  const grade = (g: ReviewGrade) => {
    const before = item;
    const after = gradeReview(item.id, g);
    if (!after) return;
    toast.success(`${GRADE_INFO[g].label}: ${item.title}`, {
      description: after.status === "dominada" ? "Assunto dominado. Ele sai da fila; você pode reativar quando quiser." : `Próxima revisão ${fmtInterval(after.interval)} (${format(parseISO(after.due), "dd/MM")}).`,
      duration: 7000,
      action: { label: "Desfazer", onClick: () => { upsertReview(before); toast("Nota desfeita."); } },
    });
  };

  return (
    <li className={cn("relative overflow-hidden rounded-xl border bg-card shadow-card transition-shadow hover:shadow-lift", late && "border-destructive/30", first && "ring-1 ring-brass/40")}>
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: s?.color ?? "var(--muted-foreground)" }} />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2 text-muted-foreground">
              <Dot color={s?.color ?? "gray"} /> {s?.name ?? "Matéria removida"}
            </p>
            <h3 className="mt-0.5 text-xl font-bold leading-tight">{item.title}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Tag tone="review" title={act.title}>R{item.step + 1} · {act.title}</Tag>
              {late && <Tag tone="alert">{fmtRelativeDue(item, today)}</Tag>}
              {leech && <Tag tone="warning" title={`Esquecido ${item.lapses} vezes: reestude a teoria antes de revisar de novo.`}><AlertTriangle className="size-3" /> caso-problema</Tag>}
              <Tag tone="muted">estudado há {daysSinceStudy(item, today)} d</Tag>
              {item.lapses > 0 && !leech && <Tag tone="muted">{item.lapses} {item.lapses === 1 ? "lapso" : "lapsos"}</Tag>}
            </div>
          </div>
          <div className="w-28 shrink-0 text-right">
            <p className="eyebrow text-muted-foreground">Memória est.</p>
            <p className={cn("numeral text-2xl", mem < 70 ? "text-destructive" : mem < 85 ? "text-warning" : "text-success")}>{mem}%</p>
            <Bar value={mem} className="mt-1 h-1.5" color={mem < 70 ? "var(--destructive)" : mem < 85 ? "var(--warning)" : "var(--success)"} />
          </div>
        </div>

        <button type="button" onClick={() => setOpen(!open)} className="mt-3 flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-left text-sm hover:bg-muted" aria-expanded={open}>
          <span className="font-medium">Como revisar · {act.minutes} min</span>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-2 space-y-2 rounded-lg border border-dashed p-3 text-sm">
            <p>{act.what}</p>
            {leech && <p className="text-warning"><b>Caso-problema:</b> você esqueceu este assunto {item.lapses} vezes. Volte à teoria, refaça anotações e depois reinicie o calendário.</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {s && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/questoes" search={{ aba: errors.count ? "caderno" : "resolver", materia: s.name, topico: errors.topicMatched ? item.title : undefined }}>
                    <ListChecks /> {errors.count ? `Refazer ${errors.count} erradas` : "Questões do tópico"}
                  </Link>
                </Button>
              )}
              {item.note && <span className="text-xs italic text-muted-foreground">“{item.note}”</span>}
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-4 gap-2">
          {([0, 1, 2, 3] as ReviewGrade[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => grade(g)}
              title={GRADE_INFO[g].help}
              className={cn("press flex flex-col items-center gap-0.5 rounded-lg border bg-background px-2 py-2 text-sm font-semibold transition-colors", GRADE_STYLE[g])}
            >
              <span>{GRADE_INFO[g].label}</span>
              <span className="tabular text-[11px] font-normal text-muted-foreground">{fmtInterval(preview[g])}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-1 text-xs">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost"><CalendarClock /> Adiar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { postponeReview(item.id, 1); toast("Adiada para amanhã."); }}>Amanhã</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { postponeReview(item.id, 3); toast("Adiada 3 dias."); }}>Em 3 dias</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { postponeReview(item.id, 7); toast("Adiada 1 semana."); }}>Em 1 semana</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {leech && <Button size="sm" variant="ghost" onClick={() => { restartReview(item.id); toast("Calendário reiniciado a partir de hoje."); }}><RotateCcw /> Reestudei</Button>}
          <Button size="sm" variant="ghost" onClick={() => { setReviewStatus(item.id, "pausada"); toast("Revisão pausada."); }}><Pause /> Pausar</Button>
        </div>
      </div>
    </li>
  );
}

function Forecast({ data, cap }: { data: { date: string; count: number }[]; cap: number }) {
  const max = Math.max(1, ...data.map((d) => d.count), cap);
  return (
    <div>
      <div className="grid items-end gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, height: 112 }}>
        {data.map((d, i) => {
          const h = (d.count / max) * 100;
          const over = cap > 0 && d.count > cap;
          return (
            <div key={d.date} className="group relative flex h-full flex-col justify-end" title={`${format(parseISO(d.date), "EEEE, dd/MM", { locale: ptBR })}: ${d.count}`}>
              {d.count > 0 && <span className="tabular mb-0.5 text-center text-[10px] text-muted-foreground">{d.count}</span>}
              <div
                className={cn("w-full rounded-t-sm transition-all", i === 0 ? "bg-status-review" : over ? "bg-destructive/70" : "bg-primary/70", d.count === 0 && "bg-muted")}
                style={{ height: `${Math.max(4, h)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid gap-1 text-center text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d, i) => (
          <span key={d.date}>{i === 0 ? "hoje" : format(parseISO(d.date), "EEEEE", { locale: ptBR })}<br /><span className="tabular">{d.date.slice(8)}</span></span>
        ))}
      </div>
      {cap > 0 && <p className="mt-2 text-xs text-muted-foreground">Limite diário: {cap}. Dias acima do limite aparecem em vermelho.</p>}
    </div>
  );
}

function AllReviews({ today }: { today: string }) {
  const reviews = useApp((s) => s.reviews);
  const subjects = useApp((s) => s.subjects);
  const subj = useSubjectMap();
  const { setReviewStatus, restartReview, removeReview } = useApp.getState();
  const [subjectId, setSubjectId] = useState("");
  const [status, setStatus] = useState<"" | ReviewStatus>("");
  const list = useMemo(
    () =>
      reviews
        .filter((r) => (!subjectId || r.subjectId === subjectId) && (!status || r.status === status))
        .sort((a, b) => (a.status === b.status ? a.due.localeCompare(b.due) : a.status === "ativa" ? -1 : b.status === "ativa" ? 1 : a.status.localeCompare(b.status))),
    [reviews, subjectId, status],
  );

  if (reviews.length === 0) return <Empty>Nenhuma revisão cadastrada ainda.</Empty>;
  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <NativeSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Matéria">
          <option value="">Todas as matérias</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as "" | ReviewStatus)} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="ativa">Ativas</option>
          <option value="pausada">Pausadas</option>
          <option value="dominada">Dominadas</option>
        </NativeSelect>
      </div>
      <SectionLabel className="mb-2">{list.length} {list.length === 1 ? "assunto" : "assuntos"}</SectionLabel>
      <ul className="divide-y rounded-xl border">
        {list.map((r) => {
          const s = subj[r.subjectId];
          const ok = r.history.filter((h) => h.grade >= 2).length;
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <Dot color={s?.color ?? "gray"} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.title} <span className="text-xs text-muted-foreground">· {s?.name ?? "Matéria removida"}</span></p>
                <p className="text-xs text-muted-foreground">
                  {r.status === "ativa" ? <>Próxima: <b className="text-foreground">{fmtRelativeDue(r, today)}</b> ({format(parseISO(r.due), "dd/MM")}) · </> : null}
                  R{r.step + 1} · intervalo {fmtInterval(r.interval)} · {ok} {ok === 1 ? "acerto" : "acertos"}, {r.lapses} {r.lapses === 1 ? "lapso" : "lapsos"}
                  {r.history.length > 0 && <> · última {format(parseISO(r.history[r.history.length - 1]!.date), "dd/MM")}</>}
                </p>
              </div>
              <Tag tone={r.status === "ativa" ? "review" : r.status === "dominada" ? "success" : "muted"}>{STATUS_LABEL[r.status]}</Tag>
              <div className="flex">
                {r.status === "ativa" ? (
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Pausar" title="Pausar" onClick={() => setReviewStatus(r.id, "pausada")}><Pause /></Button>
                ) : (
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Reativar" title="Reativar" onClick={() => setReviewStatus(r.id, "ativa")}><Play /></Button>
                )}
                <Button size="icon" variant="ghost" className="size-8" aria-label="Reiniciar calendário" title="Reiniciar como estudado hoje" onClick={() => { restartReview(r.id); toast("Calendário reiniciado."); }}><Undo2 /></Button>
                <ConfirmDelete title={`Remover “${r.title}”?`} description="O histórico de revisões deste assunto será apagado." confirmLabel="Remover" onConfirm={() => removeReview(r.id)}>
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Remover"><Trash2 /></Button>
                </ConfirmDelete>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
