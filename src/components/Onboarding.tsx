import { useMemo, useState } from "react";
import { Shield, ChevronRight, ChevronLeft, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeekdayPicker } from "./WeekdayPicker";
import { buildSuggestedSubjects, pickColor, uid, useApp } from "@/lib/store";
import { EXAMS, type ExamId, type Profile, type Subject, type ThemePref } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Dot } from "./kit";

export function Onboarding({ defaultName = "" }: { defaultName?: string }) {
  const completeSetup = useApp((s) => s.completeSetup);
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>({
    name: defaultName,
    exam: "ITA",
    examDate: "",
    weeklyHours: 20,
    dailyHours: 4,
    studyWeekdays: [1, 2, 3, 4, 5, 6],
    weeklyGoal: 20,
    monthlyGoal: 80,
    reviewMinutes: 30,
    readingMinutes: 20,
    theme: "system",
    reminders: {},
  });
  const [subjects, setSubjects] = useState<Subject[]>(() => buildSuggestedSubjects("ITA"));
  const [newSubject, setNewSubject] = useState("");

  const pickExam = (exam: ExamId) => {
    setP({ ...p, exam });
    setSubjects(buildSuggestedSubjects(exam));
  };

  type NumKey = "weeklyHours" | "dailyHours" | "weeklyGoal" | "monthlyGoal" | "reviewMinutes" | "readingMinutes";
  const num = (k: NumKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setP({ ...p, [k]: Math.max(0, Number(e.target.value)) });

  const canNext = useMemo(() => {
    if (step === 0) return p.name.trim().length > 0;
    if (step === 1) return p.weeklyHours > 0 && p.dailyHours > 0 && p.studyWeekdays.length > 0;
    return subjects.length > 0;
  }, [step, p, subjects]);

  const finish = () => completeSetup({ ...p, name: p.name.trim(), examDate: p.examDate || undefined }, subjects);

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.2fr]">
      <aside className="bg-field relative hidden flex-col justify-between p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-brass text-brass-foreground">
            <Shield className="size-6" />
          </div>
          <span className="font-display text-2xl font-bold uppercase tracking-wider">Quartel de Estudos</span>
        </div>
        <div>
          <p className="eyebrow text-brass">Missão</p>
          <h1 className="mt-2 text-6xl font-bold uppercase leading-[0.95]">
            Disciplina hoje,
            <br />
            aprovação amanhã.
          </h1>
          <p className="mt-6 max-w-md text-primary-foreground/80">
            Organize ciclos, registre horas líquidas, acompanhe metas e treine questões para ITA, IME, EFOMM e EsPCEx.
            Seu progresso fica salvo na sua conta neste aparelho.
          </p>
        </div>
        <p className="eyebrow text-primary-foreground/60">Passo {step + 1} de 3</p>
      </aside>

      <main className="flex items-center justify-center p-5 md:p-10">
        <div className="w-full max-w-xl animate-rise">
          <p className="eyebrow text-brass lg:hidden">Quartel de Estudos · Passo {step + 1} de 3</p>
          {step === 0 && (
            <div className="space-y-6">
              <h2 className="text-4xl font-bold uppercase">Apresente-se</h2>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome ou apelido</Label>
                <Input id="nome" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Ex.: Cadete Silva" />
              </div>
              <div className="space-y-2">
                <Label>Concurso-alvo</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {EXAMS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => pickExam(e)}
                      className={cn(
                        "rounded-lg border-2 p-4 font-display text-2xl font-bold uppercase transition-all",
                        p.exam === e ? "border-primary bg-primary text-primary-foreground shadow-lift" : "bg-card hover:border-primary/50",
                      )}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data prevista da prova (opcional)</Label>
                <Input id="data" type="date" value={p.examDate} onChange={(e) => setP({ ...p, examDate: e.target.value })} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-4xl font-bold uppercase">Seu tempo</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Horas líquidas por semana" value={p.weeklyHours} onChange={num("weeklyHours")} />
                <Field label="Horas líquidas por dia" value={p.dailyHours} onChange={num("dailyHours")} />
              </div>
              <div className="space-y-2">
                <Label>Dias em que estuda</Label>
                <WeekdayPicker value={p.studyWeekdays} onChange={(v) => setP({ ...p, studyWeekdays: v })} />
                <p className="text-xs text-muted-foreground">
                  Os outros dias serão de descanso. Você pode mudar qualquer dia depois no calendário.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Meta semanal (h)" value={p.weeklyGoal} onChange={num("weeklyGoal")} />
                <Field label="Meta mensal (h)" value={p.monthlyGoal} onChange={num("monthlyGoal")} />
                <Field label="Revisão por dia (min)" value={p.reviewMinutes} onChange={num("reviewMinutes")} />
                <Field label="Leitura por dia (min)" value={p.readingMinutes} onChange={num("readingMinutes")} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-4xl font-bold uppercase">Matérias do {p.exam}</h2>
              <p className="text-sm text-muted-foreground">
                Sugerimos as matérias da prova. Remova ou adicione o que quiser — a dificuldade pode ser ajustada depois.
              </p>
              <div className="flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-2 rounded-full border bg-card py-1.5 pl-3 pr-1.5 text-sm">
                    <Dot color={s.color} />
                    {s.name}
                    <span className="tabular text-xs text-muted-foreground">{s.multiplier}X</span>
                    <button
                      type="button"
                      aria-label={`Remover ${s.name}`}
                      onClick={() => setSubjects(subjects.filter((x) => x.id !== s.id))}
                      className="grid size-6 place-items-center rounded-full hover:bg-muted"
                    >
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubject.trim()) return;
                  setSubjects([
                    ...subjects,
                    { id: uid(), name: newSubject.trim(), difficulty: 1, multiplier: 1, color: pickColor(subjects.length), notes: "", archived: false },
                  ]);
                  setNewSubject("");
                }}
              >
                <Input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="Adicionar matéria" />
                <Button type="submit" variant="outline"><Plus /> Adicionar</Button>
              </form>
              <div className="space-y-2">
                <Label>Tema visual</Label>
                <div className="flex gap-2">
                  {(["light", "dark", "system"] as ThemePref[]).map((t) => (
                    <Button key={t} type="button" variant={p.theme === t ? "default" : "outline"} onClick={() => setP({ ...p, theme: t })}>
                      {t === "light" ? "Claro" : t === "dark" ? "Escuro" : "Automático"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="mt-10 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
              <ChevronLeft /> Voltar
            </Button>
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
                Continuar <ChevronRight />
              </Button>
            ) : (
              <Button variant="brass" size="lg" onClick={finish} disabled={!canNext}>
                Começar a estudar
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} step="0.5" value={value} onChange={onChange} className="tabular" />
    </div>
  );
}
