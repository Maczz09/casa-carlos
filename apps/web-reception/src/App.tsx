import { useEffect, useState } from "react";
import type { Attribute, Category, RoomBoardEntry } from "@casacarlos/contracts";
import { useAuth } from "./hooks/useAuth.js";
import { useBoard } from "./hooks/useBoard.js";
import { api } from "./api.js";
import { LoginScreen } from "./components/LoginScreen.js";
import { Board } from "./components/Board.js";
import { ReceptionKioskPanel } from "./components/ReceptionKioskPanel.js";
import { RoomDetailDrawer } from "./components/RoomDetailDrawer.js";
import { CashboxPanel } from "./components/CashboxPanel.js";
import { ProductCatalog } from "./components/ProductCatalog.js";
import { DashboardPanel } from "./components/DashboardPanel.js";
import { NotificationsPanel } from "./components/NotificationsPanel.js";

export default function App() {
  const { user, loading, login, loginByPin, logout } = useAuth();
  const { floors, kioskSession, connected } = useBoard(!!user);
  const [selected, setSelected] = useState<RoomBoardEntry | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);
  const [cashboxOpen, setCashboxOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  useEffect(() => {
    if (!user) return;
    api.categories().then(setCategories);
    api.attributes().then(setAttributes);
  }, [user]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">Cargando…</div>;
  }

  if (!user) {
    return <LoginScreen onLogin={login} onLoginByPin={loginByPin} />;
  }

  const showKioskPanel = panelOpen || (kioskSession !== null && kioskSession.estado !== "ESPERA" && kioskSession.id !== dismissedSessionId);

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Casa Carlos</h1>
          <p className="text-xs text-slate-500">
            {connected ? <span className="text-emerald-400">● en vivo</span> : <span className="text-amber-400">● reconectando…</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPanelOpen(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + Nueva venta
          </button>
          <button onClick={() => setCashboxOpen(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
            Caja
          </button>
          <button onClick={() => setCatalogOpen(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
            Bodega
          </button>
          {user.rol === "ADMIN" && (
            <>
              <button onClick={() => setDashboardOpen(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
                Dashboard
              </button>
              <button onClick={() => setNotificationsOpen(true)} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
                Notificaciones
              </button>
            </>
          )}
          <span className="ml-2 text-sm text-slate-300">
            {user.nombres} {user.apellidos} · {user.rol}
          </span>
          <button onClick={logout} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
            Salir
          </button>
        </div>
      </header>

      <main className="p-6">
        <Board
          floors={floors}
          categories={categories}
          attributes={attributes}
          onSelectRoom={(entry) => (entry.estado === "DISPONIBLE" ? setPanelOpen(true) : setSelected(entry))}
        />
      </main>

      {showKioskPanel && (
        <ReceptionKioskPanel
          floors={floors}
          categories={categories}
          attributes={attributes}
          session={kioskSession}
          onClose={() => {
            setPanelOpen(false);
            if (kioskSession) setDismissedSessionId(kioskSession.id);
          }}
        />
      )}

      {selected && selected.estado !== "DISPONIBLE" && <RoomDetailDrawer entry={selected} onClose={() => setSelected(null)} />}
      {cashboxOpen && <CashboxPanel onClose={() => setCashboxOpen(false)} />}
      {catalogOpen && <ProductCatalog onClose={() => setCatalogOpen(false)} />}
      {dashboardOpen && <DashboardPanel onClose={() => setDashboardOpen(false)} />}
      {notificationsOpen && <NotificationsPanel onClose={() => setNotificationsOpen(false)} />}
    </div>
  );
}
