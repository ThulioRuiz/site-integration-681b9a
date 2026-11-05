import { useMemo, useState } from "react";
import { FlagOff, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/lib/store";
import { applyFilters, inErrorBook, lastAttempt, RESULT_LABEL, type QFilters } from "@/lib/qbank";
import { QuestionList } from "./BankTab";
import { EmptyAction, type TabId } from "./shared";

export function ErrorsTab({ filters, solve, go }: { filters: QFilters; solve: (ids?: string[]) => void; go: (t: TabId) => void }) {
  const bank = useApp((s) => s.questionBank);
  const setReviewLater = useApp((s) => s.setReviewLater);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = useMemo(
    () =>
      applyFilters(bank, filters)
        .filter(inErrorBook)
        .filter((q) => {
          const d = lastAttempt(q)?.date ?? "";
          return (!from || d >= from) && (!to || d <= to);
        })
        .sort((a, b) => (lastAttempt(b)?.createdAt ?? 0) - (lastAttempt(a)?.createdAt ?? 0)),
    [bank, filters, from, to],
  );
  const ids = list.map((q) => q.id);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="cad-from" className="text-xs">Última tentativa de</Label><Input id="cad-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" /></div>
        <div className="space-y-1"><Label htmlFor="cad-to" className="text-xs">até</Label><Input id="cad-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" /></div>
        {list.length > 0 && <Button className="ml-auto" onClick={() => solve(ids)}><Play /> Refazer caderno ({list.length})</Button>}
      </div>
      {list.length === 0 ? (
        <EmptyAction title="Caderno de erros vazio" actions={<Button onClick={() => go("resolver")}><Play /> Resolver questões</Button>}>
          Aqui entram as questões cuja última tentativa foi errada ou em branco, e as que você marcou "Revisar depois".
          {(from || to || Object.values(filters).some(Boolean)) && " Confira também os filtros e as datas."}
        </EmptyAction>
      ) : (
        <QuestionList
          list={list}
          onSolve={(id) => solve([id, ...ids.filter((x) => x !== id)])}
          extra={(q) => {
            const last = lastAttempt(q);
            if (!last) return null;
            return (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Última: {last.date.split("-").reverse().join("/")} · {RESULT_LABEL[last.result].toLowerCase()} · {q.attempts.length} {q.attempts.length === 1 ? "tentativa" : "tentativas"}</span>
                {last.note && <span className="italic">“{last.note}”</span>}
                {last.reviewLater && (
                  <button type="button" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground" onClick={() => setReviewLater(q.id, false)}>
                    <FlagOff className="size-3" /> tirar da revisão
                  </button>
                )}
              </div>
            );
          }}
        />
      )}
    </>
  );
}
