import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BookMarked,
  Brain,
  CalendarClock,
  CalendarDays,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Menu,
  RefreshCcw,
  Settings,
  Shield,
  StickyNote,
  Timer,
  Trophy,
} from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { logout } from "@netlify/identity";
import { bindStoreToUser, timerElapsedMs, useApp, useDueReviews } from "@/lib/store";
import { useIdentity, userDisplayName } from "@/lib/identity";
import { useRankingSync } from "@/lib/ranking";
import { ymd } from "@/lib/calc";
import { LoginScreen, RecoveryScreen } from "./LoginScreen";
import { useNow } from "@/hooks/use-now";
import { Onboarding } from "./Onboarding";
import { MonthlyReview } from "./MonthlyReview";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Timer; badge?: "reviews" };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { to: "/", label: "Painel", icon: LayoutDashboard },
      { to: "/cronometro", label: "Cronômetro", icon: Timer },
      { to: "/revisoes", label: "Revisões", icon: Brain, badge: "reviews" },
      { to: "/ciclos", label: "Ciclos", icon: RefreshCcw },
      { to: "/calendario", label: "Calendário", icon: CalendarDays },
    ],
  },
  {
    title: "Arsenal",
    items: [
      { to: "/materias", label: "Matérias", icon: BookMarked },
      { to: "/questoes", label: "Questões", icon: ListChecks },
      { to: "/livros", label: "Livros", icon: Library },
      { to: "/notas", label: "Notas", icon: StickyNote },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { to: "/agenda", label: "Agenda e histórico", icon: CalendarClock },
      { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
      { to: "/ranking", label: "Ranking", icon: Trophy },
    ],
  },
];

const SETTINGS: NavItem = { to: "/configuracoes", label: "Configurações", icon: Settings };
const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS];
const MOBILE_MAIN = ["/", "/cronometro", "/revisoes", "/calendario"];

function useThemeSync() {
  const theme = useApp((s) => s.profile?.theme ?? "system");
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}

function useStorageFullWarning() {
  useEffect(() => {
    const warn = () =>
      toast.error("O navegador ficou sem espaço para salvar seus dados.", {
        description: "As últimas mudanças podem não ter sido gravadas. Exporte um backup em Configurações e apague questões que não usa.",
        duration: 15000,
      });
    window.addEventListener("quartel:storage-full", warn);
    return () => window.removeEventListener("quartel:storage-full", warn);
  }, []);
}

function useReminders() {
  const reminders = useApp((s) => s.profile?.reminders);
  const fired = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!reminders) return;
    const check = () => {
      const now = new Date();
      const hm = format(now, "HH:mm");
      const day = format(now, "yyyy-MM-dd");
      const due = useApp.getState().reviews.filter((r) => r.status === "ativa" && r.due <= day).length;
      const items: [string | undefined, string][] = [
        [reminders.study, "Hora de iniciar o estudo!"],
        [reminders.review, due > 0 ? `Hora da revisão: ${due} ${due === 1 ? "assunto espera" : "assuntos esperam"} por você.` : "Hora da revisão diária."],
        [reminders.reading, "Hora da leitura diária."],
      ];
      for (const [t, msg] of items) {
        const key = `${day}-${t}-${msg}`;
        if (t && t === hm && !fired.current.has(key)) {
          fired.current.add(key);
          toast(msg);
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Quartel de Estudos", { body: msg });
          }
        }
      }
    };
    check();
    const id = window.setInterval(check, 20000);
    return () => window.clearInterval(id);
  }, [reminders]);
}

function TimerPill() {
  const timer = useApp((s) => s.timer);
  const now = useNow(1000);
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (timer.status === "parado" || path === "/cronometro") return null;
  const ms = timerElapsedMs(timer, now.getTime());
  const s = Math.floor(ms / 1000);
  const txt = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <Link
      to="/cronometro"
      className={cn(
        "fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-field px-4 py-2.5 text-primary-foreground shadow-lift md:bottom-6",
        timer.status === "rodando" && "animate-pulse-ring",
      )}
    >
      <Timer className="size-4" />
      <span className="tabular text-sm font-semibold">{txt}</span>
      <span className="text-xs opacity-80">{timer.status === "pausado" ? "pausado" : "estudando"}</span>
    </Link>
  );
}

function useDueCount() {
  const today = ymd(useNow(60000));
  return useDueReviews(today).queue.length;
}

function Badge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return (
    <span className={cn("tabular ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-brass px-1.5 text-[11px] font-bold leading-5 text-brass-foreground animate-pop", className)}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function NavLink({ item, onNavigate, due }: { item: NavItem; onNavigate?: (() => void) | undefined; due: number }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      activeOptions={{ exact: item.to === "/" }}
      className="group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      activeProps={{ className: "bg-sidebar-accent !text-sidebar-primary font-semibold [&>i]:opacity-100" }}
    >
      <i className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary opacity-0 transition-opacity" aria-hidden />
      <Icon className="size-4" />
      {item.label}
      {item.badge === "reviews" && <Badge n={due} />}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const due = useDueCount();
  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((g) => (
        <div key={g.title}>
          <p className="eyebrow mb-1 px-3 text-[10px] text-sidebar-foreground/45">{g.title}</p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((item) => (
              <NavLink key={item.to} item={item} onNavigate={onNavigate} due={due} />
            ))}
          </div>
        </div>
      ))}
      <div className="border-t border-sidebar-border pt-3">
        <NavLink item={SETTINGS} onNavigate={onNavigate} due={due} />
      </div>
    </nav>
  );
}

