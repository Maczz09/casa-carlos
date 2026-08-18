import { useEffect, useState } from "react";
import type { Attribute, Category, CollectionAccount } from "@casacarlos/contracts";
import { api } from "./api.js";
import { useKioskState } from "./hooks/useKioskState.js";
import { useInactivityReset } from "./hooks/useInactivityReset.js";
import { IdleScreen } from "./components/IdleScreen.js";
import { FloorScreen } from "./components/FloorScreen.js";
import { RoomScreen } from "./components/RoomScreen.js";
import { WaitingScreen } from "./components/WaitingScreen.js";
import { PaymentScreen } from "./components/PaymentScreen.js";
import { ResultScreen } from "./components/ResultScreen.js";

export default function App() {
  const { floors, session, connected } = useKioskState();
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [collectionAccounts, setCollectionAccounts] = useState<CollectionAccount[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.categories().then(setCategories);
    api.attributes().then(setAttributes);
    api.collectionAccounts().then(setCollectionAccounts);
  }, []);

  useInactivityReset(session);

  if (!connected && !session) {
    return <IdleScreen />;
  }

  if (!session || session.estado === "ESPERA") {
    return <IdleScreen />;
  }

  const cancel = () => void api.reset();

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
        attributes={attributes}
        preciosPorCategoria={session.preciosPorCategoria}
        onCancel={cancel}
        onSelect={(cuartoId) => void api.selectRoom(cuartoId)}
      />
    );
  }

  if (session.estado === "DATOS_CLIENTE") {
    return <WaitingScreen title="Un momento" subtitle="Recepción está completando tu registro." />;
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

  if (session.estado === "ACEPTADO") return <ResultScreen accepted roomNumber={roomNumber} />;
  if (session.estado === "RECHAZADO") return <ResultScreen accepted={false} />;

  return <IdleScreen />;
}
