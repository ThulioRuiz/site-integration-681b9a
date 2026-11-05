import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/NativeSelect";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { useApp } from "@/lib/store";
import { findSubjectByName, findTopicByName, isSubjectVisible, makeQSubject, missingDefaultSubjects } from "@/lib/qbank";
import { EXAMS, type QSubject, type QSubjectVisibility, type QTopic } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTaxonomy } from "./shared";

const VIS_LABEL: Record<QSubjectVisibility, string> = {
  auto: "Automático (pelo concurso)",
  on: "Mostrar sempre",
  off: "Ocultar",
};

export function OrganizeTab() {
  const tax = useTaxonomy();
  const exam = useApp((s) => s.profile?.exam);
  const { upsertQSubject, restoreQSubjects } = useApp.getState();
  const [name, setName] = useState("");
  const missing = missingDefaultSubjects(tax);

  const restore = (names: string[]) => {
    restoreQSubjects(names);
    toast.success(names.length === 1 ? `${names[0]} voltou com os tópicos originais.` : "Matérias restauradas com os tópicos originais.");
  };
  const [open, setOpen] = useState<string | null>(null);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (findSubjectByName(tax, n)) return void toast.error("Já existe uma matéria com esse nome.");
    const s = makeQSubject(n);
    upsertQSubject(s);
    setName("");
    setOpen(s.id);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A lista começa com as matérias e tópicos mais comuns. Ajuste ao seu programa: renomeie, oculte, reordene e crie os seus.
        Em "Automático", a matéria aparece só se for do seu concurso ({exam ?? "defina no perfil"}).
      </p>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Nova matéria (ex.: Desenho técnico)" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }} aria-label="Nome da nova matéria" />
        <Button onClick={add} disabled={!name.trim()}><Plus /> Criar matéria</Button>
      </div>
      {missing.length > 0 && (
        <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-sm">
          <p className="font-medium">Matérias da lista inicial que não estão aqui</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Restaurar traz a matéria de volta com todos os tópicos originais. Questões apagadas junto com ela só voltam por um backup (Configurações).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {missing.map((m) => (
              <Button key={m} size="sm" variant="outline" onClick={() => restore([m])}><RotateCcw /> Restaurar {m}</Button>
            ))}
            {missing.length > 1 && <Button size="sm" variant="ghost" onClick={() => restore(missing)}>Restaurar todas</Button>}
          </div>
        </div>
      )}
      <ul className="space-y-2">
        {tax.subjects.map((s, i) => (
          <SubjectRow key={s.id} s={s} first={i === 0} last={i === tax.subjects.length - 1}
            visible={isSubjectVisible(s, exam)} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />
        ))}
      </ul>
    </div>
  );
}

