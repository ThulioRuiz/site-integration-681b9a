import { useMemo, useRef, useState } from "react";
import { Copy, Download, FileCheck2, FileText, FileUp, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/kit";
import { useApp } from "@/lib/store";
import {
  applyFilters,
  attachPending,
  exportCSV,
  exportJSON,
  IMPORT_COLUMNS,
  parseImportText,
  pendingBySource,
  validateImport,
  type ImportReport,
  type ImportRow,
  type QFilters,
} from "@/lib/qbank";
import type { QLevel } from "@/lib/types";
import { QuestionForm } from "./QuestionForm";
import { useTaxonomy } from "./shared";

const CSV_EXAMPLE = `${IMPORT_COLUMNS.join(",")}
EFOMM,Matemática,Sequências (PA e PG),1,Lista própria 1,"Numa PA, a1 = 3 e r = 4. Qual é o 10º termo?",36,39,40,43,35,B,a10 = 3 + 9·4 = 39`;

export function CreateTab({ filters }: { filters: QFilters }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title="Nova questão">
        <QuestionForm defaults={{
          exam: filters.exam || undefined,
          subjectId: filters.subjectId || undefined,
          topicId: filters.topicId || undefined,
          level: filters.level ? (Number(filters.level) as QLevel) : undefined,
        }} />
      </Panel>
      <div className="space-y-6">
        <ImportPanel />
        <ExportPanel filters={filters} />
      </div>
    </div>
  );
}

interface ImportSource {
  name: string;
  text: string;
}

interface Analysis {
  report: ImportReport | null;
  pending: Map<string, string[]>;
  pendingRows: number;
  pendingMatched: number;
  errors: string[];
}

