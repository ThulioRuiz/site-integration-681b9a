import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Flame, ListChecks, Medal, RefreshCw, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Empty, PageHeader, Panel, Stat } from "@/components/kit";
import { useApp } from "@/lib/store";
import { fmtMin } from "@/lib/calc";
import { computeRankingStats, fetchRanking, pushRankingStats, type RankingEntry, type RankingPeriod } from "@/lib/ranking";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking — Quartel de Estudos" },
      { name: "description", content: "Ranking de horas líquidas entre os recrutas: semana, mês e geral." },
      { property: "og:title", content: "Ranking — Quartel de Estudos" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RankingPage,
});

const PERIOD_LABEL: Record<RankingPeriod, string> = { semana: "Esta semana", mes: "Este mês", total: "Geral" };
const PODIUM = [
  { cls: "bg-brass text-brass-foreground", icon: Crown, h: "h-36" },
  { cls: "bg-muted text-foreground", icon: Medal, h: "h-28" },
  { cls: "bg-status-commit/25 text-foreground", icon: Medal, h: "h-24" },
];

function RankingPage() {
  const [period, setPeriod] = useState<RankingPeriod>("semana");
  const [syncing, setSyncing] = useState(false);
  const profile = useApp((s) => s.profile);
  const sessions = useApp((s) => s.sessions);
  const subjects = useApp((s) => s.subjects);
  const questionLogs = useApp((s) => s.questionLogs);
  const questionBank = useApp((s) => s.questionBank);
  const mine = useMemo(
    () => computeRankingStats({ profile, sessions, subjects, questionLogs, questionBank }),
    [profile, sessions, subjects, questionLogs, questionBank],
  );
  const q = useQuery({ queryKey: ["ranking", period], queryFn: () => fetchRanking(period), refetchInterval: 60_000 });

  const entries = q.data ?? [];
  const myPos = entries.findIndex((e) => e.me);
  const myMinutes = period === "semana" ? mine.weekMinutes : period === "mes" ? mine.monthMinutes : mine.totalMinutes;

  const refresh = async () => {
    setSyncing(true);
    try {
      await pushRankingStats();
      await q.refetch();
    } finally {
      setSyncing(false);
    }
  };

  // Ordem visual do pódio: 2º, 1º, 3º
  const podium = [entries[1], entries[0], entries[2]];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Tropa" title="Ranking">
        <Button variant="outline" onClick={refresh} disabled={syncing}>
          <RefreshCw className={cn(syncing && "animate-spin")} /> Atualizar
        </Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sua posição" value={myPos >= 0 ? `${myPos + 1}º` : "—"} hint={entries.length ? `de ${entries.length} recrutas` : undefined} />
        <Stat label={`Horas · ${PERIOD_LABEL[period].toLowerCase()}`} value={fmtMin(myMinutes)} />
        <Stat label="Sequência" value={`${mine.streakDays} dia${mine.streakDays === 1 ? "" : "s"}`} hint="Dias seguidos com estudo" />
        <Stat label="Tópicos estudados" value={mine.topicsDone} />
      </div>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as RankingPeriod)}>
        <TabsList className="mb-4">
          {(Object.keys(PERIOD_LABEL) as RankingPeriod[]).map((p) => (
            <TabsTrigger key={p} value={p}>{PERIOD_LABEL[p]}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {q.isPending ? (
        <div className="h-72 animate-pulse rounded-xl border bg-muted/50" />
      ) : q.isError ? (
        <Empty>
          Não foi possível carregar o ranking.{" "}
          <button className="font-semibold text-primary underline" onClick={() => void q.refetch()}>Tentar de novo</button>
        </Empty>
      ) : entries.length === 0 ? (
        <Empty>Ninguém no ranking ainda. Registre um estudo e seja o primeiro!</Empty>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-3 items-end gap-3">
            {podium.map((e, i) => {
              const place = i === 1 ? 0 : i === 0 ? 1 : 2;
              const st = PODIUM[place]!;
              const Icon = st.icon;
              return (
                <div key={place} className="flex flex-col items-center text-center animate-rise">
                  {e ? (
                    <>
                      <Avatar name={e.name} className={cn("mb-2", place === 0 ? "size-16 text-xl" : "size-12")} />
                      <p className="line-clamp-1 text-sm font-semibold">{e.name}{e.me && " (você)"}</p>
                      <p className="tabular mb-2 text-xs text-muted-foreground">{fmtMin(e.minutes)}</p>
                    </>
                  ) : (
                    <p className="mb-2 text-xs text-muted-foreground">—</p>
                  )}
                  <div className={cn("flex w-full flex-col items-center justify-start gap-1 rounded-t-xl pt-3 shadow-card", st.cls, st.h)}>
                    <Icon className="size-5" />
                    <span className="font-display text-3xl font-bold">{place + 1}º</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Panel title={<span className="flex items-center gap-2"><Trophy className="size-5 text-brass" /> Classificação</span>}>
            <ol className="divide-y">
              {entries.map((e, i) => <Row key={e.userId} e={e} pos={i + 1} top={entries[0]?.minutes ?? 0} />)}
            </ol>
          </Panel>
        </>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        O ranking usa só números agregados (horas líquidas, sequência, tópicos e acertos). Seus registros e anotações
        continuam privados. O nome exibido é o do seu perfil.
      </p>
    </div>
  );
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cn("bg-field grid place-items-center rounded-full font-display font-bold uppercase text-primary-foreground shadow-lift", className)}>
      {name.slice(0, 2)}
    </div>
  );
}

function Row({ e, pos, top }: { e: RankingEntry; pos: number; top: number }) {
  return (
    <li className={cn("flex items-center gap-3 py-2.5", e.me && "-mx-2 rounded-lg bg-accent px-2")}>
      <span className={cn("tabular w-8 text-center font-display text-xl font-bold", pos <= 3 ? "text-brass" : "text-muted-foreground")}>{pos}</span>
      <Avatar name={e.name} className="size-9 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-medium">
          {e.name}
          {e.me && <Badge>você</Badge>}
          {e.exam && <Badge variant="outline">{e.exam}</Badge>}
        </p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${top ? (e.minutes / top) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="hidden gap-3 text-xs text-muted-foreground sm:flex">
        <span className="inline-flex items-center gap-1" title="Sequência de dias"><Flame className="size-3.5" />{e.streakDays}</span>
        <span className="inline-flex items-center gap-1" title="Tópicos estudados"><Target className="size-3.5" />{e.topicsDone}</span>
        <span className="inline-flex items-center gap-1" title="Questões certas"><ListChecks className="size-3.5" />{e.questionsCorrect}</span>
      </div>
      <span className="tabular w-16 text-right font-semibold">{fmtMin(e.minutes)}</span>
    </li>
  );
}
