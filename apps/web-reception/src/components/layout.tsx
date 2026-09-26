import { useEffect, useState, type ReactNode } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import type { AppPermission, User } from "@casacarlos/contracts";
import {
  IconBed,
  IconBell,
  IconBox,
  IconCalendar,
  IconCash,
  IconChart,
  IconChevronRight,
  IconGrid,
  IconFileChart,
  IconLogout,
  IconMenu,
  IconMoon,
  IconPlus,
  IconReceipt,
  IconSliders,
  IconSun,
  IconTag,
  IconUsers,
  IconX,
} from "@casacarlos/ui";
import { cx } from "./ui.js";
import { useBrand } from "../hooks/useBrand.js";
import type { OperationalAlert } from "../hooks/useOperationalAlerts.js";
import type { Theme } from "../hooks/useTheme.js";
import { startAppTour, useFirstRunTour } from "./AppTour.js";

export interface NavEntry {
  id: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
  permission: AppPermission;
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
      { id: "tablero", label: "Tablero de cuartos", icon: <IconGrid className={ICON} />, permission: "BOARD_VIEW" },
      { id: "venta", label: "Nueva venta", icon: <IconPlus className={ICON} />, permission: "SALES_MANAGE" },
      { id: "reservas", label: "Reservas", icon: <IconCalendar className={ICON} />, permission: "RESERVATIONS_MANAGE" },
    ],
  },
  {
    title: "Gestión",
    items: [
      { id: "caja", label: "Caja", icon: <IconCash className={ICON} />, permission: "CASHBOX_MANAGE" },
      { id: "bodega", label: "Bodega", icon: <IconBox className={ICON} />, permission: "INVENTORY_MANAGE" },
      { id: "categorias", label: "Categorías", icon: <IconTag className={ICON} />, permission: "CATEGORIES_MANAGE" },
      { id: "cuartos-admin", label: "Cuartos", icon: <IconBed className={ICON} />, permission: "ROOMS_MANAGE" },
      { id: "comprobantes", label: "Comprobantes", icon: <IconReceipt className={ICON} />, permission: "BILLING_MANAGE" },
    ],
  },
  {
    title: "Administración",
    items: [
      { id: "dashboard", label: "Dashboard", icon: <IconChart className={ICON} />, permission: "DASHBOARD_VIEW" },
      { id: "reportes", label: "Reportes", icon: <IconFileChart className={ICON} />, permission: "REPORTS_EXPORT" },
      { id: "notificaciones", label: "Notificaciones", icon: <IconBell className={ICON} />, permission: "NOTIFICATIONS_MANAGE" },
      { id: "usuarios", label: "Usuarios", icon: <IconUsers className={ICON} />, permission: "USERS_MANAGE" },
      { id: "ajustes", label: "Ajustes", icon: <IconSliders className={ICON} />, permission: "SETTINGS_MANAGE" },
    ],
  },
];

export const NAV_LABEL: Record<string, string> = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])));

/* ---------------- Marca ---------------- */

