import { WEEKDAYS_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function WeekdayPicker({
  value,
  onChange,
  tone = "primary",
}: {
  value: number[];
  onChange: (v: number[]) => void;
  tone?: "primary" | "rest";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAYS_SHORT.map((d, i) => {
        const on = value.includes(i);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort())}
            className={cn(
              "h-9 min-w-11 rounded-md border px-2 text-sm font-medium transition-colors",
              on
                ? tone === "primary"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-status-rest bg-status-rest text-foreground"
                : "bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
