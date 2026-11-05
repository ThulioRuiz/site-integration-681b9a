import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, Pause, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, Panel, Dot } from "@/components/kit";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { ReviewScheduleDialog } from "@/components/ReviewScheduleDialog";
import { useNow } from "@/hooks/use-now";
import { timerElapsedMs, uid, useApp } from "@/lib/store";
import { fmtMin, splitEvenly, sumMinutes, ymd } from "@/lib/calc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cronometro")({
  head: () => ({
    meta: [
      { title: "Cronômetro — Quartel de Estudos" },
      { name: "description", content: "Cronometre suas horas líquidas de estudo e distribua o tempo entre as matérias." },
      { property: "og:title", content: "Cronômetro — Quartel de Estudos" },
      { property: "og:description", content: "Cronometre horas líquidas e distribua o tempo entre as matérias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CronometroPage,
});

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return { h: p(Math.floor(s / 3600)), m: p(Math.floor((s % 3600) / 60)), s: p(s % 60) };
}

function CronometroPage() {
  const now = useNow(250);
  const timer = useApp((s) => s.timer);
  const { timerStart, timerPause, timerResume, timerReset } = useApp.getState();
  const sessions = useApp((s) => s.sessions);
  const [finishing, setFinishing] = useState(false);
  const ms = timerElapsedMs(timer, now.getTime());
  const c = fmtClock(ms);
  const todayMin = sumMinutes(sessions.filter((s) => s.date === ymd(now)));

  const finish = () => {
    if (timer.status === "rodando") timerPause();
    setFinishing(true);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Horas líquidas" title="Cronômetro" />
      <Panel className="grid-paper relative overflow-hidden text-center">
        <p className="eyebrow text-muted-foreground">
          {timer.status === "rodando" ? "Estudando" : timer.status === "pausado" ? "Pausado" : "Pronto para começar"}
        </p>
        <div className="tabular my-6 flex items-baseline justify-center gap-1 text-7xl font-semibold leading-none sm:text-8xl md:text-9xl">
          <span>{c.h}</span><span className="opacity-40">:</span><span>{c.m}</span>
          <span className="opacity-40">:</span><span className="text-brass">{c.s}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {timer.status === "parado" && (
            <Button variant="brass" size="lg" onClick={timerStart} className="h-14 px-10 text-base">
              <Play /> Iniciar estudo
            </Button>
          )}
          {timer.status === "rodando" && (
            <Button variant="outline" size="lg" onClick={timerPause} className="h-14 px-8 text-base">
              <Pause /> Pausar
            </Button>
          )}
          {timer.status === "pausado" && (
            <Button variant="field" size="lg" onClick={timerResume} className="h-14 px-8 text-base">
              <Play /> Retomar
            </Button>
          )}
          {timer.status !== "parado" && (
            <Button size="lg" onClick={finish} className="h-14 px-8 text-base">
              <Square /> Finalizar estudo
            </Button>
          )}
          {timer.status === "pausado" && (
            <ConfirmDelete title="Descartar este tempo?" description="O tempo cronometrado não será salvo." confirmLabel="Descartar" onConfirm={timerReset}>
              <Button size="lg" variant="ghost" className="h-14"><Trash2 /> Descartar</Button>
            </ConfirmDelete>
          )}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">
          Hoje: <b className="tabular text-foreground">{fmtMin(todayMin)}</b> líquidas. O cronômetro continua contando se você trocar de aba ou fechar o app.
        </p>
      </Panel>
      {finishing && <FinishDialog totalMs={ms} onClose={() => setFinishing(false)} />}
    </div>
  );
}

function FinishDialog({ totalMs, onClose }: { totalMs: number; onClose: () => void }) {
  const subjects = useApp((s) => s.subjects).filter((s) => !s.archived);
  const { addSessions, removeGroup, timerReset, setDayMeta } = useApp.getState();
  const total = Math.max(1, Math.round(totalMs / 60000));
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState(false);
  const [manualMin, setManualMin] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [review, setReview] = useState(false);
  const [reading, setReading] = useState(false);
  /** Depois de salvar, oferece agendar as revisões do que foi estudado. */
  const [scheduling, setScheduling] = useState<string[] | null>(null);

  const even = splitEvenly(total, selected.length);
  const alloc: number[] = selected.map((id, i) => (manual ? manualMin[id] ?? 0 : even[i] ?? 0));
  const allocSum = alloc.reduce((a, b) => a + b, 0);
  const valid = selected.length > 0 && allocSum === total && alloc.every((x) => x >= 0);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = () => {
    if (!valid) return;
    const groupId = uid();
    const date = ymd(new Date());
    addSessions(
      selected
        .map((id, i) => ({ id: uid(), date, subjectId: id, minutes: alloc[i] ?? 0, kind: "estudo" as const, note, source: "cronometro" as const, createdAt: Date.now(), groupId }))
        .filter((s) => s.minutes > 0),
    );
    const prevMeta = useApp.getState().dayMeta[date] ?? {};
    if (review) setDayMeta(date, { reviewDone: true });
    if (reading) setDayMeta(date, { readingDone: true });
    timerReset();
    toast.success(`${fmtMin(total)} de estudo salvos.`, {
      duration: 8000,
      action: {
        label: "Desfazer",
        onClick: () => {
          removeGroup(groupId);
          setDayMeta(date, { reviewDone: prevMeta.reviewDone, readingDone: prevMeta.readingDone });
          toast("Registro desfeito.");
        },
      },
    });
    setScheduling(selected);
  };

  if (scheduling) {
    return (
      <ReviewScheduleDialog
        open
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
        subjectIds={scheduling}
        onScheduled={() => onClose()}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl uppercase">Finalizar estudo</DialogTitle>
          <DialogDescription>
            Tempo total: <b className="tabular text-foreground">{fmtMin(total)}</b> ({total} min). Escolha as matérias estudadas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected.includes(s.id) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              <Dot color={s.color} /> {s.name}
            </button>
          ))}
        </div>

        {selected.length > 0 && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex gap-2">
              <Button size="sm" variant={!manual ? "default" : "outline"} onClick={() => setManual(false)}>Dividir igualmente</Button>
              <Button
                size="sm"
                variant={manual ? "default" : "outline"}
                onClick={() => {
                  setManual(true);
                  setManualMin(Object.fromEntries(selected.map((id, i) => [id, even[i] ?? 0])));
                }}
              >
                Dividir manualmente
              </Button>
            </div>
            {selected.map((id, i) => {
              const s = subjects.find((x) => x.id === id)!;
              return (
                <div key={id} className="flex items-center gap-3 text-sm">
                  <Dot color={s.color} />
                  <span className="flex-1">{s.name}</span>
                  {manual ? (
                    <Input type="number" min={0} className="tabular h-8 w-24" value={manualMin[id] ?? 0}
                      onChange={(e) => setManualMin({ ...manualMin, [id]: Math.max(0, Math.round(Number(e.target.value))) })} />
                  ) : (
                    <span className="tabular font-semibold">{alloc[i]} min</span>
                  )}
                </div>
              );
            })}
            {manual && allocSum !== total && (
              <p className="text-sm text-destructive">
                A soma ({allocSum} min) precisa ser igual ao tempo total ({total} min).
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Observação (opcional)</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={review} onCheckedChange={(v) => setReview(!!v)} /> Houve revisão</label>
          <label className="flex items-center gap-2"><Checkbox checked={reading} onCheckedChange={(v) => setReading(!!v)} /> Houve leitura</label>
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-status-review/10 p-3 text-xs text-muted-foreground">
          <Brain className="mt-0.5 size-4 shrink-0 text-status-review" />
          Ao salvar, você escolhe os tópicos que estudou para agendar a revisão de 24h e as seguintes.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Voltar</Button>
          <Button onClick={save} disabled={!valid}>Salvar estudo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