/** Logo cargado por el hotel; si todavía no cargó ninguno, la casita de siempre. */
export function BrandMark({ className, logoUrl, nombre }: { className?: string; logoUrl: string | null; nombre: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={nombre} className={cx("h-full w-full rounded-[inherit] object-contain", className)} />;
  }
  return (
    <svg viewBox="0 0 20 20" className={cx("h-5 w-5", className)} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.6 10 3l7 5.6V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
      <path d="M7.6 17v-4.4h4.8V17" />
    </svg>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const brand = useBrand();
  return (
    <div data-tour="brand" className={cx("flex items-center gap-2.5 px-4 py-5", collapsed && "justify-center px-0")}>
      <span
        className={cx(
          "grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl shadow-sm",
          brand.logoUrl ? "bg-surface ring-1 ring-line" : "bg-brand text-brand-ink",
        )}
      >
        <BrandMark logoUrl={brand.logoUrl} nombre={brand.nombre} />
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-ink">{brand.nombre}</p>
          <p className="truncate text-[11px] leading-tight text-subtle">{brand.lema}</p>
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
      data-tour={entry.id}
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
  return (
    <>
      {mobileOpen && <div onClick={onCloseMobile} className="animate-fade fixed inset-0 z-40 bg-black/50 lg:hidden" />}

      <aside
        className={cx(
          "app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col border-r border-line bg-surface transition-all duration-300 ease-out",
          collapsed ? "lg:w-[76px]" : "lg:w-[260px]",
          "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Brand collapsed={collapsed} />

        <OverlayScrollbarsComponent defer options={{ scrollbars: { autoHide: "leave", autoHideDelay: 350, theme: "os-theme-casacarlos" } }} className="min-h-0 flex-1">
          <nav className="px-3 pb-4">
            {NAV.map((group) => {
              const items = group.items.filter((item) => user.permisos.includes(item.permission));
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
        </OverlayScrollbarsComponent>

        <div className={cx("border-t border-line-soft p-3", collapsed && "px-2")}>
          <div data-tour="profile" className={cx("flex items-center gap-2.5 rounded-xl bg-inset p-2.5", collapsed && "justify-center p-2")}>
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
  notificationsEnabled,
  onEnableNotifications,
  alerts,
  onDismissAlert,
  onStartTour,
}: {
  title: string;
  connected: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  onLogout: () => void;
  notificationsEnabled: boolean;
  onEnableNotifications: () => void;
  alerts: OperationalAlert[];
  onDismissAlert: (id: string) => void;
  onStartTour: () => void;
}) {
  const brandNombre = useBrand().nombre;
  const [alertsOpen, setAlertsOpen] = useState(false);
  return (
    <header className="app-topbar sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onToggleSidebar} className="hidden rounded-lg p-2 text-muted transition-colors hover:bg-inset hover:text-ink lg:block">
          <IconMenu className="h-5 w-5" />
        </button>
        <button onClick={onOpenMobile} className="rounded-lg p-2 text-muted transition-colors hover:bg-inset hover:text-ink lg:hidden">
          <IconMenu className="h-5 w-5" />
        </button>

        <div className="flex min-w-0 items-center gap-1.5 text-sm">
          <span className="hidden text-muted sm:inline">{brandNombre}</span>
          <IconChevronRight className="hidden h-3.5 w-3.5 text-subtle sm:inline" />
          <span className="truncate font-semibold text-ink">{title}</span>
        </div>
      </div>

      <div className="relative flex shrink-0 items-center gap-1.5">
        <span
          data-tour="live"
          className={cx(
            "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
            connected ? "tone-teal" : "tone-amber",
          )}
        >
          <span className={cx("h-1.5 w-1.5 rounded-full", connected ? "bg-current" : "bg-current animate-pulse")} />
          {connected ? "En vivo" : "Reconectando…"}
        </span>

        <button
          data-tour="alerts"
          onClick={() => setAlertsOpen((open) => !open)}
          title="Centro de avisos"
          aria-expanded={alertsOpen}
          className={cx("relative rounded-lg p-2 transition-colors hover:bg-inset", notificationsEnabled ? "text-brand" : "text-muted hover:text-ink")}
        >
          <IconBell className="h-5 w-5" />
          {(notificationsEnabled || alerts.length > 0) && <span className={cx("absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ring-2 ring-surface", alerts.length > 0 ? "bg-warn" : "bg-ok")} />}
        </button>

        {alertsOpen && (
          <section className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)]" aria-label="Centro de avisos">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div><p className="text-sm font-semibold text-ink">Centro de avisos</p><p className="text-xs text-muted">Cambios operativos recientes</p></div>
              <button onClick={() => setAlertsOpen(false)} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-inset hover:text-ink">Cerrar</button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {alerts.length === 0 ? <p className="px-2 py-5 text-center text-sm text-muted">No hay avisos pendientes.</p> : alerts.map((alert) => (
                <div key={alert.id} className="mb-1 rounded-xl bg-inset px-3 py-2.5 last:mb-0">
                  <div className="flex gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{alert.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{alert.message}</p></div><button onClick={() => onDismissAlert(alert.id)} className="shrink-0 text-xs text-muted hover:text-ink">Descartar</button></div>
                </div>
              ))}
            </div>
            <div className="border-t border-line p-2">
              <button onClick={onEnableNotifications} className="w-full rounded-xl bg-brand-soft px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/15">
                {notificationsEnabled ? "Avisos de Windows y sonido activados" : "Activar avisos de Windows y sonido"}
              </button>
            </div>
          </section>
        )}

        <button onClick={onStartTour} title="Guía del sistema" className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-muted transition-colors hover:bg-inset hover:text-ink">
          ?
        </button>

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
  notificationsEnabled,
  onEnableNotifications,
  alerts,
  onDismissAlert,
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
  notificationsEnabled: boolean;
  onEnableNotifications: () => void;
  alerts: OperationalAlert[];
  onDismissAlert: (id: string) => void;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("casacarlos.sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  useFirstRunTour(user);

  useEffect(() => {
    localStorage.setItem("casacarlos.sidebar", collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  return (
    <div className="min-h-[100dvh] bg-bg">
      <Sidebar
        user={user}
        active={active}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={onNavigate}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className={cx("flex min-h-[100dvh] flex-col transition-all duration-300 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]")}>
        <Topbar
          title={title}
          connected={connected}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
          onLogout={onLogout}
          notificationsEnabled={notificationsEnabled}
          onEnableNotifications={onEnableNotifications}
          alerts={alerts}
          onDismissAlert={onDismissAlert}
          onStartTour={() => startAppTour(user)}
        />
        <main className="flex-1 p-4 sm:p-6"><div className="mx-auto w-full max-w-[1880px]">{children}</div></main>
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
