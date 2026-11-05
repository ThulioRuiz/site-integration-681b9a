import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/kit";
import { useApp } from "@/lib/store";
import { applyFilters, EMPTY_FILTERS, inErrorBook, normalizeText, type QFilters } from "@/lib/qbank";
import { BankTab } from "@/components/questoes/BankTab";
import { SolveTab } from "@/components/questoes/SolveTab";
import { CreateTab } from "@/components/questoes/CreateTab";
import { ErrorsTab } from "@/components/questoes/ErrorsTab";
import { PerformanceTab } from "@/components/questoes/PerformanceTab";
import { OrganizeTab } from "@/components/questoes/OrganizeTab";
import { FilterBar, type TabId } from "@/components/questoes/shared";

const TAB_IDS: TabId[] = ["banco", "resolver", "cadastrar", "caderno", "desempenho", "organizar"];

/** Permite abrir a aba já filtrada por matéria/tópico (ex.: a partir de uma revisão). */
export interface QuestoesSearch {
  aba?: TabId | undefined;
  materia?: string | undefined;
  topico?: string | undefined;
}

export const Route = createFileRoute("/questoes")({
  validateSearch: (raw: Record<string, unknown>): QuestoesSearch => ({
    aba: TAB_IDS.includes(raw["aba"] as TabId) ? (raw["aba"] as TabId) : undefined,
    materia: typeof raw["materia"] === "string" && raw["materia"] ? raw["materia"] : undefined,
    topico: typeof raw["topico"] === "string" && raw["topico"] ? raw["topico"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Questões — Quartel de Estudos" },
      { name: "description", content: "Banco de questões por matéria, tópico e nível, com resolução, caderno de erros e desempenho." },
      { property: "og:title", content: "Questões — Quartel de Estudos" },
      { property: "og:description", content: "Banco de questões organizado por matéria, tópico e nível." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuestoesPage,
});

const TABS: { id: TabId; label: string }[] = [
  { id: "banco", label: "Banco" },
  { id: "resolver", label: "Resolver" },
  { id: "cadastrar", label: "Cadastrar" },
  { id: "caderno", label: "Caderno de erros" },
  { id: "desempenho", label: "Desempenho" },
  { id: "organizar", label: "Organizar" },
];

function QuestoesPage() {
  const search = Route.useSearch();
  const taxonomy = useApp((s) => s.qTaxonomy);
  const bank = useApp((s) => s.questionBank);
  const ensureTaxonomy = useApp((s) => s.ensureTaxonomy);
  const [tab, setTab] = useState<TabId>(search.aba ?? "banco");
  const [filters, setFilters] = useState<QFilters>(EMPTY_FILTERS);
  const [appliedSearch, setAppliedSearch] = useState("");

  // Filtros vindos do endereço (matéria/tópico por nome), aplicados quando a taxonomia existir.
  useEffect(() => {
    const key = JSON.stringify(search);
    if (!taxonomy || appliedSearch === key) return;
    setAppliedSearch(key);
    if (!search.materia) return;
    const subj = taxonomy.subjects.find((s) => normalizeText(s.name) === normalizeText(search.materia!));
    if (!subj) return;
    const topic = search.topico ? subj.topics.find((t) => normalizeText(t.name) === normalizeText(search.topico!)) : undefined;
    setFilters({ ...EMPTY_FILTERS, subjectId: subj.id, topicId: topic?.id ?? "", status: search.aba === "caderno" ? "errada" : "" });
    setExplicitIds(null);
    if (search.aba) setTab(search.aba);
  }, [search, taxonomy, appliedSearch]);
  /** Lista fixa para o Resolver (ex.: vinda do caderno de erros). */
  const [explicitIds, setExplicitIds] = useState<string[] | null>(null);
  const [solveNonce, setSolveNonce] = useState(0);

  // Taxonomia carregada na primeira abertura; depois é do aluno.
  useEffect(() => {
    if (!taxonomy) ensureTaxonomy();
  }, [taxonomy, ensureTaxonomy]);

  const queue = useMemo(() => {
    if (explicitIds) {
      const m = new Map(bank.map((q) => [q.id, q]));
      return explicitIds.map((id) => m.get(id)).filter((q): q is NonNullable<typeof q> => !!q);
    }
    return applyFilters(bank, filters);
  }, [bank, filters, explicitIds]);
  const queueKey = `${solveNonce}|${explicitIds ? explicitIds.join(",") : JSON.stringify(filters)}|${queue.length === 0 ? 0 : 1}`;

  const errorCount = useMemo(() => bank.filter(inErrorBook).length, [bank]);

  const solve = (ids?: string[]) => {
    setExplicitIds(ids ?? null);
    setSolveNonce((n) => n + 1);
    setTab("resolver");
  };
  const changeFilters = (f: QFilters) => {
    setFilters(f);
    setExplicitIds(null);
  };

  if (!taxonomy) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Treinamento" title="Questões">
        <Button onClick={() => setTab("cadastrar")}><Plus /> Cadastrar questão</Button>
      </PageHeader>
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4">
          <TabsList className="w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
                {t.id === "caderno" && errorCount > 0 && <span className="tabular ml-1.5 rounded-full bg-destructive/15 px-1.5 text-[11px] text-destructive">{errorCount}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tab !== "cadastrar" && tab !== "organizar" && (
          <FilterBar filters={filters} onChange={changeFilters} hide={tab === "banco" && !filters.topicId ? ["level"] : []} />
        )}

        <TabsContent value="banco"><BankTab filters={filters} setFilters={changeFilters} go={setTab} solve={solve} /></TabsContent>
        <TabsContent value="resolver">
          <SolveTab queue={queue} queueKey={queueKey} explicit={!!explicitIds} onClearExplicit={() => setExplicitIds(null)} go={setTab}
            onGoLevel={(topicId, subjectId, level) => { changeFilters({ ...filters, subjectId, topicId, level: String(level) as QFilters["level"], status: "" }); setSolveNonce((n) => n + 1); }} />
        </TabsContent>
        <TabsContent value="cadastrar"><CreateTab filters={filters} /></TabsContent>
        <TabsContent value="caderno"><ErrorsTab filters={filters} solve={solve} go={setTab} /></TabsContent>
        <TabsContent value="desempenho"><PerformanceTab filters={filters} setFilters={changeFilters} go={setTab} /></TabsContent>
        <TabsContent value="organizar"><OrganizeTab /></TabsContent>
      </Tabs>
    </div>
  );
}
