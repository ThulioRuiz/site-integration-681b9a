import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BookOpen, Briefcase, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dot, Empty, PageHeader, Panel, Bar, Stat } from "@/components/kit";
import { NativeSelect } from "@/components/NativeSelect";
import { SessionDialog } from "@/components/SessionDialog";
import { CommitmentDialog } from "@/components/CommitmentDialog";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { useApp, useDueReviews, useSubjectMap } from "@/lib/store";
import { commitmentMinutes, fmtMin, sumMinutes, weekRange, ymd } from "@/lib/calc";
import { KIND_LABEL, REPEAT_LABEL } from "@/lib/labels";
import type { SessionKind } from "@/lib/types";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda e histórico — Quartel de Estudos" },
      { name: "description", content: "Histórico completo de estudos, revisões, leituras e compromissos de horas brutas." },
      { property: "og:title", content: "Agenda e histórico — Quartel de Estudos" },
      { property: "og:description", content: "Histórico de estudos, revisões, leituras e compromissos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const today = ymd(new Date());
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Registros" title="Agenda e histórico" />
      <Tabs defaultValue="historico">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="historico">Histórico de estudos</TabsTrigger>
          <TabsTrigger value="revisao">Revisão e leitura</TabsTrigger>
          <TabsTrigger value="compromissos">Compromissos</TabsTrigger>
        </TabsList>
        <TabsContent value="historico"><History today={today} /></TabsContent>
        <TabsContent value="revisao"><ReviewReading today={today} /></TabsContent>
        <TabsContent value="compromissos"><Commitments today={today} /></TabsContent>
      </Tabs>
    </div>
  );
}

