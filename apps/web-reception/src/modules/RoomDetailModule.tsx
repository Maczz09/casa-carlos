import { useEffect, useState } from "react";
import type {
  Comprobante,
  ComprobantePago,
  ComunicacionBaja,
  DocumentType,
  FloorBoard,
  IssueNotaInput,
  NotaTipo,
  PaymentDetailInput,
  RoomBoardEntry,
  SaleWithLines,
  StayWithCustomer,
} from "@casacarlos/contracts";
import { MOTIVOS_NOTA_CREDITO, MOTIVOS_NOTA_DEBITO } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconPrinter, STATUS_STYLE } from "@casacarlos/ui";
import { api, ApiError, getToken } from "../api.js";
import { formatDuration, useCountdown } from "../hooks/useCountdown.js";
import { PaymentForm } from "../components/PaymentForm.js";
import { ProductPicker } from "../components/ProductPicker.js";
import { DraftReceiptMarkup, type DraftReceipt } from "../components/receipt.js";
import { DetailHeader } from "../components/layout.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, Row, Section, Select, Skeleton, Textarea, cx } from "../components/ui.js";

interface Props {
  roomId: string;
  floors: FloorBoard[];
  onBack: () => void;
}

const OCCUPIED_STATES = new Set(["OCUPADO", "EN_TOLERANCIA", "EXCEDIDO"]);

const SUNAT_TONE: Record<string, string> = {
  ACEPTADO: "tone-teal",
  PENDIENTE: "tone-amber",
  ANULADO: "tone-stone",
  RECHAZADO: "tone-red",
};

const SUNAT_LABEL: Record<string, string> = {
  ACEPTADO: "Aceptado",
  PENDIENTE: "Pendiente",
  ANULADO: "Anulado",
  RECHAZADO: "Rechazado",
};