function Brand() {
  const profile = useApp((s) => s.profile);
  const examDays = profile?.examDate ? differenceInCalendarDays(parseISO(profile.examDate), new Date()) : null;
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="relative grid size-10 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-lift">
        <Shield className="size-5" />
        <i className="absolute -bottom-1 -right-1 size-2.5 rotate-45 bg-sidebar" aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold uppercase tracking-wider text-sidebar-foreground">Quartel</p>
        <p className="eyebrow text-sidebar-primary">
          Rumo ao {profile?.exam}
          {examDays !== null && examDays >= 0 && <span className="tabular ml-1.5 text-sidebar-foreground/60">· {examDays}d</span>}
        </p>
      </div>
    </div>
  );
}

function Account() {
  const { user } = useIdentity();
  return (
    <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent p-2.5 text-sidebar-foreground">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-bold uppercase text-sidebar-primary-foreground">
        {userDisplayName(user).slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-semibold">{userDisplayName(user)}</p>
        <p className="truncate text-[11px] text-sidebar-foreground/60">{user?.email}</p>
      </div>
      <button
        type="button"
        aria-label="Sair"
        title="Sair"
        className="grid size-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar hover:text-sidebar-foreground"
        onClick={async () => {
          try {
            await logout();
          } finally {
            window.location.href = "/";
          }
        }}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Shield className="size-6 animate-pulse text-primary" />
        <span className="eyebrow">{label}</span>
      </div>
    </div>
  );
}

/** Barra fixa do celular: nome da página atual e data. */
function MobileHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const now = useNow(60000);
  const label = useMemo(() => ALL_NAV.find((n) => (n.to === "/" ? path === "/" : path.startsWith(n.to)))?.label ?? "Quartel", [path]);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-2.5 text-sidebar-foreground md:hidden">
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-sidebar-primary" />
        <span className="font-display text-base font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="eyebrow text-sidebar-foreground/60">{format(now, "EEE, d MMM", { locale: ptBR })}</span>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready, callback } = useIdentity();
  if (!ready) return <Loading label="Verificando acesso…" />;
  if (!user) return <LoginScreen />;
  if (callback?.type === "recovery") return <RecoveryScreen />;
  return <AuthedShell key={user.id} userId={user.id} defaultName={userDisplayName(user)}>{children}</AuthedShell>;
}

function AuthedShell({ children, userId, defaultName }: { children: ReactNode; userId: string; defaultName: string }) {
  const [hydrated, setHydrated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useApp((s) => s.profile);
  useThemeSync();
  useStorageFullWarning();
  useReminders();
  useRankingSync(hydrated);

  useEffect(() => {
    bindStoreToUser(userId);
    const unsub = useApp.persist.onFinishHydration(() => setHydrated(true));
    void useApp.persist.rehydrate();
    if (useApp.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [userId]);

  if (!hydrated) return <Loading label="Carregando seus dados…" />;
  if (!profile) return <Onboarding defaultName={defaultName} />;

  return (
    <div className="relative z-[1] min-h-screen md:grid md:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 md:flex">
        <Brand />
        <NavLinks />
        <div className="mt-auto space-y-2">
          <p className="px-1 text-[11px] leading-snug text-sidebar-foreground/55">
            Dados salvos automaticamente neste aparelho. Faça backup em Configurações.
          </p>
          <Account />
        </div>
      </aside>

      <div className="min-w-0">
        <MobileHeader />
        <main className="min-w-0 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8 lg:px-10">{children}</main>
      </div>

      <MobileNav open={menuOpen} setOpen={setMenuOpen} />
      <TimerPill />
      <MonthlyReview />
    </div>
  );
}

function MobileNav({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const due = useDueCount();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-sidebar-border bg-sidebar md:hidden">
      {ALL_NAV.filter((n) => MOBILE_MAIN.includes(n.to)).map(({ to, label, icon: Icon, badge }) => (
        <Link
          key={to}
          to={to}
          activeOptions={{ exact: to === "/" }}
          className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] text-sidebar-foreground/70"
          activeProps={{ className: "!text-sidebar-primary font-semibold" }}
        >
          <Icon className="size-5" />
          {label}
          {badge === "reviews" && due > 0 && (
            <span className="tabular absolute right-[calc(50%-22px)] top-1 min-w-4 rounded-full bg-brass px-1 text-[10px] font-bold leading-4 text-brass-foreground">{due > 99 ? "99+" : due}</span>
          )}
        </Link>
      ))}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] text-sidebar-foreground/70">
          <Menu className="size-5" />
          Mais
        </SheetTrigger>
        <SheetContent side="left" className="w-72 overflow-y-auto border-sidebar-border bg-sidebar p-4">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="mb-6 mt-2">
            <Brand />
          </div>
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-6">
            <Account />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
