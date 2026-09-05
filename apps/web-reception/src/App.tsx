import { useEffect, useRef, useState } from "react";
import type { Category } from "@casacarlos/contracts";
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
import { ReservationsModule } from "./modules/ReservationsModule.js";
import { CashboxModule } from "./modules/CashboxModule.js";
import { InventoryModule } from "./modules/InventoryModule.js";
import { CategoriesModule } from "./modules/CategoriesModule.js";
import { RoomsModule } from "./modules/RoomsModule.js";
import { ComprobantesModule } from "./modules/ComprobantesModule.js";
import { DashboardModule } from "./modules/DashboardModule.js";
import { NotificationsModule } from "./modules/NotificationsModule.js";
import { SettingsModule } from "./modules/SettingsModule.js";

export default function App() {
  const { user, loading, login, loginByPin, logout } = useAuth();
  const { floors, kioskSession, connected } = useBoard(!!user);
  const { segment, param, navigate } = useHashRoute();
  const { theme, toggle } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
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
      <div className="grid min-h-screen place-items-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="text-sm text-muted">Cargando…</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={login} onLoginByPin={loginByPin} />;

  const active = segment === "" ? "tablero" : segment === "cuarto" ? "tablero" : segment;
  const title = segment === "cuarto" ? "Detalle del cuarto" : (NAV_LABEL[active] ?? "Tablero de cuartos");

  const render = () => {
    switch (segment) {
      case "cuarto":
        return <RoomDetailModule roomId={param} floors={floors} onBack={() => navigate("/tablero")} />;
      case "venta":
        return <SaleModule floors={floors} categories={categories} session={kioskSession} onDone={() => navigate("/tablero")} />;
      case "reservas":
        return <ReservationsModule floors={floors} />;
      case "caja":
        return <CashboxModule />;
      case "bodega":
        return <InventoryModule role={user.rol} onManageCategories={() => navigate("/categorias")} />;
      case "categorias":
        return user.rol === "ADMIN" ? <CategoriesModule /> : <InventoryModule role={user.rol} onManageCategories={() => navigate("/categorias")} />;
      case "cuartos-admin":
        return <RoomsModule floors={floors} onCatalogChanged={reloadCategories} />;
      case "comprobantes":
        return <ComprobantesModule />;
      case "dashboard":
        return <DashboardModule onGoToInventory={() => navigate("/bodega")} />;
      case "notificaciones":
        return <NotificationsModule />;
      case "ajustes":
        return user.rol === "ADMIN" ? <SettingsModule /> : <BoardModule floors={floors} categories={categories} onSelectRoom={(entry) => navigate(`/cuarto/${entry.room.id}`)} onNewSale={() => navigate("/venta")} />;
      default:
        return (
          <BoardModule
            floors={floors}
            categories={categories}
            onSelectRoom={(entry) => (entry.estado === "DISPONIBLE" ? navigate("/venta") : navigate(`/cuarto/${entry.room.id}`))}
            onNewSale={() => navigate("/venta")}
          />
        );
    }
  };

  return (
    <AppShell
      user={user}
      active={active}
      title={title}
      connected={connected}
      theme={theme}
      onToggleTheme={toggle}
      onNavigate={(id) => navigate(`/${id}`)}
      onLogout={logout}
    >
      {render()}
    </AppShell>
  );
}
