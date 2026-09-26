import { Component, lazy, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { AppPermission, Category } from "@casacarlos/contracts";
import { useAuth } from "./hooks/useAuth.js";
import { useBoard } from "./hooks/useBoard.js";
import { useTheme } from "./hooks/useTheme.js";
import { useHashRoute } from "./hooks/useHashRoute.js";
import { api } from "./api.js";
import { LoginScreen } from "./components/LoginScreen.js";
import { AppShell, NAV_LABEL } from "./components/layout.js";
import { BoardModule } from "./modules/BoardModule.js";
import { RoomDetailModule } from "./modules/RoomDetailModule.js";
import { SaleModule } from "./modules/SaleModule.js";
import { InventoryModule } from "./modules/InventoryModule.js";
import { CategoriesModule } from "./modules/CategoriesModule.js";
import { RoomsModule } from "./modules/RoomsModule.js";
import { ComprobantesModule } from "./modules/ComprobantesModule.js";
import { NotificationsModule } from "./modules/NotificationsModule.js";
import { SettingsModule } from "./modules/SettingsModule.js";
import { UsersModule } from "./modules/UsersModule.js";
import { Card, EmptyState } from "./components/ui.js";
import { OperationalAlerts } from "./components/OperationalAlerts.js";
import { useOperationalAlerts } from "./hooks/useOperationalAlerts.js";
import { PaymentCelebration } from "./components/PaymentCelebration.js";

// Calendario, gráficos y hoja de cálculo son módulos pesados. Se descargan
// solo cuando el usuario entra a esas vistas para que el tablero inicial abra
// rápido incluso en una PC de recepción modesta.
const ReservationsModule = lazy(() => import("./modules/ReservationsModule.js").then((module) => ({ default: module.ReservationsModule })));
const CashboxModule = lazy(() => import("./modules/CashboxModule.js").then((module) => ({ default: module.CashboxModule })));
const DashboardModule = lazy(() => import("./modules/DashboardModule.js").then((module) => ({ default: module.DashboardModule })));
const ReportsModule = lazy(() => import("./modules/ReportsModule.js").then((module) => ({ default: module.ReportsModule })));

class ModuleErrorBoundary extends Component<{ route: string; children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ui] módulo no disponible", error, info.componentStack);
  }

  override componentDidUpdate(previous: Readonly<{ route: string; children: ReactNode }>) {
    if (previous.route !== this.props.route && this.state.error) this.setState({ error: null });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <Card className="p-8">
        <EmptyState
          title="No pudimos abrir este módulo"
          hint="Volvé a intentarlo en unos segundos. Si el sistema se está actualizando, el servicio terminará de reiniciar automáticamente."
          action={<button className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-ink" onClick={() => this.setState({ error: null })}>Reintentar</button>}
        />
      </Card>
    );
  }
}