export function RoomDetailModule({ roomId, floors, onBack }: Props) {
  const entry: RoomBoardEntry | undefined = floors.flatMap((f) => f.rooms).find((r) => r.room.id === roomId);

  const [stay, setStay] = useState<StayWithCustomer | null>(null);
  const [sale, setSale] = useState<SaleWithLines | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payingBalance, setPayingBalance] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);
  const [comprobantePago, setComprobantePago] = useState<ComprobantePago | null>(null);
  const [generandoPago, setGenerandoPago] = useState<DocumentType | null>(null);
  const [facturaRuc, setFacturaRuc] = useState("");
  const [facturaRazonSocial, setFacturaRazonSocial] = useState("");
  const [baja, setBaja] = useState<ComunicacionBaja | null>(null);
  const [anulando, setAnulando] = useState(false);
  const [motivoAnulacion, setMotivoAnulacion] = useState("");
  const [notas, setNotas] = useState<Comprobante[]>([]);
  const [emitiendoNota, setEmitiendoNota] = useState<NotaTipo | null>(null);
  const [notaMotivoCodigo, setNotaMotivoCodigo] = useState("");
  const [notaMontoSoles, setNotaMontoSoles] = useState("");
  const [draft, setDraft] = useState<DraftReceipt | null>(null);

  const remaining = useCountdown(entry?.desocupaEn ?? null);

  const reload = async () => {
    if (!entry?.stayId) return;
    const [s, sl] = await Promise.all([api.getStay(entry.stayId), api.getSaleForStay(entry.stayId)]);
    setStay(s);
    setSale(sl);
    const c = sl ? await api.comprobanteForSale(sl.id) : null;
    setComprobante(c);
    setBaja(c ? await api.bajaForComprobante(c.id) : null);
    setNotas(c && c.estadoSunat === "ACEPTADO" ? await api.notasForComprobante(c.id) : []);
    setComprobantePago(sl ? await api.comprobantePagoForSale(sl.id) : null);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.stayId]);

  useEffect(() => {
    if (!draft) return;
    const id = setTimeout(() => window.print(), 50);
    return () => clearTimeout(id);
  }, [draft]);

  if (!entry) {
    return (
      <>
        <DetailHeader title="Cuarto" onBack={onBack} />
        <Card>
          <EmptyState title="Cuarto no encontrado" hint="Puede que el tablero todavía esté cargando." action={<Button onClick={onBack}>Volver al tablero</Button>} />
        </Card>
      </>
    );
  }

  const style = STATUS_STYLE[entry.estado];
  const canAddProducts = OCCUPIED_STATES.has(entry.estado) && !!sale;

  const run = async (fn: () => Promise<unknown>, fallback: string, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      after?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const download = async (url: string, filename: string, asText: boolean) => {
    const token = getToken();
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const blob = asText ? new Blob([await res.text()], { type: "application/xml;charset=utf-8" }) : await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  };

  const generarComprobantePago = async (tipo: DocumentType) => {
    if (!sale) return;
    if (tipo === "FACTURA" && (!facturaRuc || !facturaRazonSocial)) return;
    await run(
      async () => {
        const created = await api.createComprobantePago(sale.id, {
          tipo,
          receptorRuc: tipo === "FACTURA" ? facturaRuc : null,
          receptorRazonSocial: tipo === "FACTURA" ? facturaRazonSocial : null,
        });
        setComprobantePago(created);
        setGenerandoPago(null);
      },
      "No se pudo generar el comprobante de pago.",
    );
  };

  const emitNota = async () => {
    if (!comprobante || !emitiendoNota || !notaMotivoCodigo || !notaMontoSoles) return;
    const centimos = Math.round(parseFloat(notaMontoSoles) * 100);
    if (!Number.isFinite(centimos) || centimos <= 0) return;
    const catalogo = emitiendoNota === "NOTA_CREDITO" ? MOTIVOS_NOTA_CREDITO : MOTIVOS_NOTA_DEBITO;
    const motivoDescripcion = catalogo.find((m) => m.codigo === notaMotivoCodigo)?.descripcion ?? notaMotivoCodigo;
    await run(
      async () => {
        const input: IssueNotaInput = {
          motivoCodigo: notaMotivoCodigo,
          motivoDescripcion,
          lineas: [{ descripcion: motivoDescripcion, cantidad: 1, precioUnitarioCentimos: centimos, subtotalCentimos: centimos }],
        };
        const nota = emitiendoNota === "NOTA_CREDITO" ? await api.issueNotaCredito(comprobante.id, input) : await api.issueNotaDebito(comprobante.id, input);
        setNotas((prev) => [nota, ...prev]);
        setEmitiendoNota(null);
        setNotaMotivoCodigo("");
        setNotaMontoSoles("");
      },
      "No se pudo emitir la nota.",
    );
  };

  const imprimirBorrador = () => {
    if (!sale || !comprobantePago) return;
    setDraft({
      sale,
      tipo: comprobantePago.tipo,
      receptorRuc: comprobantePago.receptorRuc,
      receptorRazonSocial: comprobantePago.receptorRazonSocial,
      fecha: comprobantePago.creadoEn,
      cuarto: entry.room.numero,
    });
  };

  return (
    <>
      <DetailHeader
        title={`Cuarto ${entry.room.numero}`}
        subtitle={<Badge tone={style.tone}>{style.label}</Badge>}
        onBack={onBack}
        actions={
          entry.estado === "RESERVADO" ? (
            <Button variant="primary" disabled={busy} onClick={() => run(() => api.checkInReservation(entry.stayId!), "No se pudo hacer el check-in.", onBack)}>
              Hacer check-in
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* ---------- Columna principal ---------- */}
        <div className="flex flex-col gap-5">
          {stay ? (
            <Section title="Huésped">
              <p className="text-base font-semibold text-ink">
                {stay.cliente.nombres} {stay.cliente.apellidos}
              </p>
              <p className="mb-3 text-sm text-muted">DNI {stay.cliente.dni}</p>
              <Row label="Check-in" value={new Date(stay.checkinPrevisto).toLocaleString("es-PE")} />
              <Row label="Check-out previsto" value={new Date(stay.checkoutPrevisto).toLocaleString("es-PE")} />
              {remaining !== null && (
                <div className="mt-3 rounded-xl bg-inset p-3 text-center">
                  <p className="text-xs uppercase tracking-wide text-subtle">{remaining < 0 ? "Excedido" : "Tiempo restante"}</p>
                  <p className={cx("font-mono text-2xl font-semibold tabular-nums", remaining < 0 ? "text-danger" : "text-ink")}>
                    {remaining < 0 ? "+" : ""}
                    {formatDuration(remaining)}
                  </p>
                </div>
              )}
            </Section>
          ) : entry.stayId ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : null}

          {sale && (
            <Section title="Cargos">
              <div className="mb-3">
                {sale.lineas.map((linea) => (
                  <div key={linea.id} className="flex items-center justify-between gap-2 py-1">
                    <span className="min-w-0 truncate text-sm text-muted">
                      {linea.descripcion}
                      {linea.fase === "POST_PAGO" && <span className="ml-1 text-xs text-warn">(post-pago)</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-sm tabular-nums text-ink">{format(cents(linea.subtotalCentimos))}</span>
                      {linea.tipo !== "HOSPEDAJE" && (
                        <button
                          onClick={() => run(() => api.cancelLine(sale.id, linea.id, "Anulado por recepción"), "No se pudo anular la línea.", reload)}
                          disabled={busy}
                          title="Anular línea"
                          className="text-danger transition-opacity hover:opacity-70 disabled:opacity-40"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-line pt-2">
                <Row label="Total" value={format(cents(sale.totalCentimos))} />
                <Row label="Pagado" value={format(cents(sale.pagadoCentimos))} />
                <Row
                  label="Saldo pendiente"
                  value={format(cents(sale.saldoCentimos))}
                  strong
                  tone={sale.saldoCentimos > 0 ? "text-warn" : "text-ok"}
                />
              </div>
            </Section>
          )}

          {/* Comprobante — justo debajo de los cargos, que es donde se lo busca al cobrar. */}
          {sale && sale.saldoCentimos === 0 && (
            <Section title="Comprobante">
              {comprobante ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {comprobante.tipo === "BOLETA" ? "Boleta" : "Factura"} {comprobante.serie}-{comprobante.correlativo}
                    </span>
                    <Badge tone={SUNAT_TONE[comprobante.estadoSunat] ?? "tone-red"}>{SUNAT_LABEL[comprobante.estadoSunat] ?? "Error de envío"}</Badge>
                  </div>

                  {comprobante.estadoSunat !== "ACEPTADO" && comprobante.estadoSunat !== "ANULADO" && comprobante.sunatDescripcion && (
                    <p className="text-xs text-danger">{comprobante.sunatDescripcion}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" icon={<IconPrinter className="h-3.5 w-3.5" />} onClick={() => download(api.comprobantePdfUrl(comprobante.id), `${comprobante.serie}-${comprobante.correlativo}.pdf`, false)}>
                      Descargar PDF
                    </Button>
                    <Button size="sm" onClick={() => download(api.comprobanteXmlUrl(comprobante.id), `${comprobante.serie}-${comprobante.correlativo}.xml`, true)}>
                      Descargar XML
                    </Button>
                    {comprobante.estadoSunat !== "ACEPTADO" && comprobante.estadoSunat !== "ANULADO" && (
                      <Button size="sm" variant="warn" disabled={busy} onClick={() => run(async () => setComprobante(await api.retryComprobante(comprobante.id)), "No se pudo reintentar el envío.")}>
                        Reintentar
                      </Button>
                    )}
                    {comprobante.estadoSunat === "ACEPTADO" && comprobante.tipo === "FACTURA" && !anulando && !baja && (
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => setAnulando(true)}>
                        Anular
                      </Button>
                    )}
                    {comprobante.estadoSunat === "ACEPTADO" && !emitiendoNota && (
                      <Button size="sm" variant="warn" disabled={busy} onClick={() => setEmitiendoNota("NOTA_CREDITO")}>
                        Nota de crédito/débito
                      </Button>
                    )}
                  </div>

                  {anulando && (
                    <div className="animate-fade flex flex-col gap-2 rounded-xl bg-inset p-3">
                      <Textarea rows={2} placeholder="Motivo de la anulación" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} />
                      <div className="flex gap-2">
                        <Button block size="sm" onClick={() => setAnulando(false)}>
                          Cancelar
                        </Button>
                        <Button
                          block
                          size="sm"
                          variant="danger"
                          disabled={busy || !motivoAnulacion}
                          onClick={() =>
                            run(
                              async () => {
                                setBaja(await api.voidComprobante(comprobante.id, motivoAnulacion));
                                setAnulando(false);
                                const updated = await api.getComprobante(comprobante.id).catch(() => null);
                                if (updated) setComprobante(updated);
                              },
                              "No se pudo enviar la anulación.",
                            )
                          }
                        >
                          Enviar anulación
                        </Button>
                      </div>
                    </div>
                  )}

                  {baja && baja.estadoSunat !== "ACEPTADO" && (
                    <div className="rounded-xl bg-inset p-3 text-xs">
                      <p className="text-muted">
                        Comunicación de baja:{" "}
                        <span className={baja.estadoSunat === "PENDIENTE" ? "text-warn" : "text-danger"}>
                          {baja.estadoSunat === "PENDIENTE" ? "Pendiente en SUNAT" : baja.estadoSunat === "RECHAZADO" ? "Rechazada" : "Error de envío"}
                        </span>
                      </p>
                      {baja.sunatDescripcion && <p className="mt-1 text-subtle">{baja.sunatDescripcion}</p>}
                    </div>
                  )}

                  {emitiendoNota && (
                    <div className="animate-fade flex flex-col gap-2 rounded-xl bg-inset p-3">
                      <div className="flex gap-2">
                        {(["NOTA_CREDITO", "NOTA_DEBITO"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setEmitiendoNota(t);
                              setNotaMotivoCodigo("");
                            }}
                            className={cx("flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors", emitiendoNota === t ? "bg-warn text-white" : "bg-surface text-muted hover:text-ink")}
                          >
                            {t === "NOTA_CREDITO" ? "Nota de crédito" : "Nota de débito"}
                          </button>
                        ))}
                      </div>
                      <Select value={notaMotivoCodigo} onChange={(e) => setNotaMotivoCodigo(e.target.value)}>
                        <option value="">Motivo…</option>
                        {(emitiendoNota === "NOTA_CREDITO" ? MOTIVOS_NOTA_CREDITO : MOTIVOS_NOTA_DEBITO).map((m) => (
                          <option key={m.codigo} value={m.codigo}>
                            {m.descripcion}
                          </option>
                        ))}
                      </Select>
                      <Input type="number" min="0.01" step="0.01" placeholder="Monto (S/)" value={notaMontoSoles} onChange={(e) => setNotaMontoSoles(e.target.value)} />
                      <div className="flex gap-2">
                        <Button block size="sm" onClick={() => setEmitiendoNota(null)}>
                          Cancelar
                        </Button>
                        <Button block size="sm" variant="warn" disabled={busy || !notaMotivoCodigo || !notaMontoSoles} onClick={emitNota}>
                          Emitir nota
                        </Button>
                      </div>
                    </div>
                  )}

                  {notas.length > 0 && (
                    <div className="rounded-xl bg-inset p-3 text-xs">
                      <p className="mb-1.5 font-medium text-ink">Notas emitidas</p>
                      {notas.map((n) => (
                        <div key={n.id} className="flex items-center justify-between gap-2 py-0.5 text-muted">
                          <span className="truncate">
                            {n.tipo === "NOTA_CREDITO" ? "Crédito" : "Débito"} {n.serie}-{n.correlativo} — {n.motivoDescripcion}
                          </span>
                          <span className={n.estadoSunat === "ACEPTADO" ? "text-ok" : "text-danger"}>{n.estadoSunat === "ACEPTADO" ? "Aceptada" : n.estadoSunat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : comprobantePago ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      Comprobante de pago — {comprobantePago.tipo === "BOLETA" ? "Boleta" : `Factura ${comprobantePago.receptorRuc}`}
                    </span>
                    <Badge tone="tone-amber">Sin emitir</Badge>
                  </div>
                  <p className="text-xs text-muted">Control interno — no es el comprobante SUNAT hasta que se emita.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" icon={<IconPrinter className="h-3.5 w-3.5" />} onClick={imprimirBorrador}>
                      Imprimir borrador
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={busy}
                      onClick={() =>
                        run(
                          async () => {
                            const c =
                              comprobantePago.tipo === "FACTURA"
                                ? await api.issueFactura(sale.id, comprobantePago.receptorRuc!, comprobantePago.receptorRazonSocial!)
                                : await api.issueBoleta(sale.id);
                            setComprobante(c);
                            setComprobantePago((prev) => (prev ? { ...prev, estado: "EMITIDO" } : prev));
                          },
                          "No se pudo emitir el comprobante.",
                        )
                      }
                    >
                      Emitir {comprobantePago.tipo === "BOLETA" ? "boleta" : "factura"} a SUNAT
                    </Button>
                  </div>
                </div>
              ) : generandoPago ? (
                <div className="animate-fade flex flex-col gap-3">
                  {generandoPago === "FACTURA" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="RUC">
                        <Input placeholder="RUC" value={facturaRuc} onChange={(e) => setFacturaRuc(e.target.value)} />
                      </Field>
                      <Field label="Razón social">
                        <Input placeholder="Razón social" value={facturaRazonSocial} onChange={(e) => setFacturaRazonSocial(e.target.value)} />
                      </Field>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button block onClick={() => setGenerandoPago(null)}>
                      Cancelar
                    </Button>
                    <Button block variant="primary" disabled={busy || (generandoPago === "FACTURA" && (!facturaRuc || !facturaRazonSocial))} onClick={() => generarComprobantePago(generandoPago)}>
                      Generar comprobante de pago
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" disabled={busy} onClick={() => generarComprobantePago("BOLETA")}>
                    Boleta
                  </Button>
                  <Button disabled={busy} onClick={() => setGenerandoPago("FACTURA")}>
                    Factura (RUC)
                  </Button>
                </div>
              )}
            </Section>
          )}
        </div>

        {/* ---------- Acciones ---------- */}
        <div className="flex flex-col gap-5">
          <Section title="Acciones" delay={80}>
            {addingProduct && canAddProducts ? (
              <div className="animate-fade">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">Agregar producto</p>
                  <button onClick={() => setAddingProduct(false)} className="text-sm text-muted hover:text-ink">
                    Listo
                  </button>
                </div>
                <ProductPicker
                  onAdd={async (productoId) => {
                    if (!sale) return;
                    await api.addProductLine(sale.id, productoId, 1);
                    await reload();
                  }}
                />
              </div>
            ) : payingBalance && sale && sale.saldoCentimos > 0 ? (
              <div className="animate-fade">
                <PaymentForm
                  totalCentimos={sale.saldoCentimos}
                  busy={busy}
                  onSubmit={async (detalles: PaymentDetailInput[]) =>
                    run(
                      async () => {
                        const payment = await api.createPayment(sale.id, detalles);
                        await api.acceptPayment(payment.id);
                        setPayingBalance(false);
                        await reload();
                      },
                      "No se pudo cobrar el saldo.",
                    )
                  }
                />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {canAddProducts && <Button block onClick={() => setAddingProduct(true)}>+ Agregar producto</Button>}

                {(entry.estado === "OCUPADO" || entry.estado === "EN_TOLERANCIA" || entry.estado === "EXCEDIDO") && (
                  <>
                    {sale && sale.saldoCentimos > 0 && (
                      <Button block variant="warn" onClick={() => setPayingBalance(true)}>
                        Cobrar saldo pendiente
                      </Button>
                    )}
                    <Button
                      block
                      disabled={busy || (sale ? sale.saldoCentimos > 0 : false)}
                      onClick={() => run(() => api.checkOut(entry.stayId!), "No se pudo hacer el check-out.", onBack)}
                    >
                      Check-out
                    </Button>
                  </>
                )}

                {entry.estado === "LIMPIEZA" && (
                  <Button block variant="primary" disabled={busy} onClick={() => run(() => api.finishCleaning(entry.room.id), "No se pudo finalizar la limpieza.", onBack)}>
                    Finalizar limpieza ahora
                  </Button>
                )}
              </div>
            )}
          </Section>
        </div>
      </div>

      {draft && <DraftReceiptMarkup draft={draft} />}
    </>
  );
}
