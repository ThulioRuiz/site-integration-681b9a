import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/NativeSelect";
import { pickColor, useApp } from "@/lib/store";
import { EXAMS, type BankQuestion, type QLevel, type QSubject, type QTaxonomy } from "@/lib/types";
import {
  EMPTY_FILTERS,
  LEVEL_INFO,
  LEVELS,
  normalizeText,
  questionStatus,
  visibleSubjects,
  type QFilters,
  type QStatus,
} from "@/lib/qbank";
import { cn } from "@/lib/utils";

export type TabId = "banco" | "resolver" | "cadastrar" | "caderno" | "desempenho" | "organizar";

const EMPTY_TAX: QTaxonomy = { subjects: [] };

export function useTaxonomy(): QTaxonomy {
  return useApp((s) => s.qTaxonomy) ?? EMPTY_TAX;
}

/** Matérias que aparecem nas telas: as do concurso do perfil, as ativadas e as que já têm questões. */
export function useShownSubjects(): QSubject[] {
  const tax = useTaxonomy();
  const exam = useApp((s) => s.profile?.exam);
  const bank = useApp((s) => s.questionBank);
  return useMemo(() => {
    const used = new Set(bank.map((q) => q.subjectId));
    const vis = new Set(visibleSubjects(tax, exam).map((s) => s.id));
    return tax.subjects.filter((s) => vis.has(s.id) || (used.has(s.id) && s.visibility !== "off"));
  }, [tax, exam, bank]);
}

/** Cor da matéria: a mesma das "Matérias" do aluno quando o nome bate. */
export function useSubjectColor() {
  const subjects = useApp((s) => s.subjects);
  const tax = useTaxonomy();
  return useMemo(() => {
    const byName = new Map(subjects.map((s) => [normalizeText(s.name), s.color]));
    const idx = new Map(tax.subjects.map((s, i) => [s.id, i]));
    return (s: QSubject) => byName.get(normalizeText(s.name)) ?? pickColor(idx.get(s.id) ?? 0);
  }, [subjects, tax]);
}

export function useNames() {
  const tax = useTaxonomy();
  return useMemo(() => {
    const subj = new Map(tax.subjects.map((s) => [s.id, s]));
    const topic = new Map(tax.subjects.flatMap((s) => s.topics.map((t) => [t.id, t] as const)));
    return {
      subject: (id: string) => subj.get(id),
      subjectName: (id: string) => subj.get(id)?.name ?? "Matéria removida",
      topicName: (id: string) => topic.get(id)?.name ?? "Tópico removido",
    };
  }, [tax]);
}

export function useExamOptions() {
  const bank = useApp((s) => s.questionBank);
  return useMemo(() => {
    const extra = [...new Set(bank.map((q) => q.exam))].filter((e) => e && !(EXAMS as string[]).includes(e) && e !== "Geral");
    return [...EXAMS, "Geral", ...extra.sort()];
  }, [bank]);
}

export const pct = (n: number) => `${Math.round(n)}%`;

export function LevelBadge({ level, className }: { level: QLevel; className?: string }) {
  return (
    <span
      title={LEVEL_INFO[level].help}
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        level === 1 && "bg-status-study/20 text-foreground",
        level === 2 && "bg-status-goal/25 text-foreground",
        level === 3 && "bg-status-commit/25 text-foreground",
        className,
      )}
    >
      N{level} · {LEVEL_INFO[level].name}
    </span>
  );
}

const STATUS_STYLE: Record<QStatus, { label: string; cls: string }> = {
  "nao-feita": { label: "Não feita", cls: "bg-muted text-muted-foreground" },
  certa: { label: "Certa", cls: "bg-success/15 text-success" },
  errada: { label: "Errada", cls: "bg-destructive/10 text-destructive" },
  branco: { label: "Em branco", cls: "bg-warning/20 text-foreground" },
};

