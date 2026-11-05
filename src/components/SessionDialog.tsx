import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "./NativeSelect";
import { uid, useApp } from "@/lib/store";
import type { SessionKind, StudySession } from "@/lib/types";
import { toast } from "sonner";

/** Adiciona ou edita um registro manual de estudo, revisão ou leitura (horas líquidas). */
export function SessionDialog({
  date,
  session,
  defaultKind = "estudo",
  children,
}: {
  date: string;
  session?: StudySession;
  defaultKind?: SessionKind;
  children: ReactNode;
}) {
  const subjects = useApp((s) => s.subjects).filter((s) => !s.archived || s.id === session?.subjectId);
  const addSessions = useApp((s) => s.addSessions);
  const updateSession = useApp((s) => s.updateSession);
  const setDayMeta = useApp((s) => s.setDayMeta);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: "", h: 0, m: 30, kind: defaultKind, note: "", date });

  useEffect(() => {
    if (!open) return;
    setForm(
      session
        ? {
            subjectId: session.subjectId ?? "",
            h: Math.floor(session.minutes / 60),
            m: session.minutes % 60,
            kind: session.kind,
            note: session.note,
            date: session.date,
          }
        : { subjectId: subjects[0]?.id ?? "", h: 0, m: 30, kind: defaultKind, note: "", date },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const minutes = form.h * 60 + form.m;
  const save = () => {
    if (minutes <= 0) {
      toast.error("Informe um tempo maior que zero.");
      return;
    }
    if (form.kind === "estudo" && !form.subjectId) {
      toast.error("Escolha a matéria.");
      return;
    }
    const base = {
      date: form.date,
      subjectId: form.subjectId || undefined,
      minutes,
      kind: form.kind,
      note: form.note,
    };
    if (session) updateSession({ ...session, ...base });
    else addSessions([{ ...base, id: uid(), source: "manual", createdAt: Date.now() }]);
    if (form.kind === "revisao") setDayMeta(form.date, { reviewDone: true });
    if (form.kind === "leitura") setDayMeta(form.date, { readingDone: true });
    toast.success(session ? "Registro atualizado." : "Registro salvo.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            {session ? "Editar registro" : "Adicionar estudo manual"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SessionKind })}>
                <option value="estudo">Estudo</option>
                <option value="revisao">Revisão</option>
                <option value="leitura">Leitura</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Matéria {form.kind !== "estudo" && "(opcional)"}</Label>
            <NativeSelect value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              {form.kind !== "estudo" && <option value="">Sem matéria</option>}
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Horas</Label>
              <Input type="number" min={0} value={form.h} onChange={(e) => setForm({ ...form, h: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="space-y-2">
              <Label>Minutos</Label>
              <Input type="number" min={0} max={59} value={form.m} onChange={(e) => setForm({ ...form, m: Math.max(0, Math.min(59, Number(e.target.value))) })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
