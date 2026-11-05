import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { format } from "date-fns";
import { Bell, Brain, Download, Upload, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader, Panel } from "@/components/kit";
import { WeekdayPicker } from "@/components/WeekdayPicker";
import { ConfirmDelete } from "@/components/ConfirmDialog";
import { exportSnapshot, useApp, type AppData } from "@/lib/store";
import { EXAMS, type ExamId, type Profile, type ReviewSettings, type ThemePref } from "@/lib/types";
import { describeSchedule, parseSchedule, reviewSettingsOf, SCHEDULE_PRESETS, scheduleId } from "@/lib/review";
import { NativeSelect } from "@/components/NativeSelect";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Quartel de Estudos" },
      { name: "description", content: "Perfil, concurso, metas, tema, lembretes e backup dos seus dados." },
      { property: "og:title", content: "Configurações — Quartel de Estudos" },
      { property: "og:description", content: "Perfil, metas, lembretes e backup." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const profile = useApp((s) => s.profile)!;
  const { updateProfile, switchExam, importData, resetAll } = useApp.getState();
  const [p, setP] = useState<Profile>(profile);
  const [addSuggested, setAddSuggested] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [rev, setRev] = useState<ReviewSettings>(() => reviewSettingsOf(profile));
  const [scheduleText, setScheduleText] = useState(() => reviewSettingsOf(profile).schedule.join(", "));

  type NumKey = "weeklyHours" | "dailyHours" | "weeklyGoal" | "monthlyGoal" | "reviewMinutes" | "readingMinutes";
  const num = (k: NumKey) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: Math.max(0, Number(e.target.value)) });

  const save = () => {
    if (!p.name.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    if (p.exam !== profile.exam) switchExam(p.exam, addSuggested);
    const schedule = parseSchedule(scheduleText);
    if (rev.method === "fixo" && schedule.length === 0) {
      toast.error("Informe ao menos um intervalo de revisão (ex.: 1, 7, 30).");
      return;
    }
    const review: ReviewSettings = { ...rev, schedule: schedule.length ? schedule : rev.schedule };
    updateProfile({ ...p, name: p.name.trim(), examDate: p.examDate || undefined, review });
    setRev(review);
    setScheduleText(review.schedule.join(", "));
    toast.success("Configurações salvas.");
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportSnapshot(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `quartel-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Backup baixado.");
  };

  const onFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppData;
      if (!data || (data.version !== 1 && data.version !== 2) || !Array.isArray(data.subjects)) throw new Error("formato");
      setPending(data);
    } catch {
      toast.error("Arquivo inválido. Use um backup gerado por este app.");
    }
  };

  const askNotify = async () => {
    if (!("Notification" in window)) {
      toast.error("Este navegador não permite notificações.");
      return;
    }
    const r = await Notification.requestPermission();
    toast(r === "granted" ? "Notificações ativadas." : "Permissão negada — os lembretes aparecerão só dentro do app.");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Perfil" title="Configurações">
        <Button onClick={save}>Salvar alterações</Button>
      </PageHeader>

      <Panel title="Perfil e concurso">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Nome ou apelido</Label><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Data da prova</Label><Input type="date" value={p.examDate ?? ""} onChange={(e) => setP({ ...p, examDate: e.target.value || undefined })} /></div>
        </div>
        <div className="mt-4 space-y-2">
          <Label>Concurso-alvo</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXAMS.map((e: ExamId) => (
              <button key={e} type="button" onClick={() => setP({ ...p, exam: e })}
                className={cn("rounded-lg border-2 p-3 font-display text-xl font-bold uppercase", p.exam === e ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50")}>
                {e}
              </button>
            ))}
          </div>
          {p.exam !== profile.exam && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={addSuggested} onCheckedChange={(v) => setAddSuggested(!!v)} />
              Adicionar as matérias sugeridas do {p.exam} que ainda não tenho
            </label>
          )}
        </div>
      </Panel>

      <Panel title="Tempo e metas">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <F label="Horas líquidas/semana" v={p.weeklyHours} on={num("weeklyHours")} />
          <F label="Horas líquidas/dia" v={p.dailyHours} on={num("dailyHours")} />
          <F label="Meta semanal (h)" v={p.weeklyGoal} on={num("weeklyGoal")} />
          <F label="Meta mensal (h)" v={p.monthlyGoal} on={num("monthlyGoal")} />
          <F label="Revisão diária (min)" v={p.reviewMinutes} on={num("reviewMinutes")} />
          <F label="Leitura diária (min)" v={p.readingMinutes} on={num("readingMinutes")} />
        </div>
        <div className="mt-4 space-y-2">
          <Label>Dias em que estuda (os demais são descanso)</Label>
          <WeekdayPicker value={p.studyWeekdays} onChange={(v) => setP({ ...p, studyWeekdays: v })} />
        </div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Brain className="size-5 text-status-review" /> Revisões espaçadas</span>} description="Como o app marca as revisões de cada assunto estudado.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Método</Label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRev({ ...rev, method: "fixo" })}
                className={cn("rounded-lg border-2 p-3 text-left transition-colors", rev.method === "fixo" ? "border-primary bg-primary/5" : "hover:border-primary/40")}>
                <p className="font-display text-lg font-bold uppercase">Calendário fixo</p>
                <p className="text-xs text-muted-foreground">24h, 7 dias, 30 dias… O método clássico dos cursinhos. A nota ajusta a etapa.</p>
              </button>
              <button type="button" onClick={() => setRev({ ...rev, method: "adaptativo" })}
                className={cn("rounded-lg border-2 p-3 text-left transition-colors", rev.method === "adaptativo" ? "border-primary bg-primary/5" : "hover:border-primary/40")}>
                <p className="font-display text-lg font-bold uppercase">Adaptativo</p>
                <p className="text-xs text-muted-foreground">SM-2, o algoritmo do Anki: intervalos crescem rápido no que você domina e devagar no que erra.</p>
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Limite de revisões por dia</Label>
            <Input type="number" min={0} className="tabular" value={rev.dailyCap} onChange={(e) => setRev({ ...rev, dailyCap: Math.max(0, Math.round(Number(e.target.value))) })} />
            <p className="text-xs text-muted-foreground">0 = sem limite. O excedente fica para o dia seguinte; a fila mostra primeiro o que está mais perto de ser esquecido.</p>
            <label className="flex items-center gap-2 pt-1 text-sm">
              <Checkbox checked={rev.skipRestDays} onCheckedChange={(v) => setRev({ ...rev, skipRestDays: !!v })} /> Pular dias de descanso
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={rev.autoFromTopics} onCheckedChange={(v) => setRev({ ...rev, autoFromTopics: !!v })} /> Agendar sozinho ao marcar um tópico como "estudado"
            </label>
          </div>
        </div>
        {rev.method === "fixo" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div className="space-y-2">
              <Label>Modelo de calendário</Label>
              <NativeSelect value={SCHEDULE_PRESETS.find((pr) => pr.id === scheduleId(parseSchedule(scheduleText)))?.id ?? "custom"}
                onChange={(e) => { const pr = SCHEDULE_PRESETS.find((x) => x.id === e.target.value); if (pr) setScheduleText(pr.schedule.join(", ")); }}>
                {SCHEDULE_PRESETS.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                <option value="custom">Personalizado</option>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">{SCHEDULE_PRESETS.find((pr) => pr.id === scheduleId(parseSchedule(scheduleText)))?.help ?? "Intervalos definidos por você."}</p>
            </div>
            <div className="space-y-2">
              <Label>Intervalos em dias</Label>
              <Input value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} placeholder="1, 7, 30, 90" className="tabular" />
              <p className="text-xs text-muted-foreground">
                {parseSchedule(scheduleText).length ? `Revisões ${describeSchedule(parseSchedule(scheduleText))}; depois o intervalo dobra.` : "Escreva os dias separados por vírgula."}
              </p>
            </div>
          </div>
        )}
        {p.examDate && (
          <p className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            Com a data da prova informada, nenhum intervalo passa de 20% do tempo restante até ela (Cepeda et al., 2008), e nada é marcado depois da véspera.
          </p>
        )}
      </Panel>

      <Panel title="Aparência e lembretes">
        <div className="space-y-2">
          <Label>Tema</Label>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as ThemePref[]).map((t) => (
              <Button key={t} type="button" variant={p.theme === t ? "default" : "outline"}
                onClick={() => { setP({ ...p, theme: t }); updateProfile({ theme: t }); }}>
                {t === "light" ? "Claro" : t === "dark" ? "Escuro" : "Automático"}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {([["study", "Iniciar estudo"], ["review", "Revisão"], ["reading", "Leitura"]] as const).map(([k, label]) => (
            <div key={k} className="space-y-2">
              <Label>Lembrete: {label}</Label>
              <Input type="time" value={p.reminders[k] ?? ""} onChange={(e) => setP({ ...p, reminders: { ...p.reminders, [k]: e.target.value || undefined } })} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={askNotify}><Bell /> Permitir notificações</Button>
          <p className="text-xs text-muted-foreground">Os lembretes funcionam enquanto o app estiver aberto.</p>
        </div>
      </Panel>

      <Panel title="Backup dos dados">
        <p className="mb-4 text-sm text-muted-foreground">
          Seus dados (incluindo o banco de questões) ficam salvos neste aparelho. Baixe um backup regularmente para não perder nada se trocar de aparelho ou limpar o navegador.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson}><Download /> Exportar backup</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Importar backup</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
        </div>
        {pending && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-warning/15 p-3 text-sm">
            <AlertTriangle className="size-4 text-warning" />
            <span className="flex-1">Importar vai substituir todos os dados atuais ({pending.sessions.length} registros no arquivo).</span>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => { importData(pending); setPending(null); toast.success("Backup importado."); if (pending.profile) setP(pending.profile); }}>Confirmar importação</Button>
          </div>
        )}
        <div className="mt-6 border-t pt-4">
          <ConfirmDelete title="Apagar todos os dados?" description="Tudo será removido deste aparelho. Faça um backup antes." confirmLabel="Apagar tudo" onConfirm={resetAll}>
            <Button variant="destructive">Apagar todos os dados</Button>
          </ConfirmDelete>
        </div>
      </Panel>
    </div>
  );
}

function F({ label, v, on }: { label: string; v: number; on: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} step="0.5" value={v} onChange={on} className="tabular" />
    </div>
  );
}
