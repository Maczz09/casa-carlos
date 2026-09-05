import { useEffect, useState } from "react";
import type { Brand, Category, CollectionAccount } from "@casacarlos/contracts";
import { api } from "./api.js";
import { useKioskState } from "./hooks/useKioskState.js";
import { useInactivityReset } from "./hooks/useInactivityReset.js";
import { useTheme } from "./hooks/useTheme.js";
import { ThemeToggle } from "./components/ThemeToggle.js";
import { IdleScreen } from "./components/IdleScreen.js";
import { FloorScreen } from "./components/FloorScreen.js";
import { RoomScreen } from "./components/RoomScreen.js";
import { ProductsScreen } from "./components/ProductsScreen.js";
import { WaitingScreen } from "./components/WaitingScreen.js";
import { PaymentScreen } from "./components/PaymentScreen.js";
import { ResultScreen } from "./components/ResultScreen.js";

export default function App() {
  const { floors, products, session, connected } = useKioskState();
  const { theme, toggle } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [collectionAccounts, setCollectionAccounts] = useState<CollectionAccount[]>([]);
  // Nombre y logo que cargó el hotel. Hasta que llegue se usa el de fábrica:
  // que el servidor tarde no puede dejar la pantalla del huésped en blanco.
  const [brand, setBrandState] = useState<Brand>({ nombre: "Hospedaje Carlos", lema: "", logoUrl: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.categories().then(setCategories);
    api.collectionAccounts().then(setCollectionAccounts);
    api.brand().then(setBrandState).catch(() => {});
  }, []);

  useInactivityReset(session);

  const cancel = () => void api.reset();

  const renderScreen = () => {
    if (!connected && !session) return <IdleScreen brand={brand} />;
    if (!session || session.estado === "ESPERA") return <IdleScreen brand={brand} />;

    if (session.estado === "SELECCION_PISO") {
      return <FloorScreen floors={floors} onCancel={cancel} onSelect={(pisoId) => void api.selectFloor(pisoId)} />;
    }

    if (session.estado === "SELECCION_CUARTO") {
      const floor = floors.find((f) => f.floor.id === session.pisoId);
      if (!floor) return <WaitingScreen title="Un momento" subtitle="Cargando los cuartos de este piso…" />;
      return (
        <RoomScreen
          floor={floor}
          categories={categories}
          preciosPorCategoria={session.preciosPorCategoria}
          onCancel={cancel}
          onSelect={(cuartoId) => void api.selectRoom(cuartoId)}
        />
      );
    }

    if (session.estado === "DATOS_CLIENTE") {
      return <WaitingScreen title="Un momento" subtitle="Recepción está completando tu registro." />;
    }

    if (session.estado === "SELECCION_PRODUCTOS") {
      return (
        <ProductsScreen
          products={products}
          totalCentimos={session.totalCentimos ?? 0}
          onCancel={cancel}
          onAdd={(productoId) => api.addProduct(productoId)}
          onFinish={() => void api.finishProducts()}
        />
      );
    }

    if (session.estado === "SELECCION_PAGO") {
      return (
        <PaymentScreen
          totalCentimos={session.totalCentimos ?? 0}
          collectionAccounts={collectionAccounts}
          busy={busy}
          onCancel={cancel}
          onPropose={async (detalles) => {
            setBusy(true);
            try {
              await api.proposePayment(detalles);
            } finally {
              setBusy(false);
            }
          }}
        />
      );
    }

    if (session.estado === "PAGO_PENDIENTE") {
      return <WaitingScreen title="Confirmando tu pago" subtitle="El recepcionista está validando tu pago. Esto toma solo un momento." />;
    }

    const roomNumber = floors.flatMap((f) => f.rooms).find((r) => r.room.id === session.cuartoId)?.room.numero;

    if (session.estado === "ACEPTADO") return <ResultScreen accepted roomNumber={roomNumber} hotel={brand.nombre} />;
    if (session.estado === "RECHAZADO") return <ResultScreen accepted={false} hotel={brand.nombre} />;

    return <IdleScreen brand={brand} />;
  };

  return (
    <>
      <ThemeToggle theme={theme} onToggle={toggle} />
      {renderScreen()}
    </>
  );
}