function ImportPanel() {
  const tax = useTaxonomy();
  const bank = useApp((s) => s.questionBank);
  const exam = useApp((s) => s.profile?.exam) ?? "Geral";
  const { addQuestions, setTaxonomy, applyPending } = useApp.getState();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<ImportSource[]>([]);
  const [reading, setReading] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const sources = (): ImportSource[] => [...files, ...(text.trim() ? [{ name: "Texto colado", text }] : [])];

  const analyze = (create = createMissing) => {
    const qRows: ImportRow[] = [];
    const pRows: ImportRow[] = [];
    const errors: string[] = [];
    for (const src of sources()) {
      const parsed = parseImportText(src.text);
      if (parsed.error) {
        errors.push(`${src.name}: ${parsed.error}`);
        continue;
      }
      // A linha 1 é o cabeçalho no CSV; a numeração segue a do arquivo.
      const offset = src.text.trimStart().startsWith("[") || src.text.trimStart().startsWith("{") ? 0 : 1;
      parsed.rows.forEach((r, i) => (parsed.kind === "pendencias" ? pRows : qRows).push({ ...r, __file: src.name, __line: String(i + 1 + offset) }));
    }
    const report = qRows.length ? validateImport(qRows, tax, bank, { createMissing: create, defaultExam: exam }) : null;
    const pending = pendingBySource(pRows);
    const pendingMatched = pending.size ? attachPending([...bank, ...(report?.questions ?? [])], pending).matched : 0;
    setAnalysis({ report, pending, pendingRows: pRows.length, pendingMatched, errors });
  };

  const pickFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setReading(true);
    try {
      const read = await Promise.all([...list].map(async (f) => ({ name: f.name, text: await f.text() })));
      setFiles((cur) => [...cur.filter((c) => !read.some((r) => r.name === c.name)), ...read]);
      setAnalysis(null);
    } catch {
      toast.error("Não consegui ler o arquivo.");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const reset = () => {
    setAnalysis(null);
    setText("");
    setFiles([]);
  };

  const confirm = () => {
    if (!analysis) return;
    const { report, pending } = analysis;
    const n = report?.questions.length ?? 0;
    if (report && n) {
      setTaxonomy(report.taxonomy);
      addQuestions(report.questions);
    }
    const p = pending.size ? applyPending(pending) : { matched: 0, unmatched: 0 };
    if (!n && !p.matched) return;
    toast.success(
      [n && `${n} questões importadas`, p.matched && `${p.matched} questões com pendência marcada`].filter(Boolean).join(" · ") + ".",
    );
    reset();
  };

  const report = analysis?.report ?? null;
  const missing = report?.rejected.filter((r) => r.missing).length ?? 0;
  const ready = (report?.questions.length ?? 0) + (analysis?.pendingMatched ?? 0);
  const hasInput = files.length > 0 || !!text.trim();

  return (
    <Panel title="Importar em lote">
      <p className="mb-2 text-sm text-muted-foreground">
        Escolha um ou mais arquivos <b>CSV</b> ou <b>JSON</b>, ou cole o conteúdo abaixo. Colunas: <code className="text-xs">{IMPORT_COLUMNS.join(", ")}</code>.
        Ponto e vírgula também serve como separador.
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Um arquivo de <b>pendências</b> (colunas <code>materia, questao, pagina, motivo, fonte</code>) também é aceito: cada motivo vira um aviso na questão com a mesma fonte, e elas aparecem no filtro “Com pendência”.
      </p>
      <input ref={fileInput} type="file" accept=".csv,.json,.txt,text/csv,application/json" multiple className="hidden" onChange={(e) => void pickFiles(e.target.files)} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={reading} onClick={() => fileInput.current?.click()}><FileUp /> {reading ? "Lendo…" : "Escolher arquivos"}</Button>
        {files.map((f) => (
          <span key={f.name} className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs">
            <FileText className="size-3.5" /> {f.name}
            <button type="button" aria-label={`Tirar ${f.name}`} className="ml-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => { setFiles(files.filter((x) => x !== f)); setAnalysis(null); }}><X className="size-3.5" /></button>
          </span>
        ))}
      </div>
      <Textarea rows={6} value={text} onChange={(e) => { setText(e.target.value); setAnalysis(null); }} placeholder={CSV_EXAMPLE} className="font-mono text-xs" aria-label="Conteúdo para importar" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button variant="outline" disabled={!hasInput} onClick={() => analyze()}><FileCheck2 /> Validar</Button>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={createMissing} onCheckedChange={(v) => { setCreateMissing(!!v); if (analysis) analyze(!!v); }} />
          Criar matérias e tópicos que não existem
        </label>
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setText(CSV_EXAMPLE)}>Ver exemplo</button>
      </div>
      {analysis && analysis.errors.length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {analysis.errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
      {analysis && (report || analysis.pendingRows > 0) && (
        <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
          {report && (
            <p>
              <b className="tabular text-success">{report.questions.length}</b> questões prontas para entrar ·{" "}
              <b className="tabular text-destructive">{report.rejected.length}</b> recusadas
            </p>
          )}
          {analysis.pendingRows > 0 && (
            <p>
              <b className="tabular">{analysis.pendingMatched}</b> questões vão receber aviso de pendência
              {analysis.pending.size > analysis.pendingMatched && (
                <span className="text-muted-foreground"> · {analysis.pending.size - analysis.pendingMatched} fontes sem questão correspondente (já marcadas, não incluídas no arquivo ou ainda não importadas)</span>
              )}
            </p>
          )}
          {report && report.createdTopics.length > 0 && (
            <p className="text-xs text-muted-foreground">Tópicos que serão criados: {[...new Set(report.createdTopics)].join("; ")}</p>
          )}
          {report && report.rejected.length > 0 && (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
              {report.rejected.slice(0, 300).map((r, i) => (
                <li key={i}><span className="tabular text-muted-foreground">{r.file ? `${r.file}, linha ${r.line}` : `Linha ${r.line}`}:</span> {r.reason}</li>
              ))}
              {report.rejected.length > 300 && <li className="text-muted-foreground">… e mais {report.rejected.length - 300}</li>}
            </ul>
          )}
          {missing > 0 && !createMissing && (
            <Button size="sm" variant="outline" onClick={() => { setCreateMissing(true); analyze(true); }}>
              Criar os tópicos que não existem ({missing} linhas)
            </Button>
          )}
          <div className="flex justify-end">
            <Button disabled={!ready} onClick={confirm}>
              <Upload /> {report?.questions.length ? `Importar ${report.questions.length} questões` : "Aplicar pendências"}
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function ExportPanel({ filters }: { filters: QFilters }) {
  const tax = useTaxonomy();
  const bank = useApp((s) => s.questionBank);
  const [fmt, setFmt] = useState<"json" | "csv">("json");
  const [onlyFiltered, setOnlyFiltered] = useState(false);
  const list = onlyFiltered ? applyFilters(bank, filters) : bank;
  const out = useMemo(() => (fmt === "json" ? exportJSON(list, tax) : exportCSV(list, tax)), [fmt, list, tax]);
  const [shown, setShown] = useState(false);

  const download = () => {
    const blob = new Blob([out], { type: fmt === "json" ? "application/json" : "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `banco-questoes.${fmt}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(out);
      toast.success("Copiado.");
    } catch {
      setShown(true);
      toast("Selecione o texto abaixo e copie manualmente.");
    }
  };

  return (
    <Panel title="Exportar">
      <p className="mb-3 text-sm text-muted-foreground">
        Mesmo formato da importação (sem as tentativas). O backup geral em Configurações já inclui o banco inteiro com as tentativas.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={fmt === "json" ? "default" : "outline"} onClick={() => setFmt("json")}>JSON</Button>
        <Button size="sm" variant={fmt === "csv" ? "default" : "outline"} onClick={() => setFmt("csv")}>CSV</Button>
        <label className="ml-1 flex items-center gap-2 text-sm"><Checkbox checked={onlyFiltered} onCheckedChange={(v) => setOnlyFiltered(!!v)} /> Só as filtradas</label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground"><span className="tabular">{list.length}</span> questões</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!list.length} onClick={() => void copy()}><Copy /> Copiar</Button>
        <Button size="sm" variant="outline" disabled={!list.length} onClick={download}><Download /> Baixar</Button>
        <Button size="sm" variant="ghost" disabled={!list.length} onClick={() => setShown(!shown)}>{shown ? "Esconder texto" : "Mostrar texto"}</Button>
      </div>
      {shown && <Textarea readOnly rows={8} value={out} className="mt-3 font-mono text-xs" aria-label="Banco exportado" onFocus={(e) => e.target.select()} />}
    </Panel>
  );
}
