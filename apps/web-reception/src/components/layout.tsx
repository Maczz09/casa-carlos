import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@casacarlos/contracts";
import {
  IconBell,
  IconBox,
  IconCalendar,
  IconCash,
  IconChart,
  IconChevronRight,
  IconGrid,
  IconLogout,
  IconMenu,
  IconMoon,
  IconPlus,
  IconReceipt,
  IconSun,
  IconX,
} from "@casacarlos/ui";
import { cx } from "./ui.js";
import type { Theme } from "../hooks/useTheme.js";

export interface NavEntry {
  id: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavEntry[];
}

const ICON = "h-[18px] w-[18px]";

export const NAV: NavGroup[] = [
  {
    title: "Operación",
    items: [
      { id: "tablero", label: "Tablero de cuartos", icon: <IconGrid className={ICON} /> },
      { id: "venta", label: "Nueva venta", icon: <IconPlus className={ICON} /> },
      { id: "reservas", label: "Reservas", icon: <IconCalendar className={ICON} /> },
    ],
  },
  {
    title: "Gestión",
    items: [
      { id: "caja", label: "Caja", icon: <IconCash className={ICON} /> },
      { id: "bodega", label: "Bodega", icon: <IconBox className={ICON} /> },
      { id: "comprobantes", label: "Comprobantes", icon: <IconReceipt className={ICON} />, adminOnly: true },
    ],
  },
  {
    title: "Administración",
    items: [
      { id: "dashboard", label: "Dashboard", icon: <IconChart className={ICON} />, adminOnly: true },
      { id: "notificaciones", label: "Notificaciones", icon: <IconBell className={ICON} />, adminOnly: true },
    ],
  },
];

export const NAV_LABEL: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));

/* ---------------- Marca ---------------- */

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cx("flex items-center gap-2.5 px-4 py-5", collapsed && "justify-center px-0")}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.6 10 3l7 5.6V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
          <path d="M7.6 17v-4.4h4.8V17" />
        </svg>
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-ink">Casa Carlos</p>
          <p className="truncate text-[11px] leading-tight text-subtle">Sistema de hospedaje</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Sidebar ---------------- */

function NavButton({
  entry,
  active,
  collapsed,
  onClick,
}: {
  entry: NavEntry;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? entry.label : undefined}
      className={cx(
        "group relative flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all duration-150",
        collapsed ? "justify-center px-0" : "px-3",
        active ? "bg-brand-soft text-brand" : "text-muted hover:bg-inset hover:text-ink",
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand" />}
      <span className={cx("shrink-0 transition-transform duration-150", !active && "group-hover:scale-110")}>{entry.icon}</span>
      {!collapsed && <span className="truncate">{entry.label}</span>}
    </button>
  );
}

function Sidebar({
  user,
  active,
  collapsed,
  mobileOpen,
  onNavigate,
  onCloseMobile,
}: {
  user: User;
  active: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: (id: string) => void;
  onCloseMobile: () => void;
}) {
  const isAdmin = user.rol === "ADMIN";

  return (
    <>
      {mobileOpen && <div onClick={onCloseMobile} className="animate-fade fixed inset-0 z-40 bg-black/50 lg:hidden" />}

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-all duration-300 ease-out",
          collapsed ? "lg:w-[76px]" : "lg:w-[260px]",
          "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Brand collapsed={collapsed} />

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((group) => {
            const items = group.items.filter((i) => !i.adminOnly || isAdmin);
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="mb-5">
                {!collapsed && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-subtle">{group.title}</p>}
                <div className="flex flex-col gap-1">
                  {items.map((entry) => (
                    <NavButton
                      key={entry.id}
                      entry={entry}
                      active={active === entry.id}
                      collapsed={collapsed}
                      onClick={() => {
                        onNavigate(entry.id);
                        onCloseMobile();
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className={cx("border-t border-line-soft p-3", collapsed && "px-2")}>
          <div className={cx("flex items-center gap-2.5 rounded-xl bg-inset p-2.5", collapsed && "justify-center p-2")}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/15 text-xs font-bold text-brand">
              {user.nombres.charAt(0)}
              {user.apellidos.charAt(0)}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">
                  {user.nombres} {user.apellidos}
                </p>
                <p className="truncate text-[11px] text-subtle">{user.rol}</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

/* ---------------- Topbar ---------------- */

function Topbar({
  title,
  connected,
  theme,
  onToggleTheme,
  onToggleSidebar,
  onOpenMobile,
  onLogout,
}: {
  title: string;
  connected: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onToggleSidebar} className="hidden rounded-lg p-2 text-muted transition-colors hover:bg-inset hover:text-ink lg:block">
          <IconMenu className="h-5 w-5" />
        </button>
        <button onClick={onOpenMobile} className="rounded-lg p-2 text-muted transition-colors hover:bg-inset hover:text-ink lg:hidden">
          <IconMenu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="hidden text-muted sm:inline">Casa Carlos</span>
          <IconChevronRight className="hidden h-3.5 w-3.5 text-subtle sm:inline" />
          <span className="truncate font-semibold text-ink">{title}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={cx(
            "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
            connected ? "tone-teal" : "tone-amber",
          )}
        >
          <span className={cx("h-1.5 w-1.5 rounded-full", connected ? "bg-current" : "bg-current animate-pulse")} />
          {connected ? "En vivo" : "Reconectando…"}
        </span>

        <button
          onClick={onToggleTheme}
          title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
          className="rounded-lg p-2 text-muted transition-all duration-150 hover:bg-inset hover:text-ink active:scale-90"
        >
          {theme === "dark" ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
        </button>

        <button onClick={onLogout} title="Salir" className="rounded-lg p-2 text-muted transition-colors hover:bg-inset hover:text-danger">
          <IconLogout className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

/* ---------------- Shell ---------------- */

export function AppShell({
  user,
  active,
  title,
  connected,
  theme,
  onToggleTheme,
  onNavigate,
  onLogout,
  children,
}: {
  user: User;
  active: string;
  title: string;
  connected: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("casacarlos.sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("casacarlos.sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar
        user={user}
        active={active}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={onNavigate}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={cx("flex min-h-screen flex-col transition-all duration-300 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]")}>
        <Topbar
          title={title}
          connected={connected}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
          onLogout={onLogout}
        />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Cabecera de una vista de detalle (cuarto, comprobante) — con volver. */
export function DetailHeader({ title, subtitle, onBack, actions }: { title: string; subtitle?: ReactNode; onBack: () => void; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-lg border border-line bg-surface p-2 text-muted transition-colors hover:text-ink" title="Volver">
          <IconX className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
