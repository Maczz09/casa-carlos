import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/*
 * Primitivos del sistema de diseño. Todo sale de los tokens de `index.css`
 * (bg-surface, text-ink, border-line, …) para que claro/oscuro funcione sin
 * que ningún componente tenga que saber en qué tema está.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Botones ---------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warn";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-hover shadow-sm",
  secondary: "bg-inset text-ink hover:bg-line border border-line",
  ghost: "text-muted hover:text-ink hover:bg-inset",
  danger: "bg-danger text-white hover:opacity-90 shadow-sm",
  warn: "bg-warn text-white hover:opacity-90 shadow-sm",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "px-3.5 py-2 text-sm gap-2 rounded-xl",
  lg: "px-5 py-2.5 text-sm gap-2 rounded-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({ variant = "secondary", size = "md", icon, block, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "active:scale-[0.97]",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------------- Superficies ---------------- */

export function Card({ className, children, delay }: { className?: string; children: ReactNode; delay?: number }) {
  return (
    <div
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cx("animate-fade-up rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]", className)}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  subtitle,
  actions,
  children,
  className,
  delay,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <Card className={className} delay={delay}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="animate-fade-up">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="animate-fade-up flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------- Datos ---------------- */

export function Badge({ tone = "tone-stone", children, className }: { tone?: string; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", tone, className)}>{children}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "tone-teal",
  delay,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: string;
  delay?: number;
}) {
  return (
    <Card delay={delay} className="p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
        </div>
        {icon && <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone)}>{icon}</span>}
      </div>
    </Card>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="animate-fade flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <span className="mb-1 grid h-12 w-12 place-items-center rounded-2xl bg-inset text-subtle">{icon}</span>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-lg", className)} />;
}

/* ---------------- Formularios ---------------- */

const FIELD =
  "w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink placeholder:text-subtle transition-colors " +
  "focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-50";

export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      {children}
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(FIELD, className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(FIELD, "cursor-pointer", className)}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(FIELD, "resize-y", className)} />;
}

/* ---------------- Navegación interna ---------------- */

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Array<{ id: T; label: string }>; active: T; onChange: (id: T) => void }) {
  return (
    <div className="inline-flex gap-1 rounded-xl border border-line bg-inset p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
            active === t.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Mensaje de error/success inline — reemplaza los `<p className="text-rose-400">` sueltos. */
export function Notice({ kind = "error", children }: { kind?: "error" | "warn" | "ok" | "info"; children: ReactNode }) {
  const tone = kind === "error" ? "tone-red" : kind === "warn" ? "tone-amber" : kind === "ok" ? "tone-teal" : "tone-sky";
  return <div className={cx("animate-fade rounded-xl px-3.5 py-2.5 text-sm", tone)}>{children}</div>;
}

/** Fila etiqueta/valor — para resúmenes de venta, caja, etc. */
export function Row({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className={cx("flex items-center justify-between gap-3 py-1", strong && "font-semibold")}>
      <span className="text-sm text-muted">{label}</span>
      <span className={cx("text-sm tabular-nums", tone ?? "text-ink")}>{value}</span>
    </div>
  );
}
