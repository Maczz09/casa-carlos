import { useEffect, useState } from "react";
import type { Comprobante, ComprobantePago, ComunicacionBaja, DocumentType, IssueNotaInput, NotaTipo, PaymentDetailInput, RoomBoardEntry, SaleWithLines, StayWithCustomer } from "@casacarlos/contracts";
import { MOTIVOS_NOTA_CREDITO, MOTIVOS_NOTA_DEBITO } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api, ApiError, getToken } from "../api.js";
import { STATUS_STYLE } from "@casacarlos/ui";
import { formatDuration, useCountdown } from "../hooks/useCountdown.js";
import { PaymentForm } from "./PaymentForm.js";
import { ProductPicker } from "./ProductPicker.js";

interface Props {
  entry: RoomBoardEntry;
  onClose: () => void;
}

const OCCUPIED_STATES = new Set(["OCUPADO", "EN_TOLERANCIA", "EXCEDIDO"]);

export function RoomDetailDrawer({ entry, onClose }: Props) {
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

  const remaining = useCountdown(entry.desocupaEn);

  const reload = async () => {
    if (!entry.stayId) return;
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
  }, [entry.stayId]);

  const checkIn = async () => {
    if (!entry.stayId) return;
    setBusy(true);
    setError(null);
    try {
      await api.checkInReservation(entry.stayId);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo hacer el check-in.");
    } finally {
      setBusy(false);
    }
  };

  const checkOut = async () => {
    if (!entry.stayId) return;
    setBusy(true);
    setError(null);
    try {
      await api.checkOut(entry.stayId);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo hacer el check-out.");
    } finally {
      setBusy(false);
    }
  };

  const finishCleaning = async () => {
    setBusy(true);
    try {
      await api.finishCleaning(entry.room.id);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const payBalance = async (detalles: PaymentDetailInput[]) => {
    if (!sale) return;
    setBusy(true);
    setError(null);
    try {
      const payment = await api.createPayment(sale.id, detalles);
      await api.acceptPayment(payment.id);
      setPayingBalance(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cobrar el saldo.");
    } finally {
      setBusy(false);
    }
  };

  const addProduct = async (productoId: string) => {
    if (!sale) return;
    await api.addProductLine(sale.id, productoId, 1);
    await reload();
  };

  const cancelLine = async (lineId: string) => {
    if (!sale) return;
    setBusy(true);
    try {
      await api.cancelLine(sale.id, lineId, "Anulado por recepción");
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo anular la línea.");
    } finally {
      setBusy(false);
    }
  };

  const generarComprobantePago = async (tipo: DocumentType) => {
    if (!sale) return;
    if (tipo === "FACTURA" && (!facturaRuc || !facturaRazonSocial)) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await api.createComprobantePago(sale.id, {
        tipo,
        receptorRuc: tipo === "FACTURA" ? facturaRuc : null,
        receptorRazonSocial: tipo === "FACTURA" ? facturaRazonSocial : null,
      });
      setComprobantePago(draft);
      setGenerandoPago(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo generar el comprobante de pago.");
    } finally {
      setBusy(false);
    }
  };

  const imprimirComprobantePago = () => window.print();

  const emitDesdeComprobantePago = async () => {
    if (!sale || !comprobantePago) return;
    setBusy(true);
    setError(null);
    try {
      const c =
        comprobantePago.tipo === "FACTURA"
          ? await api.issueFactura(sale.id, comprobantePago.receptorRuc!, comprobantePago.receptorRazonSocial!)
          : await api.issueBoleta(sale.id);
      setComprobante(c);
      setComprobantePago((prev) => (prev ? { ...prev, estado: "EMITIDO" } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo emitir el comprobante.");
    } finally {
      setBusy(false);
    }
  };

  const retryComprobante = async () => {
    if (!comprobante) return;
    setBusy(true);
    setError(null);
    try {
      setComprobante(await api.retryComprobante(comprobante.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reintentar el envío.");
    } finally {
      setBusy(false);
    }
  };

  const downloadXml = async () => {
    if (!comprobante) return;
    const token = getToken();
    const res = await fetch(api.comprobanteXmlUrl(comprobante.id), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const xml = await res.text();
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${comprobante.serie}-${comprobante.correlativo}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const voidComprobante = async () => {
    if (!comprobante || !motivoAnulacion) return;
    setBusy(true);
    setError(null);
    try {
      setBaja(await api.voidComprobante(comprobante.id, motivoAnulacion));
      setAnulando(false);
      const updated = await api.getComprobante(comprobante.id).catch(() => null);
      if (updated) setComprobante(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar la anulación.");
    } finally {
      setBusy(false);
    }
  };

  const emitNota = async () => {
    if (!comprobante || !emitiendoNota || !notaMotivoCodigo || !notaMontoSoles) return;
    const centimos = Math.round(parseFloat(notaMontoSoles) * 100);
    if (!Number.isFinite(centimos) || centimos <= 0) return;
    const catalogo = emitiendoNota === "NOTA_CREDITO" ? MOTIVOS_NOTA_CREDITO : MOTIVOS_NOTA_DEBITO;
    const motivoDescripcion = catalogo.find((m) => m.codigo === notaMotivoCodigo)?.descripcion ?? notaMotivoCodigo;
    setBusy(true);
    setError(null);
    try {
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo emitir la nota.");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    if (!comprobante) return;
    const token = getToken();
    const res = await fetch(api.comprobantePdfUrl(comprobante.id), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${comprobante.serie}-${comprobante.correlativo}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canAddProducts = OCCUPIED_STATES.has(entry.estado) && sale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Cuarto {entry.room.numero}</h2>
            <p className="text-sm text-slate-400">{STATUS_STYLE[entry.estado].label}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {stay && (
          <div className="mb-4 space-y-1 rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">
              {stay.cliente.nombres} {stay.cliente.apellidos}
            </p>
            <p>DNI {stay.cliente.dni}</p>
            <p>Check-in: {new Date(stay.checkinPrevisto).toLocaleString("es-PE")}</p>
            <p>Check-out previsto: {new Date(stay.checkoutPrevisto).toLocaleString("es-PE")}</p>
            {remaining !== null && (
              <p className={`font-mono text-lg ${remaining < 0 ? "text-rose-400" : "text-white"}`}>
                {remaining < 0 ? "Excedido +" : "Tiempo restante "}
                {formatDuration(remaining)}
              </p>
            )}
          </div>
        )}

        {sale && (
          <div className="mb-4 rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
            <div className="mb-2 space-y-1">
              {sale.lineas.map((linea) => (
                <div key={linea.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {linea.descripcion}
                    {linea.fase === "POST_PAGO" && <span className="ml-1 text-xs text-amber-400">(post-pago)</span>}
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-white">{format(cents(linea.subtotalCentimos))}</span>
                    {linea.tipo !== "HOSPEDAJE" && (
                      <button onClick={() => cancelLine(linea.id)} disabled={busy} title="Anular línea" className="text-rose-400 hover:text-rose-300 disabled:opacity-40">
                        ✕
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-slate-700 pt-2">
              <span>Total</span>
              <span className="text-white">{format(cents(sale.totalCentimos))}</span>
            </div>
            <div className="flex justify-between">
              <span>Pagado</span>
              <span className="text-white">{format(cents(sale.pagadoCentimos))}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Saldo pendiente</span>
              <span className={sale.saldoCentimos > 0 ? "text-amber-400" : "text-emerald-400"}>{format(cents(sale.saldoCentimos))}</span>
            </div>
          </div>
        )}

        {sale && sale.saldoCentimos === 0 && (
          <div className="mb-4 rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
            <p className="mb-2 font-medium text-white">Comprobante SUNAT</p>
            {comprobante ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span>
                    {comprobante.tipo === "BOLETA" ? "Boleta" : "Factura"} {comprobante.serie}-{comprobante.correlativo}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      comprobante.estadoSunat === "ACEPTADO"
                        ? "bg-teal-50 text-teal-700"
                        : comprobante.estadoSunat === "PENDIENTE"
                          ? "bg-amber-50 text-amber-700"
                          : comprobante.estadoSunat === "ANULADO"
                            ? "bg-stone-100 text-stone-600"
                            : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {comprobante.estadoSunat === "ACEPTADO"
                      ? "Aceptado"
                      : comprobante.estadoSunat === "PENDIENTE"
                        ? "Pendiente"
                        : comprobante.estadoSunat === "ANULADO"
                          ? "Anulado"
                          : comprobante.estadoSunat === "RECHAZADO"
                            ? "Rechazado"
                            : "Error de envío"}
                  </span>
                </div>
                {comprobante.estadoSunat !== "ACEPTADO" && comprobante.estadoSunat !== "ANULADO" && comprobante.sunatDescripcion && (
                  <p className="text-xs text-rose-400">{comprobante.sunatDescripcion}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button onClick={downloadPdf} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600">
                    Descargar PDF
                  </button>
                  <button onClick={downloadXml} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600">
                    Descargar XML
                  </button>
                  {comprobante.estadoSunat !== "ACEPTADO" && comprobante.estadoSunat !== "ANULADO" && (
                    <button onClick={retryComprobante} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-500 disabled:opacity-50">
                      Reintentar
                    </button>
                  )}
                  {comprobante.estadoSunat === "ACEPTADO" && comprobante.tipo === "FACTURA" && !anulando && !baja && (
                    <button onClick={() => setAnulando(true)} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-500 disabled:opacity-50">
                      Anular
                    </button>
                  )}
                  {comprobante.estadoSunat === "ACEPTADO" && !emitiendoNota && (
                    <button onClick={() => setEmitiendoNota("NOTA_CREDITO")} disabled={busy} className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white hover:bg-amber-600 disabled:opacity-50">
                      Nota de crédito/débito
                    </button>
                  )}
                </div>

                {anulando && (
                  <div className="mt-1 flex flex-col gap-2 rounded-lg bg-slate-800 p-3">
                    <textarea
                      placeholder="Motivo de la anulación"
                      value={motivoAnulacion}
                      onChange={(e) => setMotivoAnulacion(e.target.value)}
                      rows={2}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setAnulando(false)} className="flex-1 rounded-lg bg-slate-700 py-1.5 text-xs text-white hover:bg-slate-600">
                        Cancelar
                      </button>
                      <button
                        onClick={voidComprobante}
                        disabled={busy || !motivoAnulacion}
                        className="flex-1 rounded-lg bg-rose-600 py-1.5 text-xs text-white hover:bg-rose-500 disabled:opacity-50"
                      >
                        Enviar anulación
                      </button>
                    </div>
                  </div>
                )}

                {baja && baja.estadoSunat !== "ACEPTADO" && (
                  <div className="mt-1 rounded-lg bg-slate-800 p-3 text-xs">
                    <p className="text-slate-300">
                      Comunicación de baja:{" "}
                      <span className={baja.estadoSunat === "PENDIENTE" ? "text-amber-400" : "text-rose-400"}>
                        {baja.estadoSunat === "PENDIENTE" ? "Pendiente en SUNAT" : baja.estadoSunat === "RECHAZADO" ? "Rechazada" : "Error de envío"}
                      </span>
                    </p>
                    {baja.sunatDescripcion && <p className="mt-1 text-slate-400">{baja.sunatDescripcion}</p>}
                    <button onClick={voidComprobante} disabled={busy} className="mt-2 rounded-lg bg-slate-700 px-3 py-1 text-white hover:bg-slate-600 disabled:opacity-50">
                      {baja.estadoSunat === "PENDIENTE" ? "Revisar estado" : "Reintentar anulación"}
                    </button>
                  </div>
                )}

                {emitiendoNota && (
                  <div className="mt-1 flex flex-col gap-2 rounded-lg bg-slate-800 p-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEmitiendoNota("NOTA_CREDITO");
                          setNotaMotivoCodigo("");
                        }}
                        className={`flex-1 rounded-lg py-1.5 text-xs ${emitiendoNota === "NOTA_CREDITO" ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300"}`}
                      >
                        Nota de crédito
                      </button>
                      <button
                        onClick={() => {
                          setEmitiendoNota("NOTA_DEBITO");
                          setNotaMotivoCodigo("");
                        }}
                        className={`flex-1 rounded-lg py-1.5 text-xs ${emitiendoNota === "NOTA_DEBITO" ? "bg-amber-600 text-white" : "bg-slate-700 text-slate-300"}`}
                      >
                        Nota de débito
                      </button>
                    </div>
                    <select
                      value={notaMotivoCodigo}
                      onChange={(e) => setNotaMotivoCodigo(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Motivo…</option>
                      {(emitiendoNota === "NOTA_CREDITO" ? MOTIVOS_NOTA_CREDITO : MOTIVOS_NOTA_DEBITO).map((m) => (
                        <option key={m.codigo} value={m.codigo}>
                          {m.descripcion}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Monto (S/)"
                      value={notaMontoSoles}
                      onChange={(e) => setNotaMontoSoles(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setEmitiendoNota(null)} className="flex-1 rounded-lg bg-slate-700 py-1.5 text-xs text-white hover:bg-slate-600">
                        Cancelar
                      </button>
                      <button
                        onClick={emitNota}
                        disabled={busy || !notaMotivoCodigo || !notaMontoSoles}
                        className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        Emitir nota
                      </button>
                    </div>
                  </div>
                )}

                {notas.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1 rounded-lg bg-slate-800 p-3 text-xs">
                    <p className="mb-1 font-medium text-slate-300">Notas emitidas</p>
                    {notas.map((n) => (
                      <div key={n.id} className="flex items-center justify-between text-slate-300">
                        <span>
                          {n.tipo === "NOTA_CREDITO" ? "Crédito" : "Débito"} {n.serie}-{n.correlativo} — {n.motivoDescripcion}
                        </span>
                        <span className={n.estadoSunat === "ACEPTADO" ? "text-teal-400" : "text-rose-400"}>{n.estadoSunat === "ACEPTADO" ? "Aceptada" : n.estadoSunat}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : comprobantePago ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span>
                    Comprobante de pago (borrador) — {comprobantePago.tipo === "BOLETA" ? "Boleta" : `Factura ${comprobantePago.receptorRuc}`}
                  </span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Sin emitir</span>
                </div>
                <p className="text-xs text-slate-400">Control interno — no es el comprobante SUNAT hasta que se emita.</p>
                <div className="flex gap-2">
                  <button onClick={imprimirComprobantePago} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600">
                    Imprimir
                  </button>
                  <button
                    onClick={emitDesdeComprobantePago}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Emitir {comprobantePago.tipo === "BOLETA" ? "boleta" : "factura"}
                  </button>
                </div>
                <div className="print-only-receipt hidden">
                  <h2>CASA CARLOS</h2>
                  <p className="receipt-center">Comprobante de pago (BORRADOR)</p>
                  <p className="receipt-center">Control interno — no válido como comprobante SUNAT</p>
                  <hr />
                  <p>{new Date(comprobantePago.creadoEn).toLocaleString("es-PE")}</p>
                  <p>Cuarto: {entry.room.numero}</p>
                  {stay && (
                    <p>
                      Cliente: {stay.cliente.nombres} {stay.cliente.apellidos}
                    </p>
                  )}
                  {stay && <p>DNI: {stay.cliente.dni}</p>}
                  {comprobantePago.tipo === "FACTURA" && (
                    <>
                      <p>RUC: {comprobantePago.receptorRuc}</p>
                      <p>Razón social: {comprobantePago.receptorRazonSocial}</p>
                    </>
                  )}
                  <hr />
                  <table>
                    <tbody>
                      {sale?.lineas.map((l) => (
                        <tr key={l.id}>
                          <td>{l.descripcion}</td>
                          <td>{format(cents(l.subtotalCentimos))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <hr />
                  <p className="receipt-total">TOTAL {sale && format(cents(sale.totalCentimos))}</p>
                  <hr />
                  <p className="receipt-center">{comprobantePago.tipo === "BOLETA" ? "BOLETA DE VENTA" : "FACTURA"}</p>
                </div>
              </div>
            ) : generandoPago ? (
              <div className="flex flex-col gap-2">
                {generandoPago === "FACTURA" && (
                  <>
                    <input placeholder="RUC" value={facturaRuc} onChange={(e) => setFacturaRuc(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
                    <input
                      placeholder="Razón social"
                      value={facturaRazonSocial}
                      onChange={(e) => setFacturaRazonSocial(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                    />
                  </>
                )}
                <div className="flex gap-2">
                  <button onClick={() => setGenerandoPago(null)} className="flex-1 rounded-lg bg-slate-700 py-2 text-white hover:bg-slate-600">
                    Cancelar
                  </button>
                  <button
                    onClick={() => generarComprobantePago(generandoPago)}
                    disabled={busy || (generandoPago === "FACTURA" && (!facturaRuc || !facturaRazonSocial))}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Generar comprobante de pago
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => generarComprobantePago("BOLETA")} disabled={busy} className="flex-1 rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  Boleta
                </button>
                <button onClick={() => setGenerandoPago("FACTURA")} disabled={busy} className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50">
                  Factura (RUC)
                </button>
              </div>
            )}
          </div>
        )}

        {addingProduct && canAddProducts ? (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white">Agregar producto</p>
              <button onClick={() => setAddingProduct(false)} className="text-sm text-slate-400 hover:text-white">
                Listo
              </button>
            </div>
            <ProductPicker onAdd={addProduct} />
          </div>
        ) : payingBalance && sale && sale.saldoCentimos > 0 ? (
          <PaymentForm totalCentimos={sale.saldoCentimos} onSubmit={payBalance} busy={busy} />
        ) : (
          <div className="flex flex-col gap-2">
            {error && <p className="text-sm text-rose-400">{error}</p>}

            {entry.estado === "RESERVADO" && (
              <button onClick={checkIn} disabled={busy} className="rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                Hacer check-in
              </button>
            )}

            {canAddProducts && (
              <button onClick={() => setAddingProduct(true)} className="rounded-lg bg-slate-700 py-2.5 font-medium text-white hover:bg-slate-600">
                + Agregar producto
              </button>
            )}

            {(entry.estado === "OCUPADO" || entry.estado === "EN_TOLERANCIA" || entry.estado === "EXCEDIDO") && (
              <>
                {sale && sale.saldoCentimos > 0 && (
                  <button onClick={() => setPayingBalance(true)} className="rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-500">
                    Cobrar saldo pendiente
                  </button>
                )}
                <button
                  onClick={checkOut}
                  disabled={busy || (sale ? sale.saldoCentimos > 0 : false)}
                  className="rounded-lg bg-slate-700 py-2.5 font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  Check-out
                </button>
              </>
            )}

            {entry.estado === "LIMPIEZA" && (
              <button onClick={finishCleaning} disabled={busy} className="rounded-lg bg-sky-600 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50">
                Finalizar limpieza ahora
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