function SubjectRow({ s, first, last, visible, open, onToggle }: { s: QSubject; first: boolean; last: boolean; visible: boolean; open: boolean; onToggle: () => void }) {
  const bank = useApp((st) => st.questionBank);
  const { upsertQSubject, moveQSubject, removeQSubject, addQTopic, removeQTopic } = useApp.getState();
  const [topicName, setTopicName] = useState("");
  const count = bank.filter((q) => q.subjectId === s.id).length;

  const setTopic = (t: QTopic) => upsertQSubject({ ...s, topics: s.topics.map((x) => (x.id === t.id ? t : x)) });
  const moveTopic = (i: number, dir: -1 | 1) => {
    const list = [...s.topics];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    upsertQSubject({ ...s, topics: list });
  };
  const addTopic = () => {
    const n = topicName.trim();
    if (!n) return;
    if (findTopicByName(s, n)) return void toast.error("Esse tópico já existe nesta matéria.");
    addQTopic(s.id, n);
    setTopicName("");
  };

  return (
    <li className={cn("rounded-xl border bg-card", !visible && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <Button size="icon" variant="ghost" onClick={onToggle} aria-label={open ? "Fechar tópicos" : "Abrir tópicos"} aria-expanded={open}>
          {open ? <ChevronDown /> : <ChevronRight />}
        </Button>
        <Input className="h-8 min-w-40 flex-1 font-semibold" value={s.name} aria-label="Nome da matéria"
          onChange={(e) => upsertQSubject({ ...s, name: e.target.value })}
          onBlur={(e) => { if (!e.target.value.trim()) upsertQSubject({ ...s, name: "Sem nome" }); }} />
        <span className="text-xs text-muted-foreground">
          {s.topics.length} tópicos · {count} questões{s.exams.length > 0 && ` · ${s.exams.join(", ")}`}
        </span>
        <NativeSelect className="h-8 w-auto" value={s.visibility} aria-label="Visibilidade" onChange={(e) => upsertQSubject({ ...s, visibility: e.target.value as QSubjectVisibility })}>
          {(Object.keys(VIS_LABEL) as QSubjectVisibility[]).map((v) => <option key={v} value={v}>{VIS_LABEL[v]}</option>)}
        </NativeSelect>
        <Button size="icon" variant="ghost" disabled={first} onClick={() => moveQSubject(s.id, -1)} aria-label="Subir matéria"><ArrowUp /></Button>
        <Button size="icon" variant="ghost" disabled={last} onClick={() => moveQSubject(s.id, 1)} aria-label="Descer matéria"><ArrowDown /></Button>
        <ConfirmDelete title={`Excluir ${s.name}?`} description={count ? `A matéria, seus tópicos e ${count} questões (com as tentativas) serão apagados. Para só esconder, use "Ocultar".` : "A matéria e seus tópicos serão apagados."}
          onConfirm={() => removeQSubject(s.id)}>
          <Button size="icon" variant="ghost" aria-label="Excluir matéria"><Trash2 /></Button>
        </ConfirmDelete>
      </div>
      {open && (
        <div className="border-t p-3">
          <ul className="space-y-1.5">
            {s.topics.map((t, i) => {
              const n = bank.filter((q) => q.topicId === t.id).length;
              return (
                <li key={t.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg p-1.5", t.hidden && "opacity-60")}>
                  <Input className="h-8 min-w-48 flex-1" value={t.name} aria-label="Nome do tópico"
                    onChange={(e) => setTopic({ ...t, name: e.target.value })}
                    onBlur={(e) => { if (!e.target.value.trim()) setTopic({ ...t, name: "Sem nome" }); }} />
                  <span className="tabular w-10 text-xs text-muted-foreground" title="Questões">{n} q</span>
                  <div className="flex flex-wrap gap-1" aria-label="Concursos em que costuma aparecer">
                    {EXAMS.map((ex) => {
                      const on = t.exams.includes(ex);
                      return (
                        <button key={ex} type="button" aria-pressed={on} title="Costuma aparecer neste concurso"
                          onClick={() => setTopic({ ...t, exams: on ? t.exams.filter((x) => x !== ex) : [...t.exams, ex] })}
                          className={cn("rounded border px-1.5 py-0.5 text-[11px]", on ? "border-primary bg-primary/15 font-semibold" : "text-muted-foreground")}>
                          {ex}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-1.5 text-xs" title="Não consta no meu programa">
                    <Checkbox checked={t.skip} onCheckedChange={(v) => setTopic({ ...t, skip: !!v })} /> Fora do programa
                  </label>
                  <Button size="icon" variant="ghost" onClick={() => setTopic({ ...t, hidden: !t.hidden })} aria-label={t.hidden ? "Mostrar tópico" : "Ocultar tópico"} title={t.hidden ? "Mostrar" : "Ocultar"}>
                    {t.hidden ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => moveTopic(i, -1)} aria-label="Subir tópico"><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" disabled={i === s.topics.length - 1} onClick={() => moveTopic(i, 1)} aria-label="Descer tópico"><ArrowDown /></Button>
                  <ConfirmDelete title={`Excluir "${t.name}"?`} description={n ? `${n} questões deste tópico (com as tentativas) também serão apagadas. Para só esconder, use o olho.` : "O tópico será removido."}
                    onConfirm={() => removeQTopic(s.id, t.id)}>
                    <Button size="icon" variant="ghost" aria-label="Excluir tópico"><Trash2 /></Button>
                  </ConfirmDelete>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input className="h-8 max-w-xs" placeholder="Novo tópico" value={topicName} onChange={(e) => setTopicName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addTopic(); }} aria-label="Nome do novo tópico" />
            <Button size="sm" variant="outline" onClick={addTopic} disabled={!topicName.trim()}><Plus /> Adicionar tópico</Button>
          </div>
        </div>
      )}
    </li>
  );
}
