import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dot, Panel } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { uid, useApp, useSubjectMap } from "@/lib/store";
import { ymd } from "@/lib/calc";
import { EXAMS, type ExamId, type QuestionLog } from "@/lib/types";

/**
 * Registros em lote (versão anterior da aba): só a contagem de resolvidas/certas/erradas
 * de uma lista feita no papel. Continuam valendo para o ranking.
 */
export function LegacyLogs() {
  const logs = useApp((s) => s.questionLogs);
  const removeQuestionLog = useApp((s) => s.removeQuestionLog);
  const subj = useSubjectMap();
  const list = useMemo(() => [...logs].sort((a, b) => b.date.localeCompare(a.date)), [logs]);
  const t = list.reduce((a, l) => ({ solved: a.solved + l.solved, correct: a.correct + l.correct }), { solved: 0, correct: 0 });
  return (
    <Panel
      title="Registros em lote"
      action={<LogDialog><Button size="sm" variant="outline"><Plus /> Registrar lista</Button></LogDialog>}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Para listas resolvidas fora do banco (no papel, num livro): anote só quantas fez e quantas acertou.
        {list.length > 0 && <> Total: <b className="tabular text-foreground">{t.correct}</b> certas de <b className="tabular text-foreground">{t.solved}</b> ({t.solved ? Math.round((t.correct / t.solved) * 100) : 0}%).</>}
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro em lote.</p>
      ) : (
        <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {list.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-2.5 text-sm">
              <span className="tabular w-16 text-xs text-muted-foreground">{format(parseISO(l.date), "dd/MM/yy")}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">{l.exam}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-medium">
                  {l.subjectId && subj[l.subjectId] && <Dot color={subj[l.subjectId]!.color} />}
                  {l.subjectId ? subj[l.subjectId]?.name ?? "Matéria removida" : "Sem matéria"}{l.topic && ` · ${l.topic}`}
                </p>
                {l.notes && <p className="truncate text-xs text-muted-foreground">{l.notes}</p>}
              </div>
              <span className="tabular text-xs"><b className="text-success">{l.correct}</b> / <b className="text-destructive">{l.wrong}</b> de {l.solved}</span>
              <LogDialog log={l}><Button size="icon" variant="ghost" aria-label="Editar registro"><Pencil /></Button></LogDialog>
              <ConfirmDelete title="Excluir registro?" onConfirm={() => removeQuestionLog(l.id)}>
                <Button size="icon" variant="ghost" aria-label="Excluir registro"><Trash2 /></Button>
              </ConfirmDelete>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function LogDialog({ log, children }: { log?: QuestionLog; children: ReactNode }) {
  const subjects = useApp((s) => s.subjects);
  const profile = useApp((s) => s.profile)!;
  const upsert = useApp((s) => s.upsertQuestionLog);
  const [open, setOpen] = useState(false);
  const blank = (): QuestionLog => ({ id: uid(), date: ymd(new Date()), exam: profile.exam, subjectId: subjects[0]?.id, topic: "", solved: 10, correct: 0, wrong: 0, difficult: false, reviewLater: false, notes: "" });
  const [f, setF] = useState<QuestionLog>(blank);
  useEffect(() => {
    if (open) setF(log ?? blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = () => {
    if (f.correct + f.wrong > f.solved) {
      toast.error("Certas + erradas não podem passar do total resolvido.");
      return;
    }
    upsert({ ...f, topic: f.topic.trim() });
    toast.success("Registro salvo.");
    setOpen(false);
  };
  const n = (k: "solved" | "correct" | "wrong") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(0, Math.round(Number(e.target.value)));
    const next = { ...f, [k]: v };
    if (k === "correct" && next.solved >= v) next.wrong = Math.max(0, next.solved - v);
    setF(next);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">{log ? "Editar registro" : "Registrar lista"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Concurso</Label>
              <NativeSelect value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value as ExamId })}>
                {EXAMS.map((e) => <option key={e} value={e}>{e}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2"><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Matéria</Label>
              <NativeSelect value={f.subjectId ?? ""} onChange={(e) => setF({ ...f, subjectId: e.target.value || undefined })}>
                <option value="">—</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2"><Label>Assunto</Label><Input value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Ex.: Cinemática" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Resolvidas</Label><Input type="number" min={0} value={f.solved} onChange={n("solved")} /></div>
            <div className="space-y-2"><Label>Certas</Label><Input type="number" min={0} value={f.correct} onChange={n("correct")} /></div>
            <div className="space-y-2"><Label>Erradas</Label><Input type="number" min={0} value={f.wrong} onChange={n("wrong")} /></div>
          </div>
          <div className="space-y-2"><Label>Observações sobre os erros</Label><Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={f.difficult} onCheckedChange={(v) => setF({ ...f, difficult: !!v })} /> Difícil</label>
            <label className="flex items-center gap-2"><Checkbox checked={f.reviewLater} onCheckedChange={(v) => setF({ ...f, reviewLater: !!v })} /> Revisar depois</label>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
