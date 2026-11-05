import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import { Bar as RBar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Bar, Panel, Stat } from "@/components/kit";
import { useApp } from "@/lib/store";
import { applyFilters, attemptStats, LEVEL_INFO, LEVELS, weeklyEvolution, type QFilters } from "@/lib/qbank";
import { cn } from "@/lib/utils";
import { LegacyLogs } from "./LegacyLogs";
import { EmptyAction, pct, useNames, useTaxonomy, type TabId } from "./shared";

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" };
const TIP = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 };

/** Mínimo de tentativas para um tópico entrar no ranking de pontos fracos. */
const MIN_ATTEMPTS = 3;

export function PerformanceTab({ filters, setFilters, go }: { filters: QFilters; setFilters: (f: QFilters) => void; go: (t: TabId) => void }) {
  const bank = useApp((s) => s.questionBank);
  const names = useNames();
  const list = useMemo(() => applyFilters(bank, filters), [bank, filters]);
  const total = attemptStats(list);

  const bySubject = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const q of list) m.set(q.subjectId, [...(m.get(q.subjectId) ?? []), q]);
    return [...m.entries()]
      .map(([id, qs]) => ({ id, name: names.subjectName(id), ...attemptStats(qs) }))
      .filter((r) => r.attempts > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [list, names]);

  const byTopic = useMemo(() => {
    const m = new Map<string, typeof list>();
    for (const q of list) m.set(q.topicId, [...(m.get(q.topicId) ?? []), q]);
    return [...m.entries()]
      .map(([id, qs]) => ({ id, subjectId: qs[0]!.subjectId, name: names.topicName(id), subject: names.subjectName(qs[0]!.subjectId), ...attemptStats(qs) }))
      .filter((r) => r.attempts > 0)
      .sort((a, b) => a.rate - b.rate || b.attempts - a.attempts);
  }, [list, names]);

  const tax = useTaxonomy();
  const skipped = useMemo(() => new Set(tax.subjects.flatMap((s) => s.topics.filter((t) => t.skip).map((t) => t.id))), [tax]);
  const weak = byTopic.filter((t) => t.attempts >= MIN_ATTEMPTS && !skipped.has(t.id) && t.rate < 70).slice(0, 3);
  const weakIds = new Set(weak.map((w) => w.id));
  const weekly = useMemo(() => weeklyEvolution(list), [list]);

  return (
    <div className="space-y-6">
      {total.attempts === 0 ? (
        <EmptyAction title="Ainda não há tentativas registradas" actions={<Button onClick={() => go("resolver")}>Resolver questões</Button>}>
          O desempenho aparece quando você marca Acertei, Errei ou Em branco no Resolver.
        </EmptyAction>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Questões feitas" value={`${total.done}/${total.questions}`} />
            <Stat label="Tentativas" value={total.attempts} />
            <Stat label="Acerto" value={pct(total.rate)} hint={`${total.correct} certas`} />
            <Stat label="Erradas / em branco" value={`${total.wrong} / ${total.blank}`} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {LEVELS.map((l) => {
              const st = attemptStats(list.filter((q) => q.level === l));
              return (
                <div key={l} className="rounded-xl border bg-card p-4 shadow-card">
                  <p className="eyebrow text-muted-foreground">Nível {l} · {LEVEL_INFO[l].name}</p>
                  <p className="tabular mt-1 text-2xl font-semibold">{st.attempts ? pct(st.rate) : "—"}</p>
                  <Bar value={st.rate} className="mt-2" />
                  <p className="mt-1 text-xs text-muted-foreground"><span className="tabular">{st.attempts}</span> tentativas em <span className="tabular">{st.questions}</span> questões</p>
                </div>
              );
            })}
          </div>

          {weak.length > 0 && (
            <Panel title={<span className="flex items-center gap-2"><TriangleAlert className="size-4 text-warning" /> Tópicos mais fracos</span>}>
              <ul className="grid gap-2 sm:grid-cols-3">
                {weak.map((t) => (
                  <li key={t.id} className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.subject}</p>
                    <p className="tabular mt-1 text-lg font-semibold">{pct(t.rate)}</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => { setFilters({ ...filters, subjectId: t.subjectId, topicId: t.id, level: filters.level || "1" }); go("banco"); }}>
                      Treinar este tópico
                    </Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Acertos e erros por matéria">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySubject.map((s) => ({ name: s.name, Acertos: s.correct, Erros: s.wrong, "Em branco": s.blank }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={AXIS} interval={0} />
                    <YAxis allowDecimals={false} tick={AXIS} width={32} />
                    <Tooltip contentStyle={TIP} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                    <Legend />
                    <RBar dataKey="Acertos" stackId="a" fill="var(--success)" />
                    <RBar dataKey="Erros" stackId="a" fill="var(--destructive)" />
                    <RBar dataKey="Em branco" stackId="a" fill="var(--muted-foreground)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Evolução semanal">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={AXIS} />
                    <YAxis allowDecimals={false} tick={AXIS} width={32} />
                    <Tooltip contentStyle={TIP} cursor={{ fill: "var(--muted)", opacity: 0.4 }} labelFormatter={(l) => `Semana de ${String(l)}`} />
                    <Legend />
                    <RBar dataKey="Acertos" stackId="a" fill="var(--success)" />
                    <RBar dataKey="Erros" stackId="a" fill="var(--destructive)" />
                    <RBar dataKey="Em branco" stackId="a" fill="var(--muted-foreground)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel title="Acerto por matéria">
            <ul className="space-y-3">
              {bySubject.map((s) => (
                <li key={s.id} className="text-sm">
                  <div className="flex justify-between gap-2"><span className="font-medium">{s.name}</span><span className="tabular">{pct(s.rate)} · {s.attempts} tent.</span></div>
                  <Bar value={s.rate} className="mt-1" />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Acerto por tópico">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2 pr-2 font-medium">Tópico</th><th className="py-2 pr-2 font-medium">Matéria</th><th className="py-2 pr-2 text-right font-medium">Tentativas</th><th className="py-2 text-right font-medium">Acerto</th></tr>
                </thead>
                <tbody className="divide-y">
                  {byTopic.map((t) => (
                    <tr key={t.id} className={cn(weakIds.has(t.id) && "bg-warning/10")}>
                      <td className="py-2 pr-2 font-medium">{t.name}{weakIds.has(t.id) && <span className="ml-2 text-xs text-warning">ponto fraco</span>}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{t.subject}</td>
                      <td className="tabular py-2 pr-2 text-right">{t.attempts}</td>
                      <td className="tabular py-2 text-right font-semibold">{pct(t.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Ordenado do menor para o maior acerto. Pontos fracos: ao menos {MIN_ATTEMPTS} tentativas e acerto abaixo de 70%, fora os tópicos marcados como fora do programa.</p>
          </Panel>
        </>
      )}
      <LegacyLogs />
    </div>
  );
}
