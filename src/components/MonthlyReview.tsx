import { useEffect, useMemo, useState } from "react";
import { format, parse, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp, useRestWeekdays } from "@/lib/store";
import { monthStats } from "@/lib/stats";
import { fmtMin } from "@/lib/calc";
import { Stat } from "./kit";

export function MonthlyReview() {
  const last = useApp((s) => s.lastReviewedMonth);
  const setLast = useApp((s) => s.setLastReviewedMonth);
  const profile = useApp((s) => s.profile)!;
  const updateProfile = useApp((s) => s.updateProfile);
  const cycles = useApp((s) => s.cycles);
  const activateCycle = useApp((s) => s.activateCycle);
  const sessions = useApp((s) => s.sessions);
  const subjects = useApp((s) => s.subjects);
  const commitments = useApp((s) => s.commitments);
  const meta = useApp((s) => s.dayMeta);
  const rest = useRestWeekdays();

  const current = format(new Date(), "yyyy-MM");
  const [open, setOpen] = useState(false);
  const [weekly, setWeekly] = useState(profile.weeklyGoal);
  const [monthly, setMonthly] = useState(profile.monthlyGoal);
  const [cycleId, setCycleId] = useState(cycles.find((c) => c.status === "ativo")?.id ?? "");

  useEffect(() => {
    if (last && last < current) setOpen(true);
    if (!last) setLast(current);
  }, [last, current, setLast]);

  const ref = subMonths(parse(current + "-01", "yyyy-MM-dd", new Date()), 1);
  const st = useMemo(
    () => monthStats(ref, sessions, subjects, commitments, meta, rest),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, subjects, commitments, meta, rest, current],
  );
  const pct = profile.monthlyGoal > 0 ? Math.round((st.netMinutes / 60 / profile.monthlyGoal) * 100) : 0;

  const close = () => {
    updateProfile({ weeklyGoal: weekly, monthlyGoal: monthly });
    if (cycleId) activateCycle(cycleId);
    setLast(current);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <p className="eyebrow text-brass">Revisão mensal</p>
          <DialogTitle className="font-display text-3xl uppercase">
            {format(ref, "MMMM 'de' yyyy", { locale: ptBR })}
          </DialogTitle>
          <DialogDescription>Veja como foi o mês e defina o plano para o próximo.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Horas líquidas" value={fmtMin(st.netMinutes)} />
          <Stat label="Meta cumprida" value={`${pct}%`} />
          <Stat label="Dias estudados" value={st.studiedDays} />
          <Stat label="Mais estudada" value={<span className="text-base">{st.most?.subject.name ?? "—"}</span>} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Meta semanal (h)</Label>
            <Input type="number" min={0} value={weekly} onChange={(e) => setWeekly(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Meta mensal (h)</Label>
            <Input type="number" min={0} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Ciclo do mês</Label>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
            >
              <option value="">Manter como está</option>
              {cycles.filter((c) => c.status !== "arquivado").map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={close}>Salvar plano do mês</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
