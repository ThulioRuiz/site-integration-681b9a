import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "@tanstack/react-router";
import { BedDouble, BookOpen, Brain, Pencil, Plus, RotateCcw, Trash2, Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { commitmentMinutes, commitmentOccursOn, fmtMin, isRestDay, minutesBy, sumMinutes } from "@/lib/calc";
import { useApp, useRestWeekdays, useSubjectMap } from "@/lib/store";
import { KIND_LABEL, REPEAT_LABEL } from "@/lib/labels";
import { GRADE_INFO, reviewsOn } from "@/lib/review";
import { SessionDialog } from "./SessionDialog";
import { CommitmentDialog } from "./CommitmentDialog";
import { ConfirmDelete } from "./ConfirmDialog";
import { Dot } from "./kit";

export function DayDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const allSessions = useApp((s) => s.sessions);
  const commitments = useApp((s) => s.commitments);
  const reviews = useApp((s) => s.reviews);
  const meta = useApp((s) => s.dayMeta);
  const setDayMeta = useApp((s) => s.setDayMeta);
  const removeSession = useApp((s) => s.removeSession);
  const removeCommitment = useApp((s) => s.removeCommitment);
  const rest = useRestWeekdays();
  const subj = useSubjectMap();

  const sessions = allSessions.filter((s) => s.date === date);
  const dayCommitments = commitments.filter((c) => commitmentOccursOn(c, date));
  const net = sumMinutes(sessions);
  const gross = dayCommitments.reduce((a, c) => a + commitmentMinutes(c), 0);
  const bySubject = minutesBy(sessions, (s) => s.subjectId);
  const restDay = isRestDay(date, rest, meta);
  const m = meta[date] ?? {};
  const d = parseISO(date);
  const rev = reviewsOn(reviews, date);
  const doneHere = rev.done.map((r) => ({ r, h: r.history.find((h) => h.date === date)! }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <p className="eyebrow text-brass">{format(d, "EEEE", { locale: ptBR })}</p>
          <DialogTitle className="font-display text-3xl uppercase">
            {format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-status-study/10 p-3">
            <p className="eyebrow text-muted-foreground">Horas líquidas</p>
            <p className="tabular text-2xl font-semibold">{fmtMin(net)}</p>
          </div>
          <div className="rounded-lg border bg-status-commit/10 p-3">
            <p className="eyebrow text-muted-foreground">Horas brutas</p>
            <p className="tabular text-2xl font-semibold">{fmtMin(gross)}</p>
          </div>
        </div>

        <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
          <Toggle icon={<BedDouble className="size-4" />} label="Dia de descanso" checked={restDay} onChange={(v) => setDayMeta(date, { rest: v })} />
          <Toggle icon={<RotateCcw className="size-4" />} label="Revisão feita" checked={!!m.reviewDone} onChange={(v) => setDayMeta(date, { reviewDone: v })} />
          <Toggle icon={<BookOpen className="size-4" />} label="Leitura feita" checked={!!m.readingDone} onChange={(v) => setDayMeta(date, { readingDone: v })} />
        </div>

        {Object.keys(bySubject).length > 0 && (
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Tempo por matéria</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(bySubject).map(([id, min]) => (
                <span key={id} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <Dot color={subj[id]?.color ?? "gray"} />
                  {subj[id]?.name ?? "Matéria removida"}
                  <b className="tabular">{fmtMin(min)}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        {(rev.scheduled.length > 0 || doneHere.length > 0) && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow flex items-center gap-1.5 text-muted-foreground"><Brain className="size-3.5 text-status-review" /> Revisões</p>
              <Link to="/revisoes" className="text-xs text-primary underline-offset-2 hover:underline" onClick={onClose}>Abrir fila</Link>
            </div>
            <ul className="divide-y rounded-lg border">
              {doneHere.map(({ r, h }) => (
                <li key={`d-${r.id}`} className="flex items-center gap-3 p-2.5 text-sm">
                  <Dot color={subj[r.subjectId]?.color ?? "gray"} />
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <span className="rounded bg-success/15 px-1.5 py-0.5 text-[11px] font-semibold text-success">{GRADE_INFO[h.grade].label}</span>
                </li>
              ))}
              {rev.scheduled.filter((r) => !doneHere.some((x) => x.r.id === r.id)).map((r) => (
                <li key={r.id} className="flex items-center gap-3 p-2.5 text-sm">
                  <Dot color={subj[r.subjectId]?.color ?? "gray"} />
                  <span className="min-w-0 flex-1 truncate">{r.title}</span>
                  <span className="rounded bg-status-review/20 px-1.5 py-0.5 text-[11px] font-semibold">R{r.step + 1} marcada</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow text-muted-foreground">Registros de estudo</p>
            <SessionDialog date={date}>
              <Button size="sm" variant="outline"><Plus /> Estudo manual</Button>
            </SessionDialog>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro neste dia.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-2.5 text-sm">
                  <Dot color={s.subjectId ? subj[s.subjectId]?.color ?? "gray" : "var(--muted-foreground)"} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {s.subjectId ? subj[s.subjectId]?.name ?? "Matéria removida" : "Geral"}
                      <span className="ml-2 text-xs text-muted-foreground">{KIND_LABEL[s.kind]} · {s.source === "cronometro" ? "cronômetro" : "manual"}</span>
                    </p>
                    {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
                  </div>
                  <span className="tabular font-semibold">{fmtMin(s.minutes)}</span>
                  <SessionDialog date={date} session={s}>
                    <Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button>
                  </SessionDialog>
                  <ConfirmDelete title="Excluir registro?" onConfirm={() => removeSession(s.id)}>
                    <Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 /></Button>
                  </ConfirmDelete>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow text-muted-foreground">Compromissos (horas brutas)</p>
            <CommitmentDialog date={date}>
              <Button size="sm" variant="outline"><Plus /> Compromisso</Button>
            </CommitmentDialog>
          </div>
          {dayCommitments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem compromissos.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {dayCommitments.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-2.5 text-sm">
                  <Briefcase className="size-4" style={{ color: c.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.start}–{c.end} · {REPEAT_LABEL[c.repeat]}</p>
                  </div>
                  <span className="tabular font-semibold">{fmtMin(commitmentMinutes(c))}</span>
                  <CommitmentDialog date={date} commitment={c}>
                    <Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button>
                  </CommitmentDialog>
                  <ConfirmDelete
                    title="Excluir compromisso?"
                    description={c.repeat !== "nenhuma" ? "Este compromisso se repete — todas as repetições serão removidas." : undefined}
                    onConfirm={() => removeCommitment(c.id)}
                  >
                    <Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 /></Button>
                  </ConfirmDelete>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Label className="flex cursor-pointer items-center justify-between gap-2 rounded-md p-1.5 font-normal">
      <span className="flex items-center gap-2">{icon}{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Label>
  );
}
