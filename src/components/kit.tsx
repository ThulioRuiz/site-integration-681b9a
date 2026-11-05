import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Kit visual do "caderno de campanha": cabeçalhos com fio duplo, painéis de papel com fio de
 * latão, números em fonte condensada, carimbos e etiquetas. Use estes blocos antes de criar
 * um novo estilo de cartão.
 */

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="rule-double mb-6 flex flex-wrap items-end justify-between gap-4 pb-4 animate-rise">
      <div className="min-w-0">
        {eyebrow && (
          <p className="eyebrow flex items-center gap-2 text-brass">
            <i className="inline-block h-px w-6 bg-brass" aria-hidden />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-4xl font-bold uppercase leading-[0.95] tracking-tight md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

type PanelTone = "paper" | "field" | "muted" | "brass";

const PANEL_TONE: Record<PanelTone, string> = {
  paper: "hairline-brass border bg-card text-card-foreground shadow-card",
  field: "bg-field border border-primary-foreground/10 text-primary-foreground shadow-lift",
  muted: "border border-dashed bg-muted/50 text-foreground",
  brass: "bg-brass-gradient border border-brass-foreground/10 text-brass-foreground shadow-lift",
};

export function Panel({
  className,
  children,
  title,
  description,
  action,
  tone = "paper",
}: {
  className?: string;
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: PanelTone;
}) {
  return (
    <section className={cn("relative rounded-xl p-5 animate-rise", PANEL_TONE[tone], className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-lg font-semibold uppercase tracking-wide">
                <i className={cn("inline-block size-2 rotate-45", tone === "paper" ? "bg-brass" : "bg-current opacity-60")} aria-hidden />
                <span className="min-w-0">{title}</span>
              </h2>
            )}
            {description && <p className={cn("mt-0.5 text-xs", tone === "paper" || tone === "muted" ? "text-muted-foreground" : "opacity-75")}>{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type StatTone = "default" | "brass" | "field" | "alert" | "review" | "success";

const STAT_TONE: Record<StatTone, string> = {
  default: "border bg-card text-card-foreground shadow-card",
  brass: "border border-brass/40 bg-brass/10 text-foreground",
  field: "bg-field text-primary-foreground shadow-lift border border-primary-foreground/10",
  alert: "border border-destructive/40 bg-destructive/10 text-foreground",
  review: "border border-status-review/40 bg-status-review/10 text-foreground",
  success: "border border-success/40 bg-success/10 text-foreground",
};

export function Stat({
  label,
  value,
  hint,
  className,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  icon?: ReactNode;
  tone?: StatTone;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl p-4 animate-rise", STAT_TONE[tone], className)}>
      {icon && <div className={cn("absolute -right-2 -top-2 opacity-[0.08] [&_svg]:size-20", tone === "field" && "opacity-20")}>{icon}</div>}
      <p className={cn("eyebrow", tone === "field" ? "text-primary-foreground/70" : "text-muted-foreground")}>{label}</p>
      <p className="numeral mt-2 text-3xl md:text-4xl">{value}</p>
      {hint && <p className={cn("mt-1.5 text-xs", tone === "field" ? "text-primary-foreground/70" : "text-muted-foreground")}>{hint}</p>}
    </div>
  );
}

export function Bar({ value, className, color }: { value: number; className?: string | undefined; color?: string | undefined }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted shadow-ink", className)}>
      <div
        className="h-full rounded-full bg-primary transition-all duration-500"
        style={{ width: `${v}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full ring-2 ring-background", className)}
      style={{ background: color }}
    />
  );
}

export function Empty({ children, title, action, className }: { children: ReactNode; title?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid-paper rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground", className)}>
      {title && <p className="font-display text-xl font-semibold uppercase tracking-wide text-foreground">{title}</p>}
      <div className={cn(title && "mt-1")}>{children}</div>
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

type TagTone = "muted" | "brass" | "review" | "success" | "alert" | "warning" | "ink";

const TAG_TONE: Record<TagTone, string> = {
  muted: "bg-muted text-muted-foreground",
  brass: "bg-brass/20 text-foreground",
  review: "bg-status-review/20 text-foreground",
  success: "bg-success/15 text-success",
  alert: "bg-destructive/12 text-destructive",
  warning: "bg-warning/25 text-foreground",
  ink: "bg-foreground text-background",
};

export function Tag({ children, tone = "muted", className, title }: { children: ReactNode; tone?: TagTone; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", TAG_TONE[tone], className)}>
      {children}
    </span>
  );
}

export function Stamp({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("stamp text-xs text-brass", className)}>{children}</span>;
}

/** Rótulo de seção pequeno, com fio. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("eyebrow flex items-center gap-2 text-muted-foreground", className)}>
      <span>{children}</span>
      <i className="h-px flex-1 bg-border" aria-hidden />
    </p>
  );
}
