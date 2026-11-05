import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Archive, Copy, Pencil, Play, Plus, Trash2, CheckCircle2, Pause } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bar, Dot, Empty, PageHeader, Panel } from "@/components/kit";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { NativeSelect } from "@/components/NativeSelect";
import { uid, useApp } from "@/lib/store";
import { countWorkdays, cycleReport, cyclesInMonth, fmtDec, fmtHours, monthDays, ymd } from "@/lib/calc";
import { CYCLE_STATUS_LABEL } from "@/lib/labels";
import type { Cycle, CycleStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ciclos")({
  head: () => ({
    meta: [
      { title: "Ciclos de estudo — Quartel de Estudos" },
      { name: "description", content: "Monte ciclos de estudo com horas proporcionais ao peso de cada matéria." },
      { property: "og:title", content: "Ciclos de estudo — Quartel de Estudos" },
      { property: "og:description", content: "Horas por matéria calculadas pelo peso de dificuldade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CiclosPage,
});

const STATUS_STYLE: Record<CycleStatus, string> = {
  ativo: "bg-success/15 text-success border-success/30",
  pausado: "bg-warning/15 text-warning border-warning/30",
  concluido: "bg-status-review/15 text-status-review border-status-review/30",
  arquivado: "bg-muted text-muted-foreground",
};

function CiclosPage() {
  const cycles = useApp((s) => s.cycles);
  const subjects = useApp((s) => s.subjects);
  const sessions = useApp((s) => s.sessions);
  const meta = useApp((s) => s.dayMeta);
  const { removeCycle, duplicateCycle, activateCycle, upsertCycle } = useApp.getState();
  const [showArchived, setShowArchived] = useState(false);
  const today = ymd(new Date());
  const list = cycles
    .filter((c) => (showArchived ? c.status === "arquivado" : c.status !== "arquivado"))
    .sort((a, b) => (a.status === "ativo" ? -1 : b.status === "ativo" ? 1 : 0));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Planejamento" title="Ciclos">
        <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Ver ciclos" : "Arquivados"}
        </Button>
        <CycleDialog>
          <Button><Plus /> Novo ciclo</Button>
        </CycleDialog>
      </PageHeader>

      {list.length === 0 && <Empty>Nenhum ciclo aqui.</Empty>}

      <div className="space-y-6">
        {list.map((c) => (
          <CycleCard key={c.id} cycle={c} today={today} subjects={subjects} sessions={sessions} meta={meta}
            actions={
              <>
                {c.status !== "ativo" && c.status !== "arquivado" && (
                  <Button size="sm" variant="outline" onClick={() => { activateCycle(c.id); toast.success(`${c.name} ativado.`); }}><Play /> Ativar</Button>
                )}
                {c.status === "ativo" && (
                  <Button size="sm" variant="outline" onClick={() => upsertCycle({ ...c, status: "pausado" })}><Pause /> Pausar</Button>
                )}
                {c.status !== "concluido" && c.status !== "arquivado" && (
                  <Button size="sm" variant="ghost" onClick={() => upsertCycle({ ...c, status: "concluido" })}><CheckCircle2 /> Concluir</Button>
                )}
                <CycleDialog cycle={c}><Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button></CycleDialog>
                <Button size="icon" variant="ghost" aria-label="Duplicar" onClick={() => { duplicateCycle(c.id); toast("Ciclo duplicado."); }}><Copy /></Button>
                <Button size="icon" variant="ghost" aria-label={c.status === "arquivado" ? "Desarquivar" : "Arquivar"}
                  onClick={() => upsertCycle({ ...c, status: c.status === "arquivado" ? "pausado" : "arquivado" })}><Archive /></Button>
                <ConfirmDelete title={`Excluir ${c.name}?`} onConfirm={() => removeCycle(c.id)}>
                  <Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 /></Button>
                </ConfirmDelete>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}

function CycleCard({ cycle, today, subjects, sessions, meta, actions }: {
  cycle: Cycle; today: string; subjects: ReturnType<typeof useApp.getState>["subjects"]; sessions: ReturnType<typeof useApp.getState>["sessions"]; meta: ReturnType<typeof useApp.getState>["dayMeta"]; actions: ReactNode;
}) {
  const r = useMemo(() => cycleReport(cycle, subjects, sessions, meta, today), [cycle, subjects, sessions, meta, today]);
  const days = monthDays(parseISO(today));
  const { work, rest } = countWorkdays(days, cycle.restWeekdays, meta);
  const perMonth = cyclesInMonth(work, cycle.dailyHours, r.target);
  const totalWeight = r.rows.reduce((a, x) => a + x.subject.multiplier, 0);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold uppercase">{cycle.name}</h2>
            <Badge variant="outline" className={STATUS_STYLE[cycle.status]}>{CYCLE_STATUS_LABEL[cycle.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Desde {format(parseISO(cycle.startDate), "dd/MM/yyyy")} · {fmtHours(cycle.weeklyHours)}/semana · {fmtHours(cycle.dailyHours)}/dia útil · peso total {fmtDec(totalWeight)}X
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">{actions}</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Kpi label="Meta do ciclo" value={fmtHours(r.target)} />
        <Kpi label="Estudado" value={fmtHours(r.studied)} />
        <Kpi label="Restante" value={fmtHours(r.remaining)} />
        <Kpi label="Dias úteis p/ concluir" value={`${r.workdaysNeeded} (${fmtDec(r.weeksNeeded, 1)} sem.)`} />
        <Kpi label="Término previsto" value={r.remaining > 0 ? format(parseISO(r.projectedEnd), "dd/MM") : "Concluído"} />
        <Kpi label="Reinício" value={format(parseISO(r.restartDate), "dd/MM")} />
      </div>
      <div className="mt-4">
        <Bar value={r.pct} />
        <p className="mt-2 text-xs text-muted-foreground">
          {Math.round(r.pct)}% concluído · {r.pending.length} matéria(s) pendente(s) · {r.fitsThisWeek} cabem no tempo útil desta semana ·
          mês atual: {work} dias úteis, {rest} de descanso → <b>{perMonth}</b> ciclo(s) completo(s)
        </p>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="eyebrow border-b text-left text-muted-foreground">
              <th className="py-2">Matéria</th>
              <th className="text-right">Peso</th>
              <th className="text-right">Prev./semana</th>
              <th className="text-right">Prev./dia útil</th>
              <th className="text-right">Estudadas</th>
              <th className="text-right">Restantes</th>
              <th className="w-40 pl-4">Progresso</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => (
              <tr key={row.subject.id} className="border-b last:border-0">
                <td className="py-2.5"><span className="flex items-center gap-2"><Dot color={row.subject.color} />{row.subject.name}</span></td>
                <td className="tabular text-right">{fmtDec(row.subject.multiplier)}X</td>
                <td className="tabular text-right">{fmtDec(row.weekly)}h</td>
                <td className="tabular text-right">{fmtDec(row.perWorkday)}h</td>
                <td className="tabular text-right">{fmtHours(row.studied)}</td>
                <td className="tabular text-right">{fmtHours(row.remaining)}</td>
                <td className="pl-4"><div className="flex items-center gap-2"><Bar value={row.pct} color={row.subject.color} /><span className="tabular w-10 text-right text-xs">{Math.round(row.pct)}%</span></div></td>
              </tr>
            ))}
            {r.rows.length === 0 && (
              <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">Adicione matérias a este ciclo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tabular font-semibold">{value}</p>
    </div>
  );
}

function CycleDialog({ cycle, children }: { cycle?: Cycle; children: ReactNode }) {
  const subjects = useApp((s) => s.subjects);
  const cycles = useApp((s) => s.cycles);
  const profile = useApp((s) => s.profile)!;
  const { upsertCycle, activateCycle } = useApp.getState();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Cycle | null>(null);

  useEffect(() => {
    if (!open) return;
    const letter = String.fromCharCode(65 + (cycles.length % 26));
    setF(cycle ?? {
      id: uid(), name: `Ciclo ${letter}`, subjectIds: subjects.filter((s) => !s.archived).map((s) => s.id),
      dailyHours: profile.dailyHours, weeklyHours: profile.weeklyHours, durationDays: 7,
      restWeekdays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !profile.studyWeekdays.includes(d)),
      goalHours: profile.weeklyHours, startDate: ymd(new Date()), status: "pausado",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!f) return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{children}</DialogTrigger></Dialog>;
  const n = (k: "weeklyHours" | "dailyHours" | "durationDays" | "goalHours") => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Math.max(0, Number(e.target.value)) });

  const save = () => {
    if (!f.name.trim()) {
      toast.error("Dê um nome ao ciclo.");
      return;
    }
    upsertCycle({ ...f, name: f.name.trim() });
    if (f.status === "ativo") activateCycle(f.id);
    toast.success("Ciclo salvo.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{cycle ? "Editar ciclo" : "Novo ciclo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <NativeSelect value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as CycleStatus })}>
                {(Object.keys(CYCLE_STATUS_LABEL) as CycleStatus[]).map((s) => <option key={s} value={s}>{CYCLE_STATUS_LABEL[s]}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matérias do ciclo</Label>
            <div className="flex flex-wrap gap-2">
              {subjects.filter((s) => !s.archived).map((s) => {
                const on = f.subjectIds.includes(s.id);
                return (
                  <button key={s.id} type="button"
                    onClick={() => setF({ ...f, subjectIds: on ? f.subjectIds.filter((x) => x !== s.id) : [...f.subjectIds, s.id] })}
                    className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>
                    <Dot color={s.color} />{s.name} <span className="tabular text-xs opacity-75">{s.multiplier}X</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2"><Label>Horas/semana</Label><Input type="number" min={0} step="0.5" value={f.weeklyHours} onChange={n("weeklyHours")} /></div>
            <div className="space-y-2"><Label>Horas/dia</Label><Input type="number" min={0} step="0.5" value={f.dailyHours} onChange={n("dailyHours")} /></div>
            <div className="space-y-2"><Label>Duração (dias)</Label><Input type="number" min={1} value={f.durationDays} onChange={n("durationDays")} /></div>
            <div className="space-y-2"><Label>Meta (h)</Label><Input type="number" min={0} value={f.goalHours} onChange={n("goalHours")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Início</Label><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Término previsto (opcional)</Label><Input type="date" value={f.endDate ?? ""} onChange={(e) => setF({ ...f, endDate: e.target.value || undefined })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Dias de descanso do ciclo</Label>
            <WeekdayPicker value={f.restWeekdays} onChange={(v) => setF({ ...f, restWeekdays: v })} tone="rest" />
          </div>
          <p className="text-xs text-muted-foreground">
            Cada matéria recebe horas = horas semanais × peso ÷ soma dos pesos. Se a meta for 0, ela vira horas/semana × duração ÷ 7.
          </p>
        </div>
        <DialogFooter><Button onClick={save}>Salvar ciclo</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
