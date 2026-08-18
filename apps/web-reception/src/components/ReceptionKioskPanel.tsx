import { useEffect, useState, type ReactNode } from "react";
import type { Attribute, Category, FloorBoard, KioskSession, Modality, PaymentDetailInput, PaymentWithDetails } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { RoomIllustration } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { PaymentForm } from "./PaymentForm.js";

interface Props {
  floors: FloorBoard[];
  categories: Category[];
  attributes: Attribute[];
  session: KioskSession | null;
  onClose: () => void;
}

/** Mirrors + drives the kiosk session — see docs/REGLAS-DE-NEGOCIO.md §10. Either screen can act; this is reception's view of it. */
export function ReceptionKioskPanel({ floors, categories, attributes, session, onClose }: Props) {
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [modalidadId, setModalidadId] = useState("");
  const [bloques, setBloques] = useState(1);
  const [noches, setNoches] = useState(1);
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ nombres: "", apellidos: "", dni: "", telefono: "" });
  const [payment, setPayment] = useState<PaymentWithDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.modalities().then((list) => {
      setModalities(list);
      if (list[0]) setModalidadId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!session) setPayment(null);
  }, [session?.id]);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelKiosk();
    } finally {
      setBusy(false);
    }
  };

  const closeAfterDone = () => onClose();

  // ---- Sin sesión: elegir modalidad (RES-01, siempre el primer paso) ----
  if (!session) {
    const selected = modalities.find((m) => m.id === modalidadId);
    return (
      <Modal title="Nueva venta" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-400">Elige la modalidad — esto carga la pantalla del cliente.</p>
          <div className="flex flex-col gap-2">
            {modalities.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${modalidadId === m.id ? "border-emerald-500 bg-emerald-950/40" : "border-slate-600"}`}
              >
                <input type="radio" checked={modalidadId === m.id} onChange={() => setModalidadId(m.id)} />
                <div>
                  <p className="font-medium text-white">{m.nombre}</p>
                  <p className="text-xs text-slate-400">Tolerancia {m.toleranciaMin} min</p>
                </div>
              </label>
            ))}
          </div>
          {selected && !selected.checkinFijo && (
            <div className="flex items-center gap-3">
              <span className="text-slate-300">Bloques de {selected.duracionHoras}h</span>
              <Stepper value={bloques} onChange={setBloques} min={1} />
            </div>
          )}
          {selected?.checkinFijo && (
            <div className="flex items-center gap-3">
              <span className="text-slate-300">Noches</span>
              <Stepper value={noches} onChange={setNoches} min={1} />
            </div>
          )}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            disabled={busy || !modalidadId}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.startKiosk(modalidadId, bloques, noches);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "No se pudo iniciar la venta.");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Cargando…" : "Cargar en pantalla del cliente"}
          </button>
        </div>
      </Modal>
    );
  }

  // ---- Piso / cuarto: el cliente elige en el kiosco; recepción puede elegir por él (REC-03) ----
  if (session.estado === "SELECCION_PISO" || session.estado === "SELECCION_CUARTO") {
    const active = floors.find((f) => f.floor.id === (session.pisoId ?? activeFloorId)) ?? floors[0];
    const fanId = attributes.find((a) => a.nombre.toLowerCase().includes("ventilador"))?.id;

    return (
      <Modal title="Esperando al cliente" subtitle="Se está eligiendo el cuarto en el kiosco — también puedes elegirlo tú." onClose={cancel} busy={busy}>
        <div className="mb-4 flex gap-2">
          {floors.map((f) => (
            <button
              key={f.floor.id}
              onClick={async () => {
                setActiveFloorId(f.floor.id);
                setBusy(true);
                try {
                  await api.selectKioskFloor(f.floor.id);
                } finally {
                  setBusy(false);
                }
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${active?.floor.id === f.floor.id ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              {f.floor.nombre}
            </button>
          ))}
        </div>

        {session.pisoId ? (
          <div className="grid grid-cols-3 gap-3">
            {active?.rooms
              .filter((r) => r.estado === "DISPONIBLE")
              .map((entry) => {
                const categoria = categories.find((c) => c.id === entry.room.categoriaId);
                const hasFan = fanId ? (categoria?.atributoIds.includes(fanId) ?? false) : false;
                const precio = session.preciosPorCategoria[entry.room.categoriaId];
                return (
                  <button
                    key={entry.room.id}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        await api.selectKioskRoom(entry.room.id);
                      } catch (err) {
                        setError(err instanceof ApiError ? err.message : "No se pudo seleccionar el cuarto.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="overflow-hidden rounded-xl bg-slate-900 text-left ring-1 ring-slate-700 hover:ring-emerald-500"
                  >
                    <div className="aspect-[220/130] bg-slate-800 p-1.5">
                      <RoomIllustration beds={categoria?.camas ?? 1} hasFan={hasFan} floorFill="#F5F1E8" />
                    </div>
                    <div className="flex items-center justify-between p-2">
                      <span className="font-semibold text-white">{entry.room.numero}</span>
                      {precio !== undefined && <span className="text-sm text-emerald-400">{format(cents(precio))}</span>}
                    </div>
                  </button>
                );
              })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Elige un piso arriba, o espera a que el cliente lo haga en el kiosco.</p>
        )}
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </Modal>
    );
  }

  // ---- Datos del cliente — exclusivo de recepción (REC-04) ----
  if (session.estado === "DATOS_CLIENTE") {
    return (
      <Modal title="Datos del cliente" onClose={cancel} busy={busy}>
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            placeholder="Nombres"
            value={customer.nombres}
            onChange={(e) => setCustomer((c) => ({ ...c, nombres: e.target.value }))}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          />
          <input
            placeholder="Apellidos"
            value={customer.apellidos}
            onChange={(e) => setCustomer((c) => ({ ...c, apellidos: e.target.value }))}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          />
          <input
            placeholder="DNI"
            value={customer.dni}
            onChange={(e) => setCustomer((c) => ({ ...c, dni: e.target.value }))}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          />
          <input
            placeholder="Teléfono (opcional)"
            value={customer.telefono}
            onChange={(e) => setCustomer((c) => ({ ...c, telefono: e.target.value }))}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            disabled={busy || !customer.nombres || !customer.apellidos || !customer.dni}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.setKioskCustomer({ ...customer, telefono: customer.telefono || null });
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "No se pudo registrar al cliente.");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Confirmar cliente
          </button>
        </div>
      </Modal>
    );
  }

  // ---- Productos — paso opcional, el cliente elige en el kiosco; recepción solo mira y puede saltar por él. ----
  if (session.estado === "SELECCION_PRODUCTOS") {
    return (
      <Modal title="Cliente eligiendo productos" onClose={onClose} busy={busy}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <p className="text-sm text-slate-400">El cliente puede agregar productos desde el kiosco, o pasar directo a pagar.</p>
          <p className="text-2xl font-semibold text-white">{format(cents(session.totalCentimos ?? 0))}</p>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.finishKioskProducts();
              } finally {
                setBusy(false);
              }
            }}
            className="mt-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Continuar a pago
          </button>
        </div>
      </Modal>
    );
  }

  // ---- Selección de pago — el cliente ya vio el total; recepción registra el pago real.
  // PAGO_PENDIENTE aquí es la propuesta del cliente en el kiosco, no un Payment real todavía. ----
  if ((session.estado === "SELECCION_PAGO" || session.estado === "PAGO_PENDIENTE") && !payment) {
    return (
      <Modal title="Registrar pago" subtitle={session.propuestaPago ? "El cliente ya propuso cómo pagar — completa los códigos." : undefined} onClose={onClose}>
        <PaymentForm
          totalCentimos={session.totalCentimos ?? 0}
          proposedSplit={session.propuestaPago}
          busy={busy}
          onSubmit={async (detalles: PaymentDetailInput[]) => {
            setBusy(true);
            setError(null);
            try {
              const created = await api.createPayment(session.saleId!, detalles);
              setPayment(created);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago.");
            } finally {
              setBusy(false);
            }
          }}
        />
        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
      </Modal>
    );
  }

  if ((session.estado === "SELECCION_PAGO" || session.estado === "PAGO_PENDIENTE") && payment) {
    return (
      <Modal title="Confirmar pago" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
            {payment.detalles.map((d) => (
              <p key={d.id}>
                {d.metodo}: {format(cents(d.montoCentimos))}
                {d.codigoOperacion ? ` · código ${d.codigoOperacion}` : ""}
              </p>
            ))}
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.rejectPayment(payment.id, "Rechazado por recepción");
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "No se pudo rechazar el pago.");
                } finally {
                  setBusy(false);
                }
              }}
              className="flex-1 rounded-lg bg-rose-700 py-2.5 font-medium text-white hover:bg-rose-600 disabled:opacity-50"
            >
              Rechazar
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.acceptPayment(payment.id);
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "No se pudo aceptar el pago.");
                } finally {
                  setBusy(false);
                }
              }}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Aceptar pago
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (session.estado === "ACEPTADO") {
    return (
      <Modal title="Cuarto entregado" onClose={closeAfterDone}>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-4xl">✅</p>
          <p className="text-lg font-medium text-white">Venta confirmada</p>
          <button onClick={closeAfterDone} className="mt-2 rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white hover:bg-emerald-500">
            Listo
          </button>
        </div>
      </Modal>
    );
  }

  if (session.estado === "RECHAZADO") {
    return (
      <Modal title="Pago rechazado" onClose={closeAfterDone}>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <p className="text-4xl">⚠️</p>
          <p className="text-slate-300">{session.error ?? "El pago fue rechazado. El cuarto se liberó."}</p>
          <button onClick={closeAfterDone} className="mt-2 rounded-lg bg-slate-700 px-6 py-2.5 font-medium text-white hover:bg-slate-600">
            Cerrar
          </button>
        </div>
      </Modal>
    );
  }

  return null;
}

function Modal({ title, subtitle, onClose, busy, children }: { title: string; subtitle?: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-white disabled:opacity-40">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stepper({ value, onChange, min }: { value: number; onChange: (v: number) => void; min: number }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="h-8 w-8 rounded-full bg-slate-700 text-white hover:bg-slate-600">
        −
      </button>
      <span className="w-6 text-center text-white">{value}</span>
      <button onClick={() => onChange(value + 1)} className="h-8 w-8 rounded-full bg-slate-700 text-white hover:bg-slate-600">
        +
      </button>
    </div>
  );
}
