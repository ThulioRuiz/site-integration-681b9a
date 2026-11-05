import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "./NativeSelect";
import { pickColor, SUBJECT_COLORS, uid, useApp } from "@/lib/store";
import type { Commitment, Repeat } from "@/lib/types";
import { REPEAT_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRESETS = ["Trabalho", "Faculdade", "Academia", "Deslocamento", "Consulta", "Outro"];

/** Compromissos = horas brutas. Nunca entram nas horas líquidas. */
export function CommitmentDialog({ date, commitment, children }: { date: string; commitment?: Commitment; children: ReactNode }) {
  const upsert = useApp((s) => s.upsertCommitment);
  const [open, setOpen] = useState(false);
  const empty: Commitment = { id: "", name: "Trabalho", date, start: "08:00", end: "12:00", repeat: "nenhuma", note: "", color: pickColor(1) };
  const [f, setF] = useState<Commitment>(empty);

  useEffect(() => {
    if (open) setF(commitment ?? { ...empty, id: uid(), date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    if (!f.name.trim()) {
      toast.error("Dê um nome ao compromisso.");
      return;
    }
    upsert({ ...f, name: f.name.trim() });
    toast.success("Compromisso salvo.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{commitment ? "Editar compromisso" : "Novo compromisso"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p} type="button" size="sm" variant={f.name === p ? "default" : "outline"} onClick={() => setF({ ...f, name: p })}>
                {p}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Término</Label>
              <Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Repetição</Label>
            <NativeSelect value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value as Repeat })}>
              {(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => (
                <option key={r} value={r}>{REPEAT_LABEL[r]}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button key={c} type="button" aria-label="Cor" onClick={() => setF({ ...f, color: c })}
                  className={cn("size-7 rounded-full border-2", f.color === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
