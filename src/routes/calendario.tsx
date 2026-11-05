import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { addMonths, format, getDay, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BedDouble, BookOpen, Briefcase, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bar, Dot, PageHeader, Panel } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { SessionDialog } from "@/components/SessionDialog";
import { CommitmentDialog } from "@/components/CommitmentDialog";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { pickColor, uid, useApp, useRestWeekdays, useSubjectMap } from "@/lib/store";
import {
  commitmentMinutes,
  commitmentOccursOn,
  fmtMin,
  grossMinutesOn,
  isRestDay,
  minutesBy,
  monthDays,
  sumMinutes,
  timeToMin,
  ymd,
} from "@/lib/calc";
import { KIND_LABEL, REPEAT_LABEL, WEEKDAYS_SHORT } from "@/lib/labels";
import type { Repeat } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Quartel de Estudos" },
      { name: "description", content: "Calendário mensal com horas líquidas, brutas, metas, descansos e compromissos." },
      { property: "og:title", content: "Calendário — Quartel de Estudos" },
      { property: "og:description", content: "Planeje o mês: estudo, metas, descanso e compromissos." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CalendarioPage,
});

const LEGEND = [
  { cls: "bg-status-study", label: "Estudo" },
  { cls: "bg-status-goal", label: "Meta do dia" },
  { cls: "bg-status-commit", label: "Compromisso" },
  { cls: "bg-status-review", label: "Revisão" },
  { cls: "bg-status-reading", label: "Leitura" },
  { cls: "bg-status-rest", label: "Descanso" },
];

