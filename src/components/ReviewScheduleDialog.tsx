import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dot, Tag } from "@/components/kit";
import { useApp, useReviewSettings } from "@/lib/store";
import { describeSchedule, topicsWithoutReview, type MakeReviewInput } from "@/lib/review";
import { normalizeText } from "@/lib/qbank";
import { ymd } from "@/lib/calc";
import { cn } from "@/lib/utils";

/**
 * Agenda revisões espaçadas para tópicos estudados. Lista os tópicos (folhas) de cada matéria
 * que ainda não têm revisão ativa; também aceita um assunto avulso.
 */
export function ReviewScheduleDialog({
  children,
  open: controlledOpen,
  onOpenChange,
  subjectIds,
  date,
  onScheduled,
}: {
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  /** Restringe às matérias dadas (ex.: as do estudo que acabou de terminar). */
  subjectIds?: string[] | undefined;
  /** Dia do estudo (padrão: hoje). */
  date?: string | undefined;
  onScheduled?: (count: number) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (o: boolean) => {
    setInnerOpen(o);
    onOpenChange?.(o);
  };
  const subjects = useApp((s) => s.subjects);
  const reviews = useApp((s) => s.reviews);
  const scheduleReviews = useApp((s) => s.scheduleReviews);
  const settings = useReviewSettings();

  const [studiedOn, setStudiedOn] = useState(date ?? ymd(new Date()));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [freeSubject, setFreeSubject] = useState("");
  const [freeTitle, setFreeTitle] = useState("");

  const groups = useMemo(() => {
    const list = subjects.filter((s) => !s.archived && (!subjectIds || subjectIds.includes(s.id)));
    const q = normalizeText(query);
    return list
      .map((s) => ({ subject: s, topics: topicsWithoutReview(s, reviews).filter((t) => !q || normalizeText(t.title).includes(q)) }))
      .filter((g) => g.topics.length > 0 || !q);
  }, [subjects, subjectIds, reviews, query]);

  useEffect(() => {
    if (!open) return;
    setStudiedOn(date ?? ymd(new Date()));
    setSelected(new Set());
    setQuery("");
    setFreeTitle("");
    const first = subjects.find((s) => !s.archived && (!subjectIds || subjectIds.includes(s.id)));
    setFreeSubject(first?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const total = selected.size + (freeTitle.trim() && freeSubject ? 1 : 0);

  const save = () => {
    if (!studiedOn) {
      toast.error("Informe o dia do estudo.");
      return;
    }
    const inputs: Omit<MakeReviewInput, "id">[] = groups.flatMap((g) =>
      g.topics.filter((t) => selected.has(t.id)).map((t) => ({ subjectId: g.subject.id, topicId: t.id, title: t.title, studiedOn, source: "manual" as const })),
    );
    if (freeTitle.trim() && freeSubject) inputs.push({ subjectId: freeSubject, title: freeTitle.trim(), studiedOn, source: "manual" as const, topicId: undefined });
    if (!inputs.length) {
      toast.error("Escolha pelo menos um tópico.");
      return;
    }
    const created = scheduleReviews(inputs, studiedOn);
    const when = settings.method === "fixo" ? describeSchedule(settings.schedule) : "amanhã e depois em intervalos que crescem conforme você lembra";
    toast.success(`${created.length} ${created.length === 1 ? "revisão agendada" : "revisões agendadas"}.`, { description: `Revisões ${when}.` });
    onScheduled?.(created.length);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <p className="eyebrow text-brass">Repetição espaçada</p>
          <DialogTitle className="font-display text-3xl uppercase">Agendar revisão</DialogTitle>
          <DialogDescription>
            Marque o que você estudou. A primeira revisão cai {settings.method === "fixo" ? describeSchedule(settings.schedule.slice(0, 1)) : "amanhã"}; as seguintes,{" "}
            {settings.method === "fixo" ? describeSchedule(settings.schedule.slice(1)) : "em intervalos que crescem a cada acerto"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="rev-date">Dia do estudo</Label>
            <Input id="rev-date" type="date" value={studiedOn} max={ymd(new Date())} onChange={(e) => setStudiedOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rev-search">Buscar tópico</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="rev-search" className="pl-8" placeholder="Ex.: cinemática, crase, logaritmo…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="max-h-[40vh] space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-3">
          {groups.length === 0 && <p className="p-3 text-center text-sm text-muted-foreground">Nenhuma matéria ativa.</p>}
          {groups.map((g) => {
            const ids = g.topics.map((t) => t.id);
            const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
            return (
              <div key={g.subject.id}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 font-display text-base font-semibold uppercase tracking-wide">
                    <Dot color={g.subject.color} /> {g.subject.name}
                  </p>
                  {ids.length > 0 && (
                    <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => toggleAll(ids, !allOn)}>
                      {allOn ? "Desmarcar todos" : `Marcar todos (${ids.length})`}
                    </button>
                  )}
                </div>
                {g.topics.length === 0 ? (
                  <p className="pl-5 text-xs text-muted-foreground">
                    {g.subject.topics?.length ? "Todos os tópicos já têm revisão agendada." : "Sem tópicos cadastrados. Use o assunto avulso abaixo ou adicione tópicos em Matérias."}
                  </p>
                ) : (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {g.topics.map((t) => (
                      <li key={t.id}>
                        <label className={cn("flex cursor-pointer items-start gap-2 rounded-md border bg-card px-2.5 py-2 text-sm transition-colors hover:bg-accent", selected.has(t.id) && "border-primary bg-primary/5")}>
                          <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} className="mt-0.5" />
                          <span className="min-w-0">
                            <span className="block leading-snug">{t.title}</span>
                            {t.status >= 2 && <Tag tone="success" className="mt-1">Estudado</Tag>}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-dashed p-3">
          <p className="eyebrow mb-2 text-muted-foreground">Assunto avulso (opcional)</p>
          <div className="grid gap-2 sm:grid-cols-[200px_1fr]">
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={freeSubject} onChange={(e) => setFreeSubject(e.target.value)} aria-label="Matéria do assunto avulso">
              {subjects.filter((s) => !s.archived).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Input placeholder="Ex.: Lista 3 de MRUV, aula 07 de crase…" value={freeTitle} onChange={(e) => setFreeTitle(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {total === 0 ? "Nada selecionado" : `${total} ${total === 1 ? "assunto" : "assuntos"} para revisar`}
          </p>
          <Button onClick={save} disabled={total === 0}>
            <CalendarPlus /> Agendar {total > 0 && `(${total})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
