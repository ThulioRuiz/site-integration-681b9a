import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Pencil, Play, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bar, Dot } from "@/components/kit";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { useApp } from "@/lib/store";
import { applyFilters, attemptStats, LEVEL_INFO, LEVELS, type QFilters } from "@/lib/qbank";
import type { BankQuestion, QLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QuestionDialog } from "./QuestionForm";
import { EmptyAction, LevelBadge, LevelHelp, pct, StatusBadge, useNames, useShownSubjects, useSubjectColor, useTaxonomy, type TabId } from "./shared";

interface Props {
  filters: QFilters;
  setFilters: (f: QFilters) => void;
  go: (tab: TabId) => void;
  solve: (ids?: string[]) => void;
}

export function BankTab({ filters, setFilters, go, solve }: Props) {
  const bank = useApp((s) => s.questionBank);
  if (!bank.length)
    return (
      <EmptyAction
        title="Seu banco de questões está vazio"
        actions={<>
          <Button onClick={() => go("cadastrar")}><Plus /> Cadastrar questão</Button>
          <Button variant="outline" onClick={() => go("cadastrar")}><Upload /> Importar em lote</Button>
        </>}
      >
        As questões são suas: cadastre uma a uma ou cole várias em JSON/CSV. Cada questão fica em matéria → tópico → nível
        (1 embasamento, 2 fixação, 3 desafio) para você treinar em ordem.
      </EmptyAction>
    );
  if (!filters.subjectId) return <SubjectGrid filters={filters} setFilters={setFilters} go={go} />;
  if (!filters.topicId) return <TopicList filters={filters} setFilters={setFilters} />;
  return <TopicLevels filters={filters} setFilters={setFilters} go={go} solve={solve} />;
}

function SubjectGrid({ filters, setFilters, go }: Omit<Props, "solve">) {
  const bank = useApp((s) => s.questionBank);
  const subjects = useShownSubjects();
  const color = useSubjectColor();
  const list = useMemo(() => applyFilters(bank, filters, { subjectId: true, topicId: true }), [bank, filters]);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => {
          const qs = list.filter((q) => q.subjectId === s.id);
          const st = attemptStats(qs);
          const progress = st.questions ? (st.done / st.questions) * 100 : 0;
          return (
            <button key={s.id} type="button" onClick={() => setFilters({ ...filters, subjectId: s.id, topicId: "" })}
              className="rounded-xl border bg-card p-4 text-left shadow-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold"><Dot color={color(s)} /> {s.name}</p>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="tabular">{st.questions}</span> {st.questions === 1 ? "questão" : "questões"} · <span className="tabular">{st.done}</span> feitas
                {st.attempts > 0 && <> · acerto <b className="tabular text-foreground">{pct(st.rate)}</b></>}
              </p>
              <Bar value={progress} className="mt-3" color={color(s)} />
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Mostrando as matérias do seu concurso. Para ver outras ou criar matérias próprias, use{" "}
        <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => go("organizar")}>Organizar</button>.
      </p>
    </>
  );
}