function SessionList({ kinds, subjectId, period, today }: { kinds: SessionKind[]; subjectId: string; period: string; today: string }) {
  const sessions = useApp((s) => s.sessions);
  const removeSession = useApp((s) => s.removeSession);
  const subj = useSubjectMap();
  const wk = weekRange(parseISO(today));
  const list = sessions
    .filter((s) => kinds.includes(s.kind))
    .filter((s) => !subjectId || s.subjectId === subjectId)
    .filter((s) => (period === "semana" ? s.date >= wk.from && s.date <= wk.to : period === "mes" ? s.date.slice(0, 7) === today.slice(0, 7) : true))
    .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

  if (list.length === 0) return <Empty>Nenhum registro encontrado.</Empty>;
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">{list.length} registro(s) · total <b className="tabular text-foreground">{fmtMin(sumMinutes(list))}</b></p>
      <ul className="divide-y rounded-xl border bg-card">
        {list.map((s) => (
          <li key={s.id} className="flex items-center gap-3 p-3 text-sm">
            <span className="tabular w-20 shrink-0 text-xs text-muted-foreground">{format(parseISO(s.date), "dd/MM/yy")}</span>
            <Dot color={s.subjectId ? subj[s.subjectId]?.color ?? "gray" : "var(--muted-foreground)"} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.subjectId ? subj[s.subjectId]?.name ?? "Matéria removida" : "Geral"} <span className="text-xs text-muted-foreground">· {KIND_LABEL[s.kind]} · {s.source}</span></p>
              {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
            </div>
            <span className="tabular font-semibold">{fmtMin(s.minutes)}</span>
            <SessionDialog date={s.date} session={s}><Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button></SessionDialog>
            <ConfirmDelete title="Excluir registro?" onConfirm={() => removeSession(s.id)}>
              <Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 /></Button>
            </ConfirmDelete>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Filters({ subjectId, setSubjectId, period, setPeriod, kind, setKind }: {
  subjectId: string; setSubjectId: (v: string) => void; period: string; setPeriod: (v: string) => void; kind?: string; setKind?: (v: string) => void;
}) {
  const subjects = useApp((s) => s.subjects);
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-3">
      <NativeSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
        <option value="">Todas as matérias</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </NativeSelect>
      <NativeSelect value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="tudo">Todo o período</option>
        <option value="semana">Esta semana</option>
        <option value="mes">Este mês</option>
      </NativeSelect>
      {setKind && (
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="estudo">Estudo</option>
          <option value="revisao">Revisão</option>
          <option value="leitura">Leitura</option>
        </NativeSelect>
      )}
    </div>
  );
}

function History({ today }: { today: string }) {
  const [subjectId, setSubjectId] = useState("");
  const [period, setPeriod] = useState("tudo");
  const [kind, setKind] = useState("");
  const kinds: SessionKind[] = kind ? [kind as SessionKind] : ["estudo", "revisao", "leitura"];
  return (
    <>
      <div className="mb-4 flex justify-end">
        <SessionDialog date={today}><Button><Plus /> Estudo manual</Button></SessionDialog>
      </div>
      <Filters subjectId={subjectId} setSubjectId={setSubjectId} period={period} setPeriod={setPeriod} kind={kind} setKind={setKind} />
      <SessionList kinds={kinds} subjectId={subjectId} period={period} today={today} />
    </>
  );
}

function ReviewReading({ today }: { today: string }) {
  const profile = useApp((s) => s.profile)!;
  const sessions = useApp((s) => s.sessions);
  const meta = useApp((s) => s.dayMeta[today]);
  const [subjectId, setSubjectId] = useState("");
  const [period, setPeriod] = useState("mes");
  const t = sessions.filter((s) => s.date === today);
  const rev = sumMinutes(t.filter((s) => s.kind === "revisao"));
  const read = sumMinutes(t.filter((s) => s.kind === "leitura"));
  const due = useDueReviews(today).queue.length;
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><RotateCcw className="size-5 text-status-review" /> Revisão de hoje</span>}
          action={<SessionDialog date={today} defaultKind="revisao"><Button size="sm" variant="outline"><Plus /> Registrar</Button></SessionDialog>}>
          <p className="tabular text-2xl font-semibold">{fmtMin(rev)} <span className="text-sm font-normal text-muted-foreground">/ {fmtMin(profile.reviewMinutes)}</span></p>
          <Bar className="mt-2" value={profile.reviewMinutes ? (rev / profile.reviewMinutes) * 100 : 0} color="var(--status-review)" />
          <p className="mt-2 text-xs text-muted-foreground">
            {meta?.reviewDone ? "Marcada como concluída ✓" : "Ainda não concluída"}
            {" · "}
            <Link to="/revisoes" className="text-primary underline-offset-2 hover:underline">{due > 0 ? `${due} na fila de revisões` : "fila de revisões vazia"}</Link>
          </p>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><BookOpen className="size-5 text-status-reading" /> Leitura de hoje</span>}
          action={<SessionDialog date={today} defaultKind="leitura"><Button size="sm" variant="outline"><Plus /> Registrar</Button></SessionDialog>}>
          <p className="tabular text-2xl font-semibold">{fmtMin(read)} <span className="text-sm font-normal text-muted-foreground">/ {fmtMin(profile.readingMinutes)}</span></p>
          <Bar className="mt-2" value={profile.readingMinutes ? (read / profile.readingMinutes) * 100 : 0} color="var(--status-reading)" />
          <p className="mt-2 text-xs text-muted-foreground">{meta?.readingDone ? "Marcada como concluída ✓" : "Ainda não concluída"}</p>
        </Panel>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">Revisão e leitura contam como horas líquidas.</p>
      <Filters subjectId={subjectId} setSubjectId={setSubjectId} period={period} setPeriod={setPeriod} />
      <SessionList kinds={["revisao", "leitura"]} subjectId={subjectId} period={period} today={today} />
    </>
  );
}

function Commitments({ today }: { today: string }) {
  const commitments = useApp((s) => s.commitments);
  const removeCommitment = useApp((s) => s.removeCommitment);
  const weekly = useMemo(
    () => commitments.reduce((a, c) => a + commitmentMinutes(c) * (c.repeat === "diaria" ? 7 : c.repeat === "semanal" ? 1 : 0), 0),
    [commitments],
  );
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Stat label="Horas brutas fixas por semana" value={fmtMin(weekly)} hint="Somente compromissos que se repetem" />
        <CommitmentDialog date={today}><Button><Plus /> Novo compromisso</Button></CommitmentDialog>
      </div>
      {commitments.length === 0 ? (
        <Empty>Cadastre trabalho, faculdade, academia ou deslocamentos. Eles aparecem no calendário como horas brutas.</Empty>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {commitments.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3 text-sm">
              <Briefcase className="size-4" style={{ color: c.color }} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.start}–{c.end} · {REPEAT_LABEL[c.repeat]} · desde {format(parseISO(c.date), "d 'de' MMM", { locale: ptBR })}
                  {c.note && ` · ${c.note}`}
                </p>
              </div>
              <span className="tabular font-semibold">{fmtMin(commitmentMinutes(c))}</span>
              <CommitmentDialog date={c.date} commitment={c}><Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button></CommitmentDialog>
              <ConfirmDelete title="Excluir compromisso?" onConfirm={() => removeCommitment(c.id)}>
                <Button size="icon" variant="ghost" aria-label="Excluir"><Trash2 /></Button>
              </ConfirmDelete>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