function CalendarioPage() {
  const today = ymd(new Date());
  const [ref, setRef] = useState(() => startOfMonth(new Date()));
  const [sel, setSel] = useState(today);
  const sessions = useApp((s) => s.sessions);
  const commitments = useApp((s) => s.commitments);
  const meta = useApp((s) => s.dayMeta);
  const dailyHours = useApp((s) => s.profile?.dailyHours ?? 0);
  const rest = useRestWeekdays();

  const days = useMemo(() => monthDays(ref), [ref]);
  const byDay = useMemo(() => minutesBy(sessions, (s) => s.date), [sessions]);
  const lead = getDay(parseISO(days[0] ?? today));

  const month = useMemo(() => {
    let net = 0;
    let gross = 0;
    let studied = 0;
    let goals = 0;
    let restDays = 0;
    for (const d of days) {
      const m = byDay[d] ?? 0;
      net += m;
      gross += grossMinutesOn(commitments, d);
      if (m > 0) studied++;
      if (dailyHours > 0 && m >= dailyHours * 60) goals++;
      if (isRestDay(d, rest, meta)) restDays++;
    }
    return { net, gross, studied, goals, restDays };
  }, [days, byDay, commitments, dailyHours, rest, meta]);

  const go = (r: Date) => {
    setRef(r);
    const first = ymd(r);
    setSel(first.slice(0, 7) === today.slice(0, 7) ? today : first);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Planejamento" title="Calendário">
        <Button variant="outline" onClick={() => go(startOfMonth(new Date()))}>
          Hoje
        </Button>
        <SessionDialog date={sel}>
          <Button>
            <Plus /> Adicionar estudo
          </Button>
        </SessionDialog>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <MiniStat label="Líquidas no mês" value={fmtMin(month.net)} />
        <MiniStat label="Brutas no mês" value={fmtMin(month.gross)} />
        <MiniStat label="Dias estudados" value={String(month.studied)} />
        <MiniStat label="Metas batidas" value={String(month.goals)} />
        <MiniStat label="Descansos" value={String(month.restDays)} className="col-span-2 md:col-span-1" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => go(subMonths(ref, 1))} aria-label="Mês anterior">
              <ChevronLeft />
            </Button>
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide">
              {format(ref, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => go(addMonths(ref, 1))} aria-label="Próximo mês">
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="eyebrow py-1 text-muted-foreground">
                {d}
              </div>
            ))}
            {Array.from({ length: lead }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {days.map((d) => {
              const min = byDay[d] ?? 0;
              const restDay = isRestDay(d, rest, meta);
              const goal = !restDay && dailyHours > 0 && min >= dailyHours * 60;
              const commit = commitments.some((c) => commitmentOccursOn(c, d));
              const m = meta[d];
              return (
                <button
                  key={d}
                  onClick={() => setSel(d)}
                  aria-label={format(parseISO(d), "d 'de' MMMM", { locale: ptBR })}
                  aria-pressed={d === sel}
                  className={cn(
                    "relative flex aspect-[1/0.95] min-w-0 flex-col justify-between rounded-lg border p-1.5 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-card",
                    restDay
                      ? "border-transparent bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,transparent_5px_10px)] text-muted-foreground"
                      : "bg-background",
                    min > 0 && !restDay && "bg-status-study/15",
                    goal && "border-status-goal bg-status-goal/20",
                    d === today && "ring-2 ring-brass ring-offset-1 ring-offset-card",
                    d === sel && "!border-foreground !bg-foreground !text-background shadow-lift",
                  )}
                >
                  <span className={cn("tabular text-xs font-semibold sm:text-sm", d === today && "font-bold")}>
                    {Number(d.slice(8))}
                  </span>
                  {min > 0 && (
                    <span className="tabular hidden text-[10px] opacity-75 sm:block">{(min / 60).toFixed(1).replace(".", ",")}h</span>
                  )}
                  <span className="flex min-h-1.5 gap-0.5">
                    {min > 0 && <i className="size-1.5 rounded-full bg-status-study" />}
                    {goal && <i className="size-1.5 rounded-full bg-status-goal" />}
                    {commit && <i className="size-1.5 rounded-full bg-status-commit" />}
                    {m?.reviewDone && <i className="size-1.5 rounded-full bg-status-review" />}
                    {m?.readingDone && <i className="size-1.5 rounded-full bg-status-reading" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {LEGEND.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5">
                <i className={cn("size-2.5 rounded-full", l.cls)} />
                {l.label}
              </span>
            ))}
          </div>
        </Panel>

        <DayPanel date={sel} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-3 shadow-card", className)}>
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="tabular mt-0.5 text-xl font-semibold">{value}</p>
    </div>
  );
}

function DayPanel({ date }: { date: string }) {
  const allSessions = useApp((s) => s.sessions);
  const commitments = useApp((s) => s.commitments);
  const meta = useApp((s) => s.dayMeta);
  const dailyHours = useApp((s) => s.profile?.dailyHours ?? 0);
  const { setDayMeta, removeSession, removeCommitment } = useApp.getState();
  const rest = useRestWeekdays();
  const subj = useSubjectMap();

  const sessions = allSessions.filter((s) => s.date === date);
  const dayCommitments = commitments.filter((c) => commitmentOccursOn(c, date));
  const net = sumMinutes(sessions);
  const gross = dayCommitments.reduce((a, c) => a + commitmentMinutes(c), 0);
  const restDay = isRestDay(date, rest, meta);
  const planned = restDay ? 0 : dailyHours * 60;
  const m = meta[date] ?? {};
  const d = parseISO(date);

  return (
    <Panel className="lg:sticky lg:top-6 lg:self-start">
      <p className="eyebrow text-brass">{format(d, "EEEE", { locale: ptBR })}</p>
      <h2 className="font-display text-3xl font-bold uppercase leading-tight">
        {format(d, "d 'de' MMMM", { locale: ptBR })}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-status-study/10 p-3">
          <p className="eyebrow text-muted-foreground">Líquidas</p>
          <p className="tabular text-2xl font-semibold">{fmtMin(net)}</p>
        </div>
        <div className="rounded-lg border bg-status-commit/10 p-3">
          <p className="eyebrow text-muted-foreground">Brutas</p>
          <p className="tabular text-2xl font-semibold">{fmtMin(gross)}</p>
        </div>
      </div>
      {planned > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Meta do dia: {fmtMin(planned)}</span>
            <span className="tabular">{Math.min(100, Math.round((net / planned) * 100))}%</span>
          </div>
          <Bar value={(net / planned) * 100} color={net >= planned ? "var(--status-goal)" : undefined} />
        </div>
      )}

      <div className="mt-4 grid gap-1 rounded-lg border p-2">
        <Toggle icon={<BedDouble className="size-4" />} label="Dia de descanso" checked={restDay} onChange={(v) => setDayMeta(date, { rest: v })} />
        <Toggle icon={<RotateCcw className="size-4" />} label="Revisão feita" checked={!!m.reviewDone} onChange={(v) => setDayMeta(date, { reviewDone: v })} />
        <Toggle icon={<BookOpen className="size-4" />} label="Leitura feita" checked={!!m.readingDone} onChange={(v) => setDayMeta(date, { readingDone: v })} />
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow text-muted-foreground">Estudos do dia</p>
          <SessionDialog date={date}>
            <Button size="sm" variant="outline">
              <Plus /> Estudo
            </Button>
          </SessionDialog>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum estudo registrado neste dia.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-2 p-2.5 text-sm">
                <Dot color={s.subjectId ? subj[s.subjectId]?.color ?? "gray" : "var(--muted-foreground)"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.subjectId ? subj[s.subjectId]?.name ?? "Matéria removida" : "Geral"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {KIND_LABEL[s.kind]}
                    {s.note && ` · ${s.note}`}
                  </p>
                </div>
                <span className="tabular font-semibold">{fmtMin(s.minutes)}</span>
                <SessionDialog date={date} session={s}>
                  <Button size="icon" variant="ghost" aria-label="Editar">
                    <Pencil />
                  </Button>
                </SessionDialog>
                <ConfirmDelete title="Excluir registro?" onConfirm={() => removeSession(s.id)}>
                  <Button size="icon" variant="ghost" aria-label="Excluir">
                    <Trash2 />
                  </Button>
                </ConfirmDelete>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-2 text-muted-foreground">Compromissos (horas brutas)</p>
        {dayCommitments.length > 0 && (
          <ul className="mb-3 divide-y rounded-lg border">
            {dayCommitments.map((c) => (
              <li key={c.id} className="flex items-center gap-2 p-2.5 text-sm">
                <Briefcase className="size-4 shrink-0" style={{ color: c.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.start}–{c.end} · {REPEAT_LABEL[c.repeat]}
                  </p>
                </div>
                <CommitmentDialog date={date} commitment={c}>
                  <Button size="icon" variant="ghost" aria-label="Editar">
                    <Pencil />
                  </Button>
                </CommitmentDialog>
                <ConfirmDelete
                  title="Excluir compromisso?"
                  description={c.repeat !== "nenhuma" ? "Este compromisso se repete — todas as repetições serão removidas." : undefined}
                  onConfirm={() => removeCommitment(c.id)}
                >
                  <Button size="icon" variant="ghost" aria-label="Excluir">
                    <Trash2 />
                  </Button>
                </ConfirmDelete>
              </li>
            ))}
          </ul>
        )}
        <QuickCommitment date={date} />
      </div>
    </Panel>
  );
}

/** Adição rápida de compromisso direto no painel do dia. */
function QuickCommitment({ date }: { date: string }) {
  const upsert = useApp((s) => s.upsertCommitment);
  const count = useApp((s) => s.commitments.length);
  const [name, setName] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [repeat, setRepeat] = useState<Repeat>("nenhuma");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Dê um nome ao compromisso.");
      return;
    }
    if (timeToMin(end) === timeToMin(start)) {
      toast.error("O fim precisa ser diferente do início.");
      return;
    }
    upsert({ id: uid(), name: name.trim(), date, start, end, repeat, note: "", color: pickColor(count + 1) });
    setName("");
    toast.success("Compromisso adicionado.");
  };

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-lg border border-dashed p-2.5">
      <Input placeholder="Trabalho, academia, faculdade…" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome do compromisso" />
      <div className="grid grid-cols-[1fr_1fr_1.3fr_auto] gap-2">
        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Início" required />
        <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Fim" required />
        <NativeSelect value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)} aria-label="Repetição">
          {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
            <option key={r} value={r}>
              {REPEAT_LABEL[r]}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" size="icon" aria-label="Adicionar compromisso">
          <Plus />
        </Button>
      </div>
    </form>
  );
}

function Toggle({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Label className="flex cursor-pointer items-center justify-between gap-2 rounded-md p-1.5 font-normal">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Label>
  );
}
