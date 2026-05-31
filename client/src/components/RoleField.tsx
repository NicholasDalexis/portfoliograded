/*
 * RoleField — target-role input with quick-select chips. The role is sent to
 * the audit so scoring is weighted to that field's hiring norms.
 */
interface Props {
  value: string;
  onChange: (v: string) => void;
}

const ROLES = [
  "Graphic Design",
  "Marketing",
  "Photography",
  "Creative Technologist",
  "Artist",
  "UX / Product Design",
  "Front-End Engineer",
  "Content / Copywriter",
  "Illustration",
  "Brand Strategy",
  "Film & Motion",
  "Architecture",
];

export function RoleField({ value, onChange }: Props) {
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Graphic Design, Photography, Creative Technologist…"
        className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-[oklch(0.82_0.12_75)] focus:ring-2 focus:ring-[oklch(0.86_0.12_80_/_0.4)]"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className="rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-white hover:text-foreground"
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