export default function App() {
  const { user, loading, login, loginByPin, register, logout } = useAuth();
  const { floors, kioskSession, connected } = useBoard(!!user);
  const { segment, param, navigate } = useHashRoute();
  const { theme, toggle } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const operationalAlerts = useOperationalAlerts(floors, !!user);
  const handledSessionId = useRef<string | null>(null);
  const sawFirstSession = useRef(false);

  const reloadCategories = () => api.categories().then(setCategories);

  useEffect(() => {
    if (!user) return;
    reloadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Una sesión de kiosco nueva trae al recepcionista al módulo de venta: es la
  // contraparte de que el cliente ya está operando la otra pantalla. Solo una vez
  // por sesión, para no secuestrar la navegación si se sale a propósito.
  //
  // La sesión que YA estaba viva al abrir la app no redirige: si se entró por un
  // enlace directo (#/cuarto/…), mandarlo a /venta al recargar pisaría lo que el
  // usuario pidió ver.
  useEffect(() => {
    if (!kioskSession || kioskSession.estado === "ESPERA") return;
    if (kioskSession.id === handledSessionId.current) return;
    const isFirst = !sawFirstSession.current;
    sawFirstSession.current = true;
    handledSessionId.current = kioskSession.id;
    if (!isFirst) navigate("/venta");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kioskSession?.id, kioskSession?.estado]);

  if (loading) {
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="text-sm text-muted">Cargando…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={login} onLoginByPin={loginByPin} onRegister={register} />;

  const active = segment === "" ? "tablero" : segment === "cuarto" ? "tablero" : segment;
  const title = segment === "cuarto" ? "Detalle del cuarto" : (NAV_LABEL[active] ?? "Tablero de cuartos");

  const render = () => {
    const can = (permission: AppPermission) => user.permisos.includes(permission);
    const denied = () => (
      <Card className="p-8">
        <EmptyState title="Acceso restringido" hint="Tu cuenta no tiene permiso para abrir este módulo. Un administrador puede habilitarlo en Usuarios." />
      </Card>
    );
    switch (segment) {
      case "cuarto":
        return can("BOARD_VIEW") ? <RoomDetailModule roomId={param} floors={floors} onBack={() => navigate("/tablero")} /> : denied();
      case "venta":
        return can("SALES_MANAGE") ? <SaleModule floors={floors} categories={categories} session={kioskSession} onDone={() => navigate("/tablero")} /> : denied();
      case "reservas":
        return can("RESERVATIONS_MANAGE") ? <ReservationsModule floors={floors} /> : denied();
      case "caja":
        return can("CASHBOX_MANAGE") ? <CashboxModule /> : denied();
      case "bodega":
        return can("INVENTORY_MANAGE") ? <InventoryModule role={user.rol} onManageCategories={() => navigate("/categorias")} /> : denied();
      case "categorias":
        return can("CATEGORIES_MANAGE") ? <CategoriesModule /> : denied();
      case "cuartos-admin":
        return can("ROOMS_MANAGE") ? <RoomsModule floors={floors} onCatalogChanged={reloadCategories} /> : denied();
      case "comprobantes":
        return can("BILLING_MANAGE") ? <ComprobantesModule /> : denied();
      case "dashboard":
        return can("DASHBOARD_VIEW") ? <DashboardModule onGoToInventory={() => navigate("/bodega")} /> : denied();
      case "reportes":
        return can("REPORTS_EXPORT") ? <ReportsModule /> : denied();
      case "notificaciones":
        return can("NOTIFICATIONS_MANAGE") ? <NotificationsModule /> : denied();
      case "usuarios":
        return can("USERS_MANAGE") ? <UsersModule currentUser={user} /> : denied();
      case "ajustes":
        return can("SETTINGS_MANAGE") ? <SettingsModule /> : denied();
      default:
        return can("BOARD_VIEW") ? (
          <BoardModule
            floors={floors}
            categories={categories}
            onSelectRoom={(entry) => (entry.estado === "DISPONIBLE" ? navigate("/venta") : navigate(`/cuarto/${entry.room.id}`))}
            onNewSale={() => navigate("/venta")}
          />
        ) : denied();
    }
  };

  return (
    <>
      <AppShell
        user={user}
        active={active}
        title={title}
        connected={connected}
        theme={theme}
        onToggleTheme={toggle}
        onNavigate={(id) => navigate(`/${id}`)}
        onLogout={logout}
        notificationsEnabled={operationalAlerts.notificationsEnabled}
        onEnableNotifications={() => void operationalAlerts.enableNotifications()}
        alerts={operationalAlerts.alerts}
        onDismissAlert={operationalAlerts.dismiss}
      >
        <ModuleErrorBoundary route={`${segment}/${param ?? ""}`}>
          <Suspense
            fallback={(
              <div className="grid min-h-64 place-items-center">
                <div className="flex items-center gap-3 text-sm text-muted">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
                  Preparando módulo…
                </div>
              </div>
            )}
          >
            {render()}
          </Suspense>
        </ModuleErrorBoundary>
      </AppShell>
      <OperationalAlerts alerts={operationalAlerts.alerts} onDismiss={operationalAlerts.dismiss} />
      <PaymentCelebration />
    </>
  );
}