export function StatusBadge({ q }: { q: BankQuestion }) {
  const st = STATUS_STYLE[questionStatus(q)];
  const review = q.attempts[q.attempts.length - 1]?.reviewLater;
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", st.cls)}>{st.label}</span>
      {review && <span className="rounded bg-status-review/20 px-1.5 py-0.5 text-[11px] font-semibold">Revisar</span>}
      {!!q.pending?.length && (
        <span className="rounded bg-warning/25 px-1.5 py-0.5 text-[11px] font-semibold" title={q.pending.join("\n")}>Pendência</span>
      )}
    </span>
  );
}

export function LevelHelp({ level }: { level: QLevel | undefined }) {
  if (!level) return <p className="text-xs text-muted-foreground">Escolha o nível de dificuldade da questão.</p>;
  return (
    <p className="text-xs text-muted-foreground">
      <b className="text-foreground">Nível {level}, {LEVEL_INFO[level].name.toLowerCase()}:</b> {LEVEL_INFO[level].help}
    </p>
  );
}

export function FilterBar({
  filters,
  onChange,
  hide = [],
}: {
  filters: QFilters;
  onChange: (f: QFilters) => void;
  hide?: (keyof QFilters)[];
}) {
  const subjects = useShownSubjects();
  const exams = useExamOptions();
  const topics = subjects.find((s) => s.id === filters.subjectId)?.topics.filter((t) => !t.hidden || t.id === filters.topicId) ?? [];
  const show = (k: keyof QFilters) => !hide.includes(k);
  const active = (Object.keys(filters) as (keyof QFilters)[]).some((k) => show(k) && filters[k]);
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {show("exam") && (
        <NativeSelect aria-label="Concurso" value={filters.exam} onChange={(e) => onChange({ ...filters, exam: e.target.value })}>
          <option value="">Todos os concursos</option>
          {exams.map((e) => <option key={e} value={e}>{e}</option>)}
        </NativeSelect>
      )}
      {show("subjectId") && (
        <NativeSelect aria-label="Matéria" value={filters.subjectId} onChange={(e) => onChange({ ...filters, subjectId: e.target.value, topicId: "" })}>
          <option value="">Todas as matérias</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </NativeSelect>
      )}
      {show("topicId") && (
        <NativeSelect aria-label="Tópico" value={filters.topicId} disabled={!filters.subjectId} onChange={(e) => onChange({ ...filters, topicId: e.target.value })}>
          <option value="">{filters.subjectId ? "Todos os tópicos" : "Tópico (escolha a matéria)"}</option>
          {topics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </NativeSelect>
      )}
      {show("level") && (
        <NativeSelect aria-label="Nível" value={filters.level} onChange={(e) => onChange({ ...filters, level: e.target.value as QFilters["level"] })}>
          <option value="">Todos os níveis</option>
          {LEVELS.map((l) => <option key={l} value={String(l)}>Nível {l} · {LEVEL_INFO[l].name}</option>)}
        </NativeSelect>
      )}
      {show("source") && (
        <Input aria-label="Fonte" placeholder="Fonte (ex.: EFOMM 2023)" value={filters.source} onChange={(e) => onChange({ ...filters, source: e.target.value })} />
      )}
      {show("status") && (
        <div className="flex gap-2">
          <NativeSelect aria-label="Situação" value={filters.status} onChange={(e) => onChange({ ...filters, status: e.target.value as QFilters["status"] })}>
            <option value="">Todas as situações</option>
            <option value="nao-feita">Não feita</option>
            <option value="certa">Certa</option>
            <option value="errada">Errada ou em branco</option>
            <option value="revisar">Marcada para revisar</option>
            <option value="pendencia">Com pendência</option>
          </NativeSelect>
          {active && (
            <Button size="icon" variant="ghost" aria-label="Limpar filtros" title="Limpar filtros"
              onClick={() => onChange(Object.fromEntries((Object.keys(filters) as (keyof QFilters)[]).map((k) => [k, show(k) ? EMPTY_FILTERS[k] : filters[k]])) as unknown as QFilters)}>
              <X />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Estado vazio com explicação e botão de ação. */
export function EmptyAction({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="grid-paper rounded-lg border border-dashed p-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">{children}</p>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
