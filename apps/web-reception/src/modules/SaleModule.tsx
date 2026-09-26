import { useEffect, useState } from "react";
import type { Category, FloorBoard, KioskSession, Modality, PaymentDetailInput, PaymentWithDetails, SaleWithLines } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconCheck, IconX, RoomIllustration } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { PaymentForm } from "../components/PaymentForm.js";
import { ProductPicker } from "../components/ProductPicker.js";
import { Button, Card, EmptyState, Field, Input, Notice, PageHeader, Row, Section, cx } from "../components/ui.js";

interface Props {
  floors: FloorBoard[];
  categories: Category[];
  session: KioskSession | null;
  onDone: () => void;
}

const STEPS = ["Modalidad", "Cuarto", "Datos", "Productos", "Pago"] as const;

function stepIndex(session: KioskSession | null): number {
  if (!session || session.estado === "ESPERA") return 0;
  switch (session.estado) {
    case "SELECCION_PISO":
    case "SELECCION_CUARTO":
      return 1;
    case "DATOS_CLIENTE":
      return 2;
    case "SELECCION_PRODUCTOS":
      return 3;
    default:
      return 4;
  }
}

function Stepper({ current }: { current: number }) {
  return (
    <Card className="mb-5 p-4">
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={label} className="flex shrink-0 items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition-all duration-300",
                    done ? "bg-brand text-brand-ink" : active ? "bg-brand-soft text-brand ring-2 ring-brand" : "bg-inset text-subtle",
                  )}
                >
                  {done ? <IconCheck className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cx("whitespace-nowrap text-sm", active ? "font-semibold text-ink" : done ? "text-muted" : "text-subtle")}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <span className={cx("h-px w-8 transition-colors duration-300", done ? "bg-brand" : "bg-line")} />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function SaleModule({ floors, categories, session, onDone }: Props) {
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [modalidadId, setModalidadId] = useState("");
  const [bloques, setBloques] = useState(1);
  const [noches, setNoches] = useState(1);
  const [customer, setCustomer] = useState({ nombres: "", apellidos: "", dni: "", telefono: "" });
  const [payment, setPayment] = useState<PaymentWithDetails | null>(null);
  const [productSale, setProductSale] = useState<SaleWithLines | null>(null);
  const [wantsProducts, setWantsProducts] = useState<boolean | null>(null);
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

  useEffect(() => {
    if (session?.estado !== "SELECCION_PRODUCTOS") {
      setWantsProducts(null);
    } else if (session?.wantsProducts === true) {
      setWantsProducts(true);
    }
  }, [session?.estado, session?.wantsProducts]);


  useEffect(() => {
    if (session?.estado !== "SELECCION_PRODUCTOS" || !session.saleId) {
      setProductSale(null);
      return;
    }
    api.getSale(session.saleId).then(setProductSale);
  }, [session?.estado, session?.saleId, session?.totalCentimos]);

  const cancel = async () => {
    setBusy(true);
    try {
      await api.cancelKiosk();
    } finally {
      setBusy(false);
    }
  };

  const selected = modalities.find((m) => m.id === modalidadId);
  const current = stepIndex(session);

  /* ---------- Paso 1: modalidad ---------- */
  if (!session || session.estado === "ESPERA") {
    return (
      <>
        <PageHeader title="Nueva venta" subtitle="Elegí la modalidad — esto carga la pantalla del cliente en el kiosco" />
        <Stepper current={0} />

        <Section title="Modalidad" className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {modalities.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModalidadId(m.id)}
                  className={cx(
                    "rounded-xl border p-4 text-left transition-all duration-150 active:scale-[0.98]",
                    modalidadId === m.id ? "border-brand bg-brand-soft" : "border-line hover:border-brand/50 hover:bg-inset",
                  )}
                >
                  <p className={cx("font-medium", modalidadId === m.id ? "text-brand" : "text-ink")}>{m.nombre}</p>
                  <p className="mt-0.5 text-xs text-muted">Tolerancia {m.toleranciaMin} min</p>
                </button>
              ))}
            </div>

            {selected && !selected.checkinFijo && (
              <Field label={`Bloques de ${selected.duracionHoras}h`}>
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => setBloques(Math.max(1, bloques - 1))}>
                    −
                  </Button>
                  <span className="w-8 text-center text-lg font-semibold tabular-nums text-ink">{bloques}</span>
                  <Button size="sm" onClick={() => setBloques(bloques + 1)}>
                    +
                  </Button>
                </div>
              </Field>
            )}

            {selected?.checkinFijo && (
              <Field label="Noches">
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={() => setNoches(Math.max(1, noches - 1))}>
                    −
                  </Button>
                  <span className="w-8 text-center text-lg font-semibold tabular-nums text-ink">{noches}</span>
                  <Button size="sm" onClick={() => setNoches(noches + 1)}>
                    +
                  </Button>
                </div>
              </Field>
            )}

            {error && <Notice>{error}</Notice>}

            <Button
              variant="primary"
              size="lg"
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
            >
              {busy ? "Cargando…" : "Cargar en pantalla del cliente"}
            </Button>
          </div>
        </Section>
      </>
    );
  }

  /* ---------- Paso 2: piso / cuarto ---------- */
  if (session.estado === "SELECCION_PISO" || session.estado === "SELECCION_CUARTO") {
    const active = floors.find((f) => f.floor.id === session.pisoId) ?? floors[0];

    return (
      <>
        <PageHeader
          title="Elegir cuarto"
          subtitle="El cliente está eligiendo en el kiosco — también podés elegir por él"
          actions={
            <Button variant="danger" onClick={cancel} disabled={busy}>
              Cancelar venta
            </Button>
          }
        />
        <Stepper current={current} />

        <Section title="Pisos">
          <div className="mb-4 flex flex-wrap gap-2">
            {floors.map((f) => (
              <button
                key={f.floor.id}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.selectKioskFloor(f.floor.id);
                  } finally {
                    setBusy(false);
                  }
                }}
                className={cx(
                  "rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95",
                  active?.floor.id === f.floor.id ? "bg-brand-soft text-brand" : "text-muted hover:bg-inset hover:text-ink",
                )}
              >
                {f.floor.nombre}
              </button>
            ))}
          </div>

          {session.pisoId ? (
            <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {active?.rooms
                .filter((r) => r.estado === "DISPONIBLE")
                .map((entry, i) => {
                  const categoria = categories.find((c) => c.id === entry.room.categoriaId);
                  const precio = session.preciosPorCategoria[entry.room.categoriaId];
                  return (
                    <button
                      key={entry.room.id}
                      disabled={busy}
                      style={{ ["--i" as string]: i }}
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
                      className="overflow-hidden rounded-xl border border-line bg-surface text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-[var(--shadow-pop)]"
                    >
                      <div className="aspect-[220/100] bg-inset/60 p-1">
                        <RoomIllustration beds={categoria?.camas ?? 1} fans={categoria?.ventiladores ?? 0} floorFill="var(--room-floor-teal)" />
                      </div>
                      <div className="flex items-center justify-between px-2.5 py-1.5">
                        <span className="text-sm font-semibold text-ink">C. {entry.room.numero}</span>
                        {precio !== undefined && <span className="text-xs font-semibold text-brand">{format(cents(precio))}</span>}
                      </div>
                    </button>
                  );
                })}
            </div>
          ) : (
            <EmptyState title="Elegí un piso" hint="O esperá a que el cliente lo elija desde el kiosco." />
          )}

          {error && (
            <div className="mt-4">
              <Notice>{error}</Notice>
            </div>
          )}
        </Section>
      </>
    );
  }

  /* ---------- Paso 3: datos del cliente ---------- */
  if (session.estado === "DATOS_CLIENTE") {
    const completo = customer.nombres && customer.apellidos && customer.dni;
    return (
      <>
        <PageHeader
          title="Datos del cliente"
          subtitle="Este paso lo completa recepción, no el kiosco"
          actions={
            <Button variant="danger" onClick={cancel} disabled={busy}>
              Cancelar venta
            </Button>
          }
        />
        <Stepper current={current} />

        <Section title="Huésped" className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombres">
                <Input autoFocus placeholder="Nombres" value={customer.nombres} onChange={(e) => setCustomer((c) => ({ ...c, nombres: e.target.value }))} />
              </Field>
              <Field label="Apellidos">
                <Input placeholder="Apellidos" value={customer.apellidos} onChange={(e) => setCustomer((c) => ({ ...c, apellidos: e.target.value }))} />
              </Field>
              <Field label="DNI">
                <Input placeholder="DNI" value={customer.dni} onChange={(e) => setCustomer((c) => ({ ...c, dni: e.target.value }))} />
              </Field>
              <Field label="Teléfono (opcional)">
                <Input placeholder="Teléfono" value={customer.telefono} onChange={(e) => setCustomer((c) => ({ ...c, telefono: e.target.value }))} />
              </Field>
            </div>

            {error && <Notice>{error}</Notice>}

            <Button
              variant="primary"
              size="lg"
              disabled={busy || !completo}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await api.setKioskCustomer({ ...customer, telefono: customer.telefono || null });
                  setCustomer({ nombres: "", apellidos: "", dni: "", telefono: "" });
                } catch (err) {
                  setError(err instanceof ApiError ? err.message : "No se pudo registrar al cliente.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar cliente
            </Button>
          </div>
        </Section>
      </>
    );
  }

  /* ---------- Paso 4: productos ---------- */
  if (session.estado === "SELECCION_PRODUCTOS") {
    const productLines = (productSale?.lineas ?? []).filter((l) => l.tipo === "PRODUCTO");
    const hasProducts = productLines.length > 0;

    if (!hasProducts && wantsProducts === null) {
      return (
        <>
          <PageHeader
            title="Productos"
            subtitle="Consulta si el huésped desea agregar productos o bebidas a su habitación"
            actions={
              <Button variant="danger" onClick={cancel} disabled={busy}>
                Cancelar venta
              </Button>
            }
          />
          <Stepper current={current} />

          <Section title="¿El huésped desea agregar productos a la habitación?" className="mx-auto max-w-2xl text-center">
            <div className="py-6">
              <p className="mb-8 text-base text-muted">
                Puedes registrar bebidas, snacks o artículos de bodega para incluirlos en la misma cuenta, o continuar directamente al cobro.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.finishKioskProducts();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  No, continuar a pago
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.setKioskProductsDecision(true);
                      setWantsProducts(true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Sí, seleccionar productos
                </Button>

              </div>
            </div>
          </Section>
        </>
      );
    }

    return (
      <>
        <PageHeader
          title="Productos"
          subtitle="Agrega productos de bodega a la cuenta o revisa los que elija el huésped"
          actions={
            <Button variant="danger" onClick={cancel} disabled={busy}>
              Cancelar venta
            </Button>
          }
        />
        <Stepper current={current} />

        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Section title="Buscar y agregar producto" subtitle="Escribe el nombre o usa el lector de código de barras">
            <ProductPicker
              onAdd={async (productoId) => {
                setBusy(true);
                try {
                  await api.addKioskProduct(productoId, 1);
                  if (session.saleId) {
                    const updated = await api.getSale(session.saleId);
                    setProductSale(updated);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Section>

          <Section title="Detalle de la cuenta">
            {productSale && productSale.lineas.length > 0 ? (
              <div className="flex flex-col divide-y divide-line">
                {productSale.lineas.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0 pr-2">
                      <p className="font-medium text-ink truncate">{l.descripcion}</p>
                      <p className="text-xs text-subtle">{l.cantidad} × {format(cents(l.precioUnitarioCentimos))}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold tabular-nums text-ink">{format(cents(l.subtotalCentimos))}</span>
                      {l.tipo === "PRODUCTO" && (
                        <button
                          type="button"
                          title="Quitar producto"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await api.removeKioskProduct(l.id);
                              if (session.saleId) {
                                const updated = await api.getSale(session.saleId);
                                setProductSale(updated);
                              }
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded-lg p-1.5 text-subtle hover:bg-inset hover:text-danger transition-colors disabled:opacity-40"
                        >
                          <IconX className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sin productos agregados" hint="Busca un producto a la izquierda o espera que el cliente lo elija en el kiosco." />
            )}

            <div className="mt-4 border-t border-line pt-4">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-sm font-medium text-subtle">Total</span>
                <span className="text-2xl font-bold tabular-nums text-ink">{format(cents(session.totalCentimos ?? 0))}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                {!hasProducts && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setWantsProducts(null)}
                  >
                    ← Volver
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  className="ml-auto"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api.finishKioskProducts();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Continuar a pago
                </Button>
              </div>
            </div>
          </Section>
        </div>
      </>
    );
  }

  /* ---------- Paso 5: pago ---------- */
  if ((session.estado === "SELECCION_PAGO" || session.estado === "PAGO_PENDIENTE") && !payment) {
    return (
      <>
        <PageHeader
          title="Registrar pago"
          subtitle={session.propuestaPago ? "El cliente ya propuso cómo pagar — completá los códigos" : "Registrá cómo paga el cliente"}
          actions={
            <Button variant="danger" onClick={cancel} disabled={busy}>
              Cancelar venta
            </Button>
          }
        />
        <Stepper current={4} />

        <Section title="Pago" className="mx-auto max-w-2xl">
          <PaymentForm
            totalCentimos={session.totalCentimos ?? 0}
            proposedSplit={session.propuestaPago}
            busy={busy}
            onSubmit={async (detalles: PaymentDetailInput[]) => {
              setBusy(true);
              setError(null);
              try {
                setPayment(await api.createPayment(session.saleId!, detalles));
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago.");
              } finally {
                setBusy(false);
              }
            }}
          />
          {error && (
            <div className="mt-4">
              <Notice>{error}</Notice>
            </div>
          )}
        </Section>
      </>
    );
  }

  if ((session.estado === "SELECCION_PAGO" || session.estado === "PAGO_PENDIENTE") && payment) {
    return (
      <>
        <PageHeader title="Confirmar pago" subtitle="Revisá lo cobrado antes de aceptar" />
        <Stepper current={4} />

        <Section title="Detalle del pago" className="mx-auto max-w-lg">
          <div className="mb-4 rounded-xl bg-inset p-4">
            {payment.detalles.map((d) => (
              <Row key={d.id} label={`${d.metodo}${d.codigoOperacion ? ` · ${d.codigoOperacion}` : ""}`} value={format(cents(d.montoCentimos))} />
            ))}
          </div>

          {error && (
            <div className="mb-4">
              <Notice>{error}</Notice>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              block
              variant="danger"
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
            >
              Rechazar
            </Button>
            <Button
              block
              variant="primary"
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
            >
              Aceptar pago
            </Button>
          </div>
        </Section>
      </>
    );
  }

  /* ---------- Resultado ---------- */
  const aceptado = session.estado === "ACEPTADO";
  return (
    <>
      <PageHeader title={aceptado ? "Venta confirmada" : "Pago rechazado"} />
      <Card className="mx-auto max-w-md p-8 text-center">
        <span className={cx("mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full text-3xl", aceptado ? "tone-teal" : "tone-red")}>{aceptado ? "✓" : "!"}</span>
        <p className="text-lg font-semibold text-ink">{aceptado ? "Cuarto entregado" : "El pago fue rechazado"}</p>
        <p className="mt-1 text-sm text-muted">{aceptado ? "La venta quedó registrada correctamente." : (session.error ?? "El cuarto se liberó.")}</p>
        <Button variant="primary" size="lg" className="mt-6" onClick={onDone}>
          Volver al tablero
        </Button>
      </Card>
    </>
  );
}
