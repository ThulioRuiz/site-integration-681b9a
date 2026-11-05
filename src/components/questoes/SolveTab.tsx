import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Eye, MinusCircle, RotateCcw, SkipForward, Timer, TrendingUp, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Panel } from "@/components/kit";
import { uid, useApp } from "@/lib/store";
import { ymd } from "@/lib/calc";
import { LETTERS, LEVEL_INFO, questionStatus, RESULT_LABEL, shouldSuggestNextLevel } from "@/lib/qbank";
import type { AttemptResult, BankQuestion, QLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyAction, LevelBadge, StatusBadge, useNames, type TabId } from "./shared";

const ORDER = { "nao-feita": 0, errada: 1, branco: 1, certa: 2 } as const;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SolveTab({
  queue,
  queueKey,
  explicit,
  onClearExplicit,
  onGoLevel,
  go,
}: {
  queue: BankQuestion[];
  queueKey: string;
  explicit: boolean;
  onClearExplicit: () => void;
  onGoLevel: (topicId: string, subjectId: string, level: QLevel) => void;
  go: (t: TabId) => void;
}) {
  const bank = useApp((s) => s.questionBank);
  const names = useNames();
  const addAttempt = useApp((s) => s.addAttempt);
  const setQuestionAnswer = useApp((s) => s.setQuestionAnswer);
  const clearPending = useApp((s) => s.clearPending);

  // Ordem fixada quando a lista muda (não reordena a cada resposta).
  const [order, setOrder] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const sorted = explicit ? queue : [...queue].sort((a, b) => ORDER[questionStatus(a)] - ORDER[questionStatus(b)] || a.createdAt - b.createdAt);
    setOrder(sorted.map((q) => q.id));
    setIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey]);

  const byId = useMemo(() => new Map(bank.map((q) => [q.id, q])), [bank]);
  const ids = order.filter((id) => byId.has(id));
  const q = ids[idx] ? byId.get(ids[idx]!) : undefined;

  const [chosen, setChosen] = useState<number | undefined>();
  const [revealed, setRevealed] = useState(false);
  const [note, setNote] = useState("");
  const [review, setReview] = useState(false);
  const [timerOn, setTimerOn] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [suggest, setSuggest] = useState<{ topicId: string; subjectId: string; level: QLevel } | null>(null);

  useEffect(() => {
    setChosen(undefined);
    setRevealed(false);
    setNote("");
    setReview(false);
    setStartedAt(Date.now());
    setNow(Date.now());
  }, [q?.id]);

  useEffect(() => {
    if (!timerOn) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [timerOn]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  if (!ids.length)
    return (
      <EmptyAction title="Nenhuma questão para resolver com estes filtros"
        actions={<>
          <Button onClick={() => go("banco")}>Escolher no banco</Button>
          <Button variant="outline" onClick={() => go("cadastrar")}>Cadastrar questões</Button>
        </>}>
        Escolha uma matéria, um tópico e um nível no Banco, ou ajuste os filtros acima.
      </EmptyAction>
    );

  if (!q)
    return (
      <Panel>
        <p className="text-lg font-semibold">Lista concluída 🎯</p>
        <p className="mt-1 text-sm text-muted-foreground">Você passou pelas {ids.length} questões desta lista.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setIdx(0)}><RotateCcw /> Recomeçar</Button>
          <Button variant="outline" onClick={() => go("caderno")}>Ver caderno de erros</Button>
          <Button variant="outline" onClick={() => go("desempenho")}>Ver desempenho</Button>
        </div>
        {suggest && <Suggestion s={suggest} onGo={onGoLevel} onClose={() => setSuggest(null)} />}
      </Panel>
    );

  const answerIdx = LETTERS.indexOf(q.answer as (typeof LETTERS)[number]);

  const record = (result: AttemptResult) => {
    addAttempt(q.id, {
      id: uid(),
      date: ymd(new Date()),
      result,
      ...(timerOn ? { timeSec: elapsed } : {}),
      ...(chosen !== undefined ? { chosen } : {}),
      note: note.trim(),
      reviewLater: review,
      createdAt: Date.now(),
    });
    toast.success(`Tentativa registrada: ${RESULT_LABEL[result].toLowerCase()}.`);
    const updated = useApp.getState().questionBank;
    if (result === "certa" && shouldSuggestNextLevel(updated, q.topicId, q.level))
      setSuggest({ topicId: q.topicId, subjectId: q.subjectId, level: (q.level + 1) as QLevel });
    setIdx(idx + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          Questão <b className="tabular text-foreground">{idx + 1}</b> de <span className="tabular">{ids.length}</span>
          {explicit && <> · <button type="button" className="underline underline-offset-2" onClick={onClearExplicit}>usar os filtros</button></>}
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2"><Switch checked={timerOn} onCheckedChange={(v) => { setTimerOn(v); setStartedAt(Date.now()); setNow(Date.now()); }} aria-label="Cronômetro" /> <Timer className="size-4" /></label>
          {timerOn && <span className="tabular font-semibold">{fmt(elapsed)}</span>}
        </div>
      </div>

      {suggest && <Suggestion s={suggest} onGo={onGoLevel} onClose={() => setSuggest(null)} />}

      <Panel>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <LevelBadge level={q.level} />
          <StatusBadge q={q} />
          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold">{q.exam}</span>
          {q.source && <span>{q.source}</span>}
          <span>· {names.subjectName(q.subjectId)} › {names.topicName(q.topicId)}</span>
        </div>
        {!!q.pending?.length && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Pendência desta questão</p>
              <ul className="mt-0.5 list-disc pl-4 text-muted-foreground">
                {q.pending.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
              {q.source && <p className="mt-1 text-xs text-muted-foreground">Confira no original: {q.source}</p>}
            </div>
            <Button size="sm" variant="ghost" onClick={() => clearPending(q.id)} title="Já conferi; tirar o aviso">Resolvida</Button>
          </div>
        )}
        <p className="mt-3 whitespace-pre-line text-base leading-relaxed">{q.statement}</p>

        {q.options.length > 0 && (
          <div className="mt-4 grid gap-2">
            {q.options.map((o, i) => {
              const isAnswer = revealed && i === answerIdx;
              const isWrong = revealed && chosen === i && i !== answerIdx && answerIdx >= 0;
              return (
                <button key={i} type="button" onClick={() => setChosen(chosen === i ? undefined : i)} aria-pressed={chosen === i}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
                    chosen === i && "border-primary bg-primary/10",
                    isAnswer && "border-success bg-success/15",
                    isWrong && "border-destructive bg-destructive/10",
                  )}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold">{LETTERS[i]}</span>
                  <span className={cn("whitespace-pre-line", !o && "italic text-muted-foreground")}>{o || "sem texto (provável imagem — veja o original)"}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          {!revealed ? (
            <Button variant="outline" onClick={() => setRevealed(true)}><Eye /> Ver gabarito</Button>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              {!q.answer && q.options.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">Sem gabarito. Se souber, marque a letra certa:</span>
                  {q.options.map((_, i) => (
                    <Button key={i} size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => { setQuestionAnswer(q.id, LETTERS[i]!); toast.success(`Gabarito ${LETTERS[i]} salvo.`); }}>
                      {LETTERS[i]}
                    </Button>
                  ))}
                </div>
              )}
              <p><b>Gabarito:</b> {q.answer || "não cadastrado"}
                {chosen !== undefined && answerIdx >= 0 && (
                  <span className={cn("ml-2 font-semibold", chosen === answerIdx ? "text-success" : "text-destructive")}>
                    {chosen === answerIdx ? "· você marcou a certa" : `· você marcou ${LETTERS[chosen]}`}
                  </span>
                )}
              </p>
              {q.resolution && <p className="mt-2 whitespace-pre-line text-muted-foreground">{q.resolution}</p>}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-3 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="attempt-note">Observação</Label>
            <Textarea id="attempt-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que travou? Qual conceito revisar?" />
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={review} onCheckedChange={(v) => setReview(!!v)} /> Revisar depois</label>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-success text-white hover:bg-success/90" onClick={() => record("certa")}><CheckCircle2 /> Acertei</Button>
            <Button variant="destructive" onClick={() => record("errada")}><XCircle /> Errei</Button>
            <Button variant="outline" onClick={() => record("branco")}><MinusCircle /> Em branco</Button>
            <Button variant="ghost" className="ml-auto" onClick={() => setIdx(idx + 1)}><SkipForward /> Pular</Button>
          </div>
        </div>
      </Panel>

      {q.attempts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tentativas anteriores: {q.attempts.slice(-5).map((a) => `${a.date.split("-").reverse().join("/")} ${RESULT_LABEL[a.result].toLowerCase()}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Suggestion({ s, onGo, onClose }: { s: { topicId: string; subjectId: string; level: QLevel }; onGo: (t: string, sub: string, l: QLevel) => void; onClose: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
      <TrendingUp className="size-4 text-success" />
      <span className="flex-1">
        Você acertou a maioria do Nível {s.level - 1} deste tópico. Que tal subir para o <b>Nível {s.level} ({LEVEL_INFO[s.level].name.toLowerCase()})</b>?
      </span>
      <Button size="sm" variant="ghost" onClick={onClose}>Agora não</Button>
      <Button size="sm" onClick={() => { onGo(s.topicId, s.subjectId, s.level); onClose(); }}>Ir para o Nível {s.level} <ArrowRight /></Button>
    </div>
  );
}
