import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Ban, Brain, ChevronRight, ListPlus, ListTree, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Bar, Dot, Empty, PageHeader, Panel } from "@/components/kit";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { pickColor, SUBJECT_COLORS, uid, useActiveCycle, useApp, useReviewSettings } from "@/lib/store";
import { describeSchedule, findByTopic, fmtRelativeDue } from "@/lib/review";
import { cycleReport, fmtHours, minutesBy, ymd } from "@/lib/calc";
import { DIFFICULTY_LABEL } from "@/lib/labels";
import type { Subject, Topic, TopicStatus } from "@/lib/types";
import { aggregateStatus, makeTopic, mapTopic, nextStatus, parseTopicLines, topicProgress, TOPIC_STATUS_LABEL } from "@/lib/topics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/materias")({
  head: () => ({
    meta: [
      { title: "Matérias e tópicos — Quartel de Estudos" },
      { name: "description", content: "Matérias com dificuldade, peso, tópicos e subtópicos do programa e progresso de cada uma." },
      { property: "og:title", content: "Matérias — Quartel de Estudos" },
      { property: "og:description", content: "Matérias com dificuldade, peso e progresso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MateriasPage,
});

function MateriasPage() {
  const subjects = useApp((s) => s.subjects);
  const sessions = useApp((s) => s.sessions);
  const meta = useApp((s) => s.dayMeta);
  const { upsertSubject, removeSubject } = useApp.getState();
  const cycle = useActiveCycle();
  const [showArchived, setShowArchived] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const total = useMemo(() => minutesBy(sessions, (s) => s.subjectId), [sessions]);
  const report = useMemo(
    () => (cycle ? cycleReport(cycle, subjects, sessions, meta, ymd(new Date())) : null),
    [cycle, subjects, sessions, meta],
  );
  const list = subjects.filter((s) => s.archived === showArchived);
  const overall = useMemo(() => {
    const ps = subjects.filter((s) => !s.archived).map((s) => topicProgress(s.topics));
    const done = ps.reduce((a, p) => a + p.done, 0);
    const all = ps.reduce((a, p) => a + p.total, 0);
    return { done, all, pct: all ? (done / all) * 100 : 0 };
  }, [subjects]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Arsenal" title="Matérias">
        <Button variant="outline" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? "Ver ativas" : `Arquivadas (${subjects.filter((s) => s.archived).length})`}
        </Button>
        <SubjectDialog>
          <Button><Plus /> Adicionar matéria</Button>
        </SubjectDialog>
      </PageHeader>

      <Panel className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-muted-foreground">Programa coberto</p>
            <p className="tabular text-2xl font-semibold">
              {overall.done} <span className="text-base font-normal text-muted-foreground">de {overall.all} tópicos estudados</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {TOPIC_STATUS_LABEL.map((l, i) => (
              <span key={l} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold", STATUS_CLS[i])}>
                <i className="size-1.5 rounded-full bg-current" /> {l}
              </span>
            ))}
          </div>
        </div>
        <Bar className="mt-3" value={overall.pct} />
        <p className="mt-2 text-xs text-muted-foreground">
          Toque no estado para avançar: não visto → estudando → estudado → revisado. Divida qualquer tópico em subtópicos; o
          progresso conta os subtópicos. <Ban className="inline size-3" /> tira o item das contas (fora do programa).
          Ao marcar "estudado", a revisão espaçada é agendada sozinha; "revisado" é marcado pela própria revisão.
        </p>
      </Panel>

      {list.length === 0 ? (
        <Empty>{showArchived ? "Nenhuma matéria arquivada." : "Nenhuma matéria. Adicione a primeira."}</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const row = report?.rows.find((r) => r.subject.id === s.id);
            const studiedAll = (total[s.id] ?? 0) / 60;
            const goalPct = s.hourGoal ? (studiedAll / s.hourGoal) * 100 : row?.pct ?? 0;
            const tp = topicProgress(s.topics);
            const isOpen = open === s.id;
            return (
              <Panel key={s.id} className={cn("relative overflow-hidden", isOpen && "sm:col-span-2 lg:col-span-3")}>
                <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: s.color }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold uppercase">{s.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {DIFFICULTY_LABEL[s.difficulty]} · peso <b className="tabular">{s.multiplier}</b>
                    </p>
                  </div>
                  <div className="flex">
                    <SubjectDialog subject={s}>
                      <Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button>
                    </SubjectDialog>
                    <Button size="icon" variant="ghost" aria-label={s.archived ? "Desarquivar" : "Arquivar"}
                      onClick={() => { upsertSubject({ ...s, archived: !s.archived }); toast(s.archived ? "Matéria desarquivada." : "Matéria arquivada."); }}>
                      {s.archived ? <ArchiveRestore /> : <Archive />}
                    </Button>
                    <ConfirmDelete title={`Remover ${s.name}?`} description="A matéria sai dos ciclos. Os registros de estudo continuam no histórico." confirmLabel="Remover" onConfirm={() => removeSubject(s.id)}>
                      <Button size="icon" variant="ghost" aria-label="Remover"><Trash2 /></Button>
                    </ConfirmDelete>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                  <Mini label="Estudadas" value={fmtHours(studiedAll)} />
                  <Mini label="Prev./semana" value={row ? fmtHours(row.weekly) : "—"} />
                  <Mini label="Faltam no ciclo" value={row ? fmtHours(row.remaining) : "—"} />
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>{s.hourGoal ? `Meta da matéria: ${fmtHours(s.hourGoal)}` : row ? "Progresso no ciclo ativo" : "Fora do ciclo ativo"}</span>
                      <span className="tabular">{Math.round(goalPct)}%</span>
                    </div>
                    <Bar value={goalPct} color={s.color} />
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Tópicos estudados</span>
                      <span className="tabular">{tp.done}/{tp.total}</span>
                    </div>
                    <Bar value={tp.pct} color="var(--status-goal)" />
                  </div>
                </div>
                {s.notes?.trim() && (
                  <div className="mt-3 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Observações</p>
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground/85">{s.notes}</p>
                  </div>
                )}
                <Button variant={isOpen ? "secondary" : "outline"} size="sm" className="mt-4 w-full" aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : s.id)}>
                  <ListTree /> {isOpen ? "Fechar tópicos" : `Tópicos e subtópicos (${s.topics?.length ?? 0})`}
                </Button>
                {isOpen && <TopicEditor subject={s} />}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

const STATUS_CLS = [
  "border-border bg-muted/60 text-muted-foreground",
  "border-warning/40 bg-warning/10 text-warning",
  "border-success/40 bg-success/10 text-success",
  "border-success bg-success text-primary-foreground",
] as const;

function StatusPill({ status, onClick, label }: { status: TopicStatus; onClick?: (() => void) | undefined; label?: string | undefined }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick}
      title={onClick ? "Avançar estado" : "Calculado pelos subtópicos"}
      className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:brightness-95 disabled:cursor-default", STATUS_CLS[status])}>
      <i className="size-1.5 rounded-full bg-current" />
      {label ?? TOPIC_STATUS_LABEL[status]}
    </button>
  );
}

function TopicEditor({ subject }: { subject: Subject }) {
  const upsertSubject = useApp((s) => s.upsertSubject);
  const scheduleReviews = useApp((s) => s.scheduleReviews);
  const settings = useReviewSettings();
  const topics = subject.topics ?? [];
  const [text, setText] = useState("");
  const save = (next: Topic[]) => upsertSubject({ ...subject, topics: next });
  const update = (id: string, fn: (t: Topic) => Topic | null) => {
    let became: Topic | null = null;
    const next = mapTopic(topics, id, (t) => {
      const r = fn(t);
      if (r && t.status < 2 && r.status === 2) became = r;
      return r;
    });
    save(next);
    // tópico acabou de virar "estudado": agenda a revisão de 24h e as seguintes
    if (became && settings.autoFromTopics) {
      const b = became as Topic;
      const created = scheduleReviews([{ subjectId: subject.id, topicId: b.id, title: b.title, studiedOn: ymd(new Date()), source: "topico" }]);
      if (created.length)
        toast.success(`Revisões de “${b.title}” agendadas.`, {
          description: settings.method === "fixo" ? `Revisões ${describeSchedule(settings.schedule)}.` : "Primeira revisão amanhã; as seguintes conforme você lembrar.",
          action: { label: "Ver fila", onClick: () => { window.location.href = "/revisoes"; } },
        });
    }
  };

  const add = () => {
    const parsed = parseTopicLines(text);
    if (!parsed.length) {
      toast.error("Escreva pelo menos um tópico.");
      return;
    }
    save([...topics, ...parsed]);
    setText("");
    toast.success(`${parsed.length} tópico(s) adicionado(s).`);
  };

  return (
    <div className="mt-5 grid gap-5 border-t pt-5 lg:grid-cols-[1.6fr_1fr]">
      <div className="min-w-0">
        {subject.material && (
          <p className="mb-3 rounded-lg bg-muted/60 p-3 text-sm"><b>Onde estudar:</b> {subject.material}</p>
        )}
        {topics.length === 0 ? (
          <Empty>Sem tópicos ainda. Adicione ao lado — um por linha.</Empty>
        ) : (
          <ul className="divide-y rounded-xl border">
            {topics.map((t) => (
              <TopicRow key={t.id} topic={t} update={update} />
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`tnew-${subject.id}`}>Adicionar tópicos</Label>
        <Textarea id={`tnew-${subject.id}`} rows={7} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={"Um tópico por linha.\nComece com “-” para criar subtópico:\n\nCinemática\n- MRU\n- MRUV\nDinâmica"} />
        <Button size="sm" onClick={add}><Plus /> Adicionar</Button>
        <p className="text-xs text-muted-foreground">Dica: cole o edital inteiro. Linhas com “-” ou recuo viram subtópicos do tópico acima.</p>
      </div>
    </div>
  );
}

function TopicRow({ topic, update, depth = 0 }: { topic: Topic; update: (id: string, fn: (t: Topic) => Topic | null) => void; depth?: number }) {
  const review = useApp((s) => findByTopic(s.reviews, topic.id));
  const today = ymd(new Date());
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(topic.title);
  const [adding, setAdding] = useState(false);
  const [sub, setSub] = useState("");
  const [expanded, setExpanded] = useState(true);
  const hasChildren = topic.children.length > 0;
  const status = hasChildren ? aggregateStatus(topic) : topic.status;
  const tp = hasChildren ? topicProgress(topic.children) : null;

  const addSub = () => {
    const names = sub.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!names.length) return;
    update(topic.id, (t) => ({ ...t, children: [...t.children, ...names.map((n) => makeTopic(n))] }));
    setSub("");
    setAdding(false);
    setExpanded(true);
  };

  return (
    <li className={cn(depth > 0 && "border-l-2 border-dashed border-border")}>
      <div className={cn("flex flex-wrap items-center gap-2 p-2.5", depth > 0 && "pl-4")}>
        {hasChildren ? (
          <button type="button" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Recolher" : "Expandir"} className="text-muted-foreground hover:text-foreground">
            <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <div className={cn("min-w-0 flex-1", topic.skip && "line-through opacity-50")}>
          {editing ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) update(topic.id, (t) => ({ ...t, title: title.trim() })); setEditing(false); }}>
              <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
              <Button size="sm" type="submit">OK</Button>
            </form>
          ) : (
            <p className={cn("text-sm", depth === 0 && "font-medium")}>
              {topic.title}
              {tp && <span className="tabular ml-2 text-xs text-muted-foreground">{tp.done}/{tp.total}</span>}
              {review && review.status === "ativa" && (
                <Link to="/revisoes" className={cn("ml-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold", review.due <= today ? "bg-status-review/25 text-foreground" : "bg-muted text-muted-foreground")} title="Próxima revisão">
                  <Brain className="size-3" /> {review.due <= today ? "revisar hoje" : `revisão ${fmtRelativeDue(review, today)}`}
                </Link>
              )}
            </p>
          )}
        </div>
        <StatusPill status={status} onClick={hasChildren ? undefined : () => update(topic.id, (t) => ({ ...t, status: nextStatus(t.status) }))} />
        <div className="flex">
          {depth === 0 && (
            <Button size="icon" variant="ghost" className="size-8" aria-label="Adicionar subtópico" title="Dividir em subtópicos" onClick={() => setAdding(!adding)}>
              <ListPlus />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="size-8" aria-label="Renomear" onClick={() => { setTitle(topic.title); setEditing(!editing); }}>
            <Pencil />
          </Button>
          <Button size="icon" variant="ghost" className={cn("size-8", topic.skip && "text-destructive")} aria-pressed={topic.skip}
            aria-label="Fora do programa" title="Fora do programa" onClick={() => update(topic.id, (t) => ({ ...t, skip: !t.skip }))}>
            <Ban />
          </Button>
          <ConfirmDelete title={`Remover “${topic.title}”?`} description={hasChildren ? "Os subtópicos também serão removidos." : undefined} confirmLabel="Remover" onConfirm={() => update(topic.id, () => null)}>
            <Button size="icon" variant="ghost" className="size-8" aria-label="Remover tópico"><Trash2 /></Button>
          </ConfirmDelete>
        </div>
      </div>
      {adding && (
        <div className="flex gap-2 px-2.5 pb-2.5 pl-8">
          <Textarea rows={2} autoFocus value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Subtópicos, um por linha" className="min-h-0 text-sm" />
          <Button size="sm" onClick={addSub}>Adicionar</Button>
        </div>
      )}
      {hasChildren && expanded && (
        <ul className="ml-6 pb-1">
          {topic.children.map((c) => (
            <TopicRow key={c.id} topic={c} update={update} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tabular font-semibold">{value}</p>
    </div>
  );
}

function SubjectDialog({ subject, children }: { subject?: Subject; children: ReactNode }) {
  const subjects = useApp((s) => s.subjects);
  const cycles = useApp((s) => s.cycles);
  const { upsertSubject, upsertCycle } = useApp.getState();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Subject>({ id: "", name: "", difficulty: 1, multiplier: 1, color: pickColor(0), notes: "", archived: false });
  const [inCycles, setInCycles] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const s = subject ?? { id: uid(), name: "", difficulty: 1 as const, multiplier: 1, color: pickColor(subjects.length), notes: "", archived: false, topics: [] };
    setF(s);
    setInCycles(cycles.filter((c) => c.subjectIds.includes(s.id)).map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = () => {
    if (!f.name.trim()) {
      toast.error("Informe o nome da matéria.");
      return;
    }
    upsertSubject({ ...f, name: f.name.trim() });
    for (const c of cycles) {
      const has = c.subjectIds.includes(f.id);
      const want = inCycles.includes(c.id);
      if (has !== want) upsertCycle({ ...c, subjectIds: want ? [...c.subjectIds, f.id] : c.subjectIds.filter((x) => x !== f.id) });
    }
    toast.success("Matéria salva.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">{subject ? "Editar matéria" : "Nova matéria"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Dificuldade</Label>
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((d) => (
                <Button key={d} type="button" variant={f.difficulty === d ? "default" : "outline"} onClick={() => setF({ ...f, difficulty: d, multiplier: d })}>
                  {DIFFICULTY_LABEL[d]}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Multiplicador (peso)</Label>
              <Input type="number" min={0} step="0.5" value={f.multiplier} onChange={(e) => setF({ ...f, multiplier: Math.max(0, Number(e.target.value)) })} />
            </div>
            <div className="space-y-2">
              <Label>Meta de horas (opcional)</Label>
              <Input type="number" min={0} value={f.hourGoal ?? ""} onChange={(e) => setF({ ...f, hourGoal: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {SUBJECT_COLORS.map((c) => (
                <button key={c} type="button" aria-label="Cor" onClick={() => setF({ ...f, color: c })}
                  className={cn("size-8 rounded-full border-2", f.color === c ? "border-foreground" : "border-transparent")} style={{ background: c }} />
              ))}
            </div>
          </div>
          {cycles.length > 0 && (
            <div className="space-y-2">
              <Label>Ciclos</Label>
              <div className="flex flex-wrap gap-3">
                {cycles.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={inCycles.includes(c.id)} onCheckedChange={(v) => setInCycles(v ? [...inCycles, c.id] : inCycles.filter((x) => x !== c.id))} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Onde estudar (materiais)</Label>
            <Input value={f.material ?? ""} placeholder="Apostila, curso, livro…" onChange={(e) => setF({ ...f, material: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={5} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Dot color={f.color} /> Prévia da cor</p>
        </div>
        <DialogFooter>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
