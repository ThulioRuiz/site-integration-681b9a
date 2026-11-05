import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Pencil, Pin, PinOff, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dot, Empty, PageHeader } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { uid, useApp, useSubjectMap } from "@/lib/store";
import { ymd } from "@/lib/calc";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notas")({
  head: () => ({
    meta: [
      { title: "Notas — Quartel de Estudos" },
      { name: "description", content: "Anotações gerais e por matéria, com busca, fixação e destaque." },
      { property: "og:title", content: "Notas — Quartel de Estudos" },
      { property: "og:description", content: "Anotações gerais e por matéria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotasPage,
});

function NotasPage() {
  const notes = useApp((s) => s.notes);
  const subjects = useApp((s) => s.subjects);
  const { upsertNote, removeNote } = useApp.getState();
  const subj = useSubjectMap();
  const [q, setQ] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [date, setDate] = useState("");

  const term = q.toLowerCase();
  const list = notes
    .filter((n) => !term || n.title.toLowerCase().includes(term) || n.body.toLowerCase().includes(term) || (n.subjectId && subj[n.subjectId]?.name.toLowerCase().includes(term)))
    .filter((n) => !subjectId || (subjectId === "geral" ? !n.subjectId : n.subjectId === subjectId))
    .filter((n) => !onlyImportant || n.important)
    .filter((n) => !date || n.date === date)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Caderno" title="Notas">
        <NoteDialog><Button><Plus /> Nova nota</Button></NoteDialog>
      </PageHeader>
      <div className="mb-5 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Pesquisar por título, conteúdo ou matéria" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <NativeSelect className="md:w-48" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Todas</option>
          <option value="geral">Notas gerais</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
        <Input type="date" className="md:w-44" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button variant={onlyImportant ? "default" : "outline"} onClick={() => setOnlyImportant(!onlyImportant)}><Star /> Importantes</Button>
      </div>

      {list.length === 0 ? <Empty>Nenhuma nota encontrada.</Empty> : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {list.map((n) => (
            <article key={n.id} className={cn("mb-4 break-inside-avoid rounded-xl border bg-card p-4 shadow-card animate-rise", n.pinned && "border-brass")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-1.5 text-xl font-semibold">
                    {n.important && <Star className="size-4 fill-brass text-brass" />}
                    {n.title || "Sem título"}
                  </h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {n.subjectId && subj[n.subjectId] ? <><Dot color={subj[n.subjectId]!.color} />{subj[n.subjectId]!.name}</> : "Geral"} · {format(parseISO(n.date), "dd/MM/yyyy")}
                  </p>
                </div>
                <Button size="icon" variant="ghost" aria-label={n.pinned ? "Desafixar" : "Fixar"} onClick={() => upsertNote({ ...n, pinned: !n.pinned, updatedAt: Date.now() })}>
                  {n.pinned ? <PinOff /> : <Pin />}
                </Button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{n.body}</p>
              <div className="mt-3 flex justify-end">
                <NoteDialog note={n}><Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button></NoteDialog>
                <ConfirmDelete title="Excluir nota?" onConfirm={() => removeNote(n.id)}>
                  <Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 /></Button>
                </ConfirmDelete>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteDialog({ note, children }: { note?: Note; children: ReactNode }) {
  const subjects = useApp((s) => s.subjects);
  const upsertNote = useApp((s) => s.upsertNote);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Note>({ id: "", title: "", body: "", date: ymd(new Date()), important: false, pinned: false, updatedAt: 0 });
  useEffect(() => {
    if (open) setF(note ?? { id: uid(), title: "", body: "", date: ymd(new Date()), important: false, pinned: false, updatedAt: Date.now() });
  }, [open, note]);
  const save = () => {
    if (!f.title.trim() && !f.body.trim()) {
      toast.error("Escreva um título ou texto.");
      return;
    }
    upsertNote({ ...f, updatedAt: Date.now() });
    toast.success("Nota salva.");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">{note ? "Editar nota" : "Nova nota"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2"><Label>Título</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Matéria</Label>
              <NativeSelect value={f.subjectId ?? ""} onChange={(e) => setF({ ...f, subjectId: e.target.value || undefined })}>
                <option value="">Nota geral</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-2"><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Texto</Label><Textarea rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2"><Checkbox checked={f.important} onCheckedChange={(v) => setF({ ...f, important: !!v })} /> Importante</label>
            <label className="flex items-center gap-2"><Checkbox checked={f.pinned} onCheckedChange={(v) => setF({ ...f, pinned: !!v })} /> Fixar no topo</label>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
