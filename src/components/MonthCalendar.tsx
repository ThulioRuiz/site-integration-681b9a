import { useMemo, useState } from "react";
import { addMonths, format, getDay, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commitmentOccursOn, isRestDay, minutesBy, monthDays, ymd } from "@/lib/calc";
import { useApp, useRestWeekdays } from "@/lib/store";
import { WEEKDAYS_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { DayDialog } from "./DayDialog";

const LEGEND = [
  { cls: "bg-status-study", label: "Estudo" },
  { cls: "bg-status-goal", label: "Meta do dia" },
  { cls: "bg-status-commit", label: "Compromisso" },
  { cls: "bg-status-review", label: "Revisão feita" },
  { cls: "ring-1 ring-status-review bg-transparent", label: "Revisão marcada" },
  { cls: "bg-status-reading", label: "Leitura" },
  { cls: "bg-status-rest", label: "Descanso" },
];

export function MonthCalendar({ today }: { today: Date }) {
  const [ref, setRef] = useState(() => startOfMonth(today));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const sessions = useApp((s) => s.sessions);
  const commitments = useApp((s) => s.commitments);
  const meta = useApp((s) => s.dayMeta);
  const reviews = useApp((s) => s.reviews);
  const dailyHours = useApp((s) => s.profile?.dailyHours ?? 0);
  const rest = useRestWeekdays();
  const todayStr = ymd(today);

  const days = useMemo(() => monthDays(ref), [ref]);
  const byDay = useMemo(() => minutesBy(sessions, (s) => s.date), [sessions]);
  // revisões marcadas por dia (as atrasadas contam em hoje)
  const dueByDay = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of reviews) {
      if (r.status !== "ativa") continue;
      const d = r.due < todayStr ? todayStr : r.due;
      out[d] = (out[d] ?? 0) + 1;
    }
    return out;
  }, [reviews, todayStr]);
  const lead = getDay(parseISO(days[0] ?? ""));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setRef(subMonths(ref, 1))} aria-label="Mês anterior">
          <ChevronLeft />
        </Button>
        <button className="font-display text-xl font-semibold uppercase tracking-wide" onClick={() => setRef(startOfMonth(today))}>
          {format(ref, "MMMM yyyy", { locale: ptBR })}
        </button>
        <Button variant="ghost" size="icon" onClick={() => setRef(addMonths(ref, 1))} aria-label="Próximo mês">
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="eyebrow py-1 text-muted-foreground">{d}</div>
        ))}
        {Array.from({ length: lead }).map((_, i) => <div key={`e${i}`} />)}
        {days.map((d) => {
          const min = byDay[d] ?? 0;
          const restDay = isRestDay(d, rest, meta);
          const goal = dailyHours > 0 && min >= dailyHours * 60;
          const commit = commitments.some((c) => commitmentOccursOn(c, d));
          const m = meta[d];
          const isToday = d === todayStr;
          const due = dueByDay[d] ?? 0;
          return (
            <button
              key={d}
              onClick={() => setOpenDay(d)}
              className={cn(
                "group relative flex aspect-square flex-col items-center justify-between rounded-lg border p-1 text-sm transition-all hover:-translate-y-0.5 hover:shadow-card sm:p-1.5",
                restDay ? "border-transparent bg-status-rest/35" : "bg-background",
                min > 0 && !restDay && "bg-status-study/15",
                goal && "border-status-goal bg-status-goal/20",
                isToday && "ring-2 ring-brass ring-offset-1 ring-offset-card",
              )}
            >
              <span className="flex w-full items-start justify-between">
                <span className={cn("tabular text-xs sm:text-sm", isToday && "font-bold")}>{d.slice(8)}</span>
                {due > 0 && (
                  <span className="tabular grid min-w-3.5 place-items-center rounded-sm border border-status-review px-0.5 text-[9px] font-bold leading-[14px] text-status-review" title={`${due} ${due === 1 ? "revisão marcada" : "revisões marcadas"}`}>
                    {due}
                  </span>
                )}
              </span>
              {min > 0 && <span className="tabular hidden text-[10px] text-muted-foreground sm:block">{(min / 60).toFixed(1)}h</span>}
              <span className="flex gap-0.5">
                {min > 0 && <i className="size-1.5 rounded-full bg-status-study" />}
                {commit && <i className="size-1.5 rounded-full bg-status-commit" />}
                {m?.reviewDone && <i className="size-1.5 rounded-full bg-status-review" />}
                {m?.readingDone && <i className="size-1.5 rounded-full bg-status-reading" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <i className={cn("size-2.5 rounded-full", l.cls)} />
            {l.label}
          </span>
        ))}
      </div>
      {openDay && <DayDialog date={openDay} onClose={() => setOpenDay(null)} />}
    </div>
  );
}
