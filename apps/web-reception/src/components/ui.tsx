import { cn } from "@casacarlos/ui/lib/utils";
import { Button as ShadButton } from "@casacarlos/ui/components/button";
import { Card as ShadCard } from "@casacarlos/ui/components/card";
import { Badge as ShadBadge } from "@casacarlos/ui/components/badge";
import { Input as ShadInput } from "@casacarlos/ui/components/input";
import { NativeSelect } from "@casacarlos/ui/components/native-select";
import { Textarea as ShadTextarea } from "@casacarlos/ui/components/textarea";
import { Label as ShadLabel } from "@casacarlos/ui/components/label";
import { Skeleton as ShadSkeleton } from "@casacarlos/ui/components/skeleton";
import { Alert as ShadAlert } from "@casacarlos/ui/components/alert";
import { IconAlertTriangle, IconCheck, IconInfo } from "@casacarlos/ui";
export { ModalFrame } from "@casacarlos/ui/components/modal-frame";
export { ConfirmDialog } from "@casacarlos/ui/components/confirm-dialog";
export { Checkbox } from "@casacarlos/ui/components/checkbox";
export { Switch } from "@casacarlos/ui/components/switch";
export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption } from "@casacarlos/ui/components/table";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/*
 * Primitivos del sistema de diseño. Todo sale de los tokens de `index.css`
 * (bg-surface, text-ink, border-line, …) para que claro/oscuro funcione sin
 * que ningún componente tenga que saber en qué tema está.
 */

export const cx = cn;

/* ---------------- Botones ---------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warn";
type ButtonSize = "sm" | "md" | "lg";





interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({ variant = "secondary", size = "md", icon, block, className, children, type = "button", ...rest }: ButtonProps) {
  return <ShadButton {...rest} type={type} variant={variant === "primary" ? "default" : variant === "danger" ? "destructive" : variant === "warn" ? "default" : variant === "secondary" ? "outline" : "ghost"} size={size === "md" ? "default" : size} className={cn("h-auto min-w-0 max-w-full shrink whitespace-normal rounded-xl", size === "sm" ? "min-h-8" : size === "lg" ? "min-h-10" : "min-h-9", variant === "warn" && "bg-warn text-white dark:text-brand-ink hover:bg-warn/90", block && "w-full", className)}>{icon}{children}</ShadButton>;
}

/* ---------------- Superficies ---------------- */

export function Card({ className, children, delay }: { className?: string; children: ReactNode; delay?: number }) {
  return <ShadCard style={delay ? {animationDelay: delay + "ms"} : undefined} className={cn("animate-fade-up block flex-row gap-0 rounded-2xl border-line p-0 shadow-[var(--shadow-card)]", className)}>{children}</ShadCard>;
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

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: string; actions?: ReactNode; icon?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5"><div className="animate-fade-up flex min-w-0 items-start gap-3">{icon && <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-brand/15 bg-brand-soft text-brand">{icon}</span>}<div><h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>{subtitle && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">{subtitle}</p>}</div></div>{actions && <div className="animate-fade-up flex max-w-full flex-wrap items-center gap-2">{actions}</div>}</div>;
}

/* ---------------- Datos ---------------- */

export function Badge({ tone = "tone-stone", children, className }: { tone?: string; children: ReactNode; className?: string }) { return <ShadBadge variant="secondary" className={cn("border-transparent px-2.5 text-[11px]", tone, className)}>{children}</ShadBadge>; }

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

export function Skeleton({ className }: { className?: string }) { return <ShadSkeleton className={cn("bg-inset", className)} />; }

/* ---------------- Formularios ---------------- */



export function Field({ label, hint, children }: { label?: string; hint?: string; children: ReactNode }) { return <ShadLabel className="flex flex-col items-stretch gap-1.5 text-sm font-normal">{label && <span className="text-xs font-medium text-muted">{label}</span>}{children}{hint && <span className="text-xs font-normal text-muted">{hint}</span>}</ShadLabel>; }

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) { return <ShadInput {...rest} className={cn("rounded-xl", className)} />; }

export function Select({ className, children, size, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) { return <NativeSelect {...rest} className={cn("rounded-xl", className)}>{children}</NativeSelect>; }

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <ShadTextarea {...rest} className={cn("resize-y rounded-xl", className)} />; }

/* ---------------- Navegación interna ---------------- */

export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: Array<{id: T; label: string}>; active: T; onChange: (id: T) => void }) {
  return <div className="max-w-full overflow-x-auto"><div role="group" aria-label="Vistas del módulo" className="inline-flex gap-1 rounded-xl border border-line bg-inset p-1">{tabs.map(t => <ShadButton key={t.id} type="button" variant="ghost" aria-pressed={active === t.id} onClick={() => onChange(t.id)} className={cn("h-8 rounded-lg px-3.5 text-xs", active === t.id ? "bg-surface text-ink shadow-sm hover:bg-surface" : "text-muted")}>{t.label}</ShadButton>)}</div></div>;
}

/** Mensaje de error/success inline — reemplaza los `<p className="text-rose-400">` sueltos. */
export function Notice({ kind = "error", children }: { kind?: "error" | "warn" | "ok" | "info"; children: ReactNode }) {
  const Icon = kind === "ok" ? IconCheck : kind === "info" ? IconInfo : IconAlertTriangle;
  return <ShadAlert role={kind === "error" ? "alert" : "status"} className={cn("animate-fade flex items-start gap-2 border-0 rounded-xl", kind === "error" ? "tone-red" : kind === "warn" ? "tone-amber" : kind === "ok" ? "tone-teal" : "tone-sky")}><Icon className="mt-0.5 h-4 w-4 shrink-0" /><div className="min-w-0 text-sm leading-relaxed">{children}</div></ShadAlert>;
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