function TopicList({ filters, setFilters }: Pick<Props, "filters" | "setFilters">) {
  const bank = useApp((s) => s.questionBank);
  const tax = useTaxonomy();
  const subject = tax.subjects.find((s) => s.id === filters.subjectId);
  const list = useMemo(() => applyFilters(bank, filters, { topicId: true, level: true }), [bank, filters]);
  if (!subject) return null;
  const topics = [...subject.topics.filter((t) => !t.hidden && !t.skip), ...subject.topics.filter((t) => !t.hidden && t.skip)];
  return (
    <>
      <Crumbs items={[{ label: "Matérias", on: () => setFilters({ ...filters, subjectId: "", topicId: "", level: "" }) }, { label: subject.name }]} />
      {topics.length === 0 ? (
        <EmptyAction title="Esta matéria ainda não tem tópicos">Crie tópicos em Organizar ou direto no cadastro de questão.</EmptyAction>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {topics.map((t) => {
            const qs = list.filter((q) => q.topicId === t.id);
            const st = attemptStats(qs);
            return (
              <li key={t.id}>
                <button type="button" onClick={() => setFilters({ ...filters, topicId: t.id, level: filters.level || "1" })}
                  className={cn("flex w-full flex-wrap items-center gap-3 p-3 text-left text-sm hover:bg-accent", t.skip && "opacity-60")}>
                  <span className="min-w-0 flex-1 font-medium">
                    {t.name}
                    {t.skip && <span className="ml-2 text-xs font-normal text-muted-foreground">(fora do meu programa)</span>}
                  </span>
                  <span className="flex gap-1.5 text-xs text-muted-foreground">
                    {LEVELS.map((l) => <span key={l} className="tabular rounded bg-muted px-1.5 py-0.5">N{l}: {qs.filter((q) => q.level === l).length}</span>)}
                  </span>
                  <span className="tabular w-20 text-right text-xs">{st.attempts ? `acerto ${pct(st.rate)}` : "—"}</span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function TopicLevels({ filters, setFilters, go, solve }: Props) {
  const bank = useApp((s) => s.questionBank);
  const names = useNames();
  const base = useMemo(() => applyFilters(bank, filters, { level: true }), [bank, filters]);
  const level = (Number(filters.level) || 1) as QLevel;
  const subjectName = names.subjectName(filters.subjectId);
  return (
    <>
      <Crumbs items={[
        { label: "Matérias", on: () => setFilters({ ...filters, subjectId: "", topicId: "", level: "" }) },
        { label: subjectName, on: () => setFilters({ ...filters, topicId: "", level: "" }) },
        { label: names.topicName(filters.topicId) },
      ]} />
      <Tabs value={String(level)} onValueChange={(v) => setFilters({ ...filters, level: v as QFilters["level"] })}>
        <TabsList className="mb-3 h-auto flex-wrap">
          {LEVELS.map((l) => {
            const st = attemptStats(base.filter((q) => q.level === l));
            return (
              <TabsTrigger key={l} value={String(l)} className="flex-col gap-0 px-4 py-1.5 sm:flex-row sm:gap-2">
                <span>Nível {l}</span>
                <span className="tabular text-[11px] text-muted-foreground">{st.questions} q · {st.attempts ? pct(st.rate) : "—"}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {LEVELS.map((l) => {
          const qs = base.filter((q) => q.level === l);
          return (
            <TabsContent key={l} value={String(l)}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <LevelHelp level={l} />
                {qs.length > 0 && <Button onClick={() => solve()}><Play /> Resolver nível {l} ({qs.length})</Button>}
              </div>
              {qs.length === 0 ? (
                <EmptyAction title={`Nenhuma questão no Nível ${l} (${LEVEL_INFO[l].name.toLowerCase()})`}
                  actions={<Button onClick={() => go("cadastrar")}><Plus /> Cadastrar questão neste nível</Button>}>
                  {filters.status || filters.source || filters.exam ? "Nada aparece com os filtros atuais. Limpe os filtros ou cadastre uma questão." : "Cadastre ou importe questões deste tópico e nível."}
                </EmptyAction>
              ) : (
                <QuestionList list={qs} onSolve={(id) => solve([id, ...qs.map((q) => q.id).filter((x) => x !== id)])} />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </>
  );
}

export function QuestionList({ list, onSolve, extra }: { list: BankQuestion[]; onSolve: (id: string) => void; extra?: (q: BankQuestion) => React.ReactNode }) {
  const names = useNames();
  const removeQuestion = useApp((s) => s.removeQuestion);
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {list.map((q) => (
        <li key={q.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <LevelBadge level={q.level} />
              <StatusBadge q={q} />
              <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">{q.exam}</span>
              {q.source && <span>{q.source}</span>}
              <span>· {names.subjectName(q.subjectId)} › {names.topicName(q.topicId)}</span>
            </div>
            <p className="mt-1 line-clamp-2 whitespace-pre-line">{q.statement}</p>
            {extra?.(q)}
          </div>
          <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
            <Button size="sm" variant="outline" onClick={() => onSolve(q.id)}><Play /> Resolver</Button>
            <QuestionDialog question={q}><Button size="icon" variant="ghost" aria-label="Editar questão"><Pencil /></Button></QuestionDialog>
            <ConfirmDelete title="Excluir questão?" description="A questão e todas as tentativas registradas nela serão apagadas." onConfirm={() => removeQuestion(q.id)}>
              <Button size="icon" variant="ghost" aria-label="Excluir questão"><Trash2 /></Button>
            </ConfirmDelete>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Crumbs({ items }: { items: { label: string; on?: () => void }[] }) {
  return (
    <nav aria-label="Caminho" className="mb-3 flex flex-wrap items-center gap-1 text-sm">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 text-muted-foreground" />}
          {it.on ? (
            <button type="button" onClick={it.on} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              {i === 0 && <ChevronLeft className="size-3.5" />}{it.label}
            </button>
          ) : (
            <span className="font-semibold">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
