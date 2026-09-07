/*
 * Sunlit Glass. Role field
 * Supported fields stay one tap away. Other reveals an optional custom field
 * and uses the existing general rubric when there is no supported match.
 */
import { useState } from "react";
import { ROLE_PRESETS } from "@/lib/audit";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function RoleField({ value, onChange, className }: Props) {
  const [otherSelected, setOtherSelected] = useState(
    () => !!value.trim() && !ROLE_PRESETS.some((p) => p.toLowerCase() === value.trim().toLowerCase()),
  );
  const pillClassName = (active: boolean) => cn(
    "min-h-11 rounded-full px-3.5 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-amber-700",
    "border backdrop-blur-md",
    active
      ? "border-[oklch(0.78_0.16_70_/_0.5)] bg-[oklch(0.86_0.16_75_/_0.22)] text-[oklch(0.28_0.05_55)]"
      : "border-[oklch(0.22_0.02_60_/_0.1)] bg-white/50 text-muted-foreground hover:bg-white/80 hover:text-foreground",
  );

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {ROLE_PRESETS.map((p) => {
          const active = !otherSelected && value.trim().toLowerCase() === p.toLowerCase();
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                setOtherSelected(false);
                onChange(p);
              }}
              aria-pressed={active}
              className={pillClassName(active)}
            >
              {p}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            if (!otherSelected) {
              setOtherSelected(true);
              onChange("");
            }
          }}
          aria-pressed={otherSelected}
          aria-expanded={otherSelected}
          aria-controls={otherSelected ? "portfolio-role-other" : undefined}
          className={pillClassName(otherSelected)}
        >
          Other
        </button>
      </div>
      {otherSelected ? (
        <div id="portfolio-role-other" className="space-y-2">
          <label htmlFor="portfolio-role" className="block text-sm font-semibold">
            Your field <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <input
            id="portfolio-role"
            type="text"
            value={value}
            maxLength={100}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. Architecture"
            className={cn(
              "w-full rounded-2xl bg-transparent px-5 py-4 text-base font-medium",
              "outline-none placeholder:text-muted-foreground/70",
              "border border-[oklch(0.22_0.02_60_/_0.12)] focus:border-[oklch(0.78_0.16_70_/_0.6)]",
              "focus:ring-4 focus:ring-[oklch(0.86_0.16_75_/_0.18)] transition-colors",
            )}
          />
        </div>
      ) : null}
    </div>
  );
}
