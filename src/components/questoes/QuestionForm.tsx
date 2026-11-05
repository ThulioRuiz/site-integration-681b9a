import { useEffect, useState, type ReactNode } from "react";
import { ClipboardPaste, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/NativeSelect";
import { uid, useApp } from "@/lib/store";
import { dupKey, LETTERS, LEVEL_INFO, LEVELS, makeQTopic, parsePastedQuestion } from "@/lib/qbank";
import type { BankQuestion, QLevel } from "@/lib/types";
import { LevelHelp, useExamOptions, useShownSubjects, useTaxonomy } from "./shared";

export interface FormDefaults {
  exam?: string | undefined;
  subjectId?: string | undefined;
  topicId?: string | undefined;
  level?: QLevel | undefined;
}

const blank = (d: FormDefaults, fallbackExam: string, firstSubject: string | undefined): BankQuestion => ({
  id: uid(),
  exam: d.exam || fallbackExam,
  subjectId: d.subjectId || firstSubject || "",
  topicId: d.topicId || "",
  level: d.level ?? 1,
  source: "",
  statement: "",
  options: [],
  answer: "",
  resolution: "",
  tags: [],
  createdAt: Date.now(),
  attempts: [],
});

export function QuestionForm({
  initial,
  defaults = {},
  onSaved,
}: {
  initial?: BankQuestion | undefined;
  defaults?: FormDefaults;
  onSaved?: () => void;
}) {
  const profileExam = useApp((s) => s.profile?.exam) ?? "Geral";
  const bank = useApp((s) => s.questionBank);
  const tax = useTaxonomy();
  const shown = useShownSubjects();
  const exams = useExamOptions();
  const { upsertQuestion, upsertQSubject } = useApp.getState();
  const [f, setF] = useState<BankQuestion>(() => initial ?? blank(defaults, profileExam, shown[0]?.id));
  const [tags, setTags] = useState(() => (initial?.tags ?? []).join(", "));
  const [paste, setPaste] = useState("");
  const [newTopic, setNewTopic] = useState("");

  const subject = tax.subjects.find((s) => s.id === f.subjectId);
  const subjectOptions = subject && !shown.some((s) => s.id === subject.id) ? [...shown, subject] : shown;
  const topics = subject?.topics.filter((t) => !t.hidden || t.id === f.topicId) ?? [];
  const options = [...f.options];
  while (options.length < 5) options.push("");

  const applyPaste = () => {
    const p = parsePastedQuestion(paste);
    if (!p.statement && !p.options.length) return;
    setF({ ...f, statement: p.statement, options: p.options });
    setPaste("");
    toast.success(p.options.length ? `Enunciado e ${p.options.length} alternativas separados.` : "Texto colado como enunciado (nenhuma alternativa encontrada).");
  };

  const createTopic = () => {
    const name = newTopic.trim();
    if (!subject || !name) return;
    const t = makeQTopic(name);
    upsertQSubject({ ...subject, topics: [...subject.topics, t] });
    setF({ ...f, topicId: t.id });
    setNewTopic("");
  };

  const save = () => {
    const statement = f.statement.trim();
    if (!f.subjectId || !f.topicId) return toast.error("Escolha a matéria e o tópico.");
    if (!statement) return toast.error("Escreva o enunciado.");
    const key = dupKey(f.source, statement);
    if (bank.some((q) => q.id !== f.id && dupKey(q.source, q.statement) === key))
      return toast.error("Já existe uma questão com a mesma fonte e enunciado.");
    const opts = f.options.map((o) => o.trim());
    while (opts.length && !opts[opts.length - 1]) opts.pop();
    const answer = f.answer.trim();
    upsertQuestion({
      ...f,
      exam: f.exam.trim() || "Geral",
      source: f.source.trim(),
      statement,
      options: opts,
      answer: /^[a-e]$/i.test(answer) ? answer.toUpperCase() : answer,
      resolution: f.resolution.trim(),
      tags: tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean),
    });
    toast.success(initial ? "Questão atualizada." : "Questão cadastrada.");
    if (!initial) {
      // Mantém concurso, matéria, tópico, nível e fonte para cadastrar a próxima mais rápido.
      setF({ ...blank({ exam: f.exam, subjectId: f.subjectId, topicId: f.topicId, level: f.level }, profileExam, undefined), source: f.source });
      setTags(tags);
    }
    onSaved?.();
    return undefined;
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="q-exam">Concurso</Label>
          <Input id="q-exam" list="q-exam-list" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })} placeholder="EFOMM, ITA, Geral…" />
          <datalist id="q-exam-list">{exams.map((e) => <option key={e} value={e} />)}</datalist>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-source">Fonte</Label>
          <Input id="q-source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="Ex.: EFOMM 2023, Q12" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="q-subject">Matéria</Label>
          <NativeSelect id="q-subject" value={f.subjectId} onChange={(e) => setF({ ...f, subjectId: e.target.value, topicId: "" })}>
            <option value="">Escolha…</option>
            {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-topic">Tópico</Label>
          <NativeSelect id="q-topic" value={f.topicId} disabled={!subject} onChange={(e) => setF({ ...f, topicId: e.target.value })}>
            <option value="">Escolha…</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
          {subject && (
            <div className="flex gap-2">
              <Input aria-label="Novo tópico" className="h-8 text-xs" placeholder="Ou crie um tópico novo" value={newTopic} onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTopic(); } }} />
              <Button type="button" size="sm" variant="outline" disabled={!newTopic.trim()} onClick={createTopic}><Plus /> Criar</Button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Nível</Label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Nível">
          {LEVELS.map((l) => (
            <Button key={l} type="button" size="sm" role="radio" aria-checked={f.level === l} variant={f.level === l ? "default" : "outline"} onClick={() => setF({ ...f, level: l })}>
              Nível {l} · {LEVEL_INFO[l].name}
            </Button>
          ))}
        </div>
        <LevelHelp level={f.level} />
      </div>

      <details className="rounded-lg border bg-muted/30 p-3 text-sm">
        <summary className="cursor-pointer font-medium"><ClipboardPaste className="mr-1 inline size-4" /> Colar questão inteira</summary>
        <p className="mt-2 text-xs text-muted-foreground">Cole o enunciado com as alternativas ("A) …", "(B) …", "c. …"). O texto é separado automaticamente.</p>
        <Textarea className="mt-2" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Enunciado…\nA) …\nB) …"} />
        <Button type="button" size="sm" className="mt-2" variant="outline" disabled={!paste.trim()} onClick={applyPaste}>Separar enunciado e alternativas</Button>
      </details>

      <div className="space-y-2">
        <Label htmlFor="q-statement">Enunciado</Label>
        <Textarea id="q-statement" rows={5} value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Alternativas <span className="font-normal text-muted-foreground">(opcional)</span></Label>
        {LETTERS.map((L, i) => (
          <div key={L} className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold">{L}</span>
            <Input aria-label={`Alternativa ${L}`} value={options[i] ?? ""} onChange={(e) => {
              const next = [...options];
              next[i] = e.target.value;
              setF({ ...f, options: next });
            }} />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-2">
          <Label htmlFor="q-answer">Gabarito</Label>
          <Input id="q-answer" value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} placeholder="A–E ou resposta" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="q-tags">Tags</Label>
          <Input id="q-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Separe por vírgula" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="q-resolution">Resolução <span className="font-normal text-muted-foreground">(opcional)</span></Label>
        <Textarea id="q-resolution" rows={3} value={f.resolution} onChange={(e) => setF({ ...f, resolution: e.target.value })} />
      </div>
      <div className="flex justify-end"><Button onClick={save}>{initial ? "Salvar alterações" : "Cadastrar questão"}</Button></div>
    </div>
  );
}

export function QuestionDialog({ question, children }: { question: BankQuestion; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (open) setKey((k) => k + 1);
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-display text-2xl uppercase">Editar questão</DialogTitle></DialogHeader>
        <QuestionForm key={key} initial={question} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
