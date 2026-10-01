import { useEffect, useState } from "react";
import type { Arqueo, CancelledSale, CashMovementType, CashSummary, Sale, Shift, ShiftTemplate } from "@casacarlos/contracts";
import { formatDateTime12h, formatTime12h, formatTimeOnly12h } from "@casacarlos/contracts";
import { cents, format, soles, splitIncludedIgv } from "@casacarlos/money";
import { IconAlertTriangle, IconCash, IconCheck, IconFileX, IconPrinter, IconReceipt, IconTrash } from "@casacarlos/ui";
import { ArcElement, Chart as ChartJS, Legend, Tooltip as ChartTooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { api, ApiError, type CashMovementView } from "../api.js";
import { DenominationCounter, sumDenominaciones } from "../components/DenominationCounter.js";
import { printReceiptForSale, printShiftClosureReceipt } from "../components/receipt.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Row, Section, Skeleton, StatCard, Tabs, Textarea, cx } from "../components/ui.js";

export const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  LEMON: "Lemon",
  AGORA: "Agora",
  TRANSFERENCIA: "Transferencia",
  POS_CREDITO: "POS crédito",
  POS_DEBITO: "POS débito",
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

type Tab = "turno" | "movimientos" | "ventas" | "anulaciones" | "historial";

const MOVEMENT_LABEL: Record<CashMovementType, string> = {
  APERTURA: "Apertura de caja",
  VENTA: "Cobro de venta",
  INGRESO: "Ingreso manual",
  EGRESO: "Egreso manual",
  AJUSTE: "Ajuste",
  VUELTO: "Vuelto entregado",
  CIERRE: "Cierre de caja",
};

const movementTone = (tipo: CashMovementType): string => {
  if (tipo === "VENTA" || tipo === "INGRESO" || tipo === "APERTURA") return "tone-teal";
  if (tipo === "EGRESO" || tipo === "VUELTO") return "tone-red";
  if (tipo === "AJUSTE") return "tone-amber";
  return "tone-stone";
};

const movementAmount = (movement: CashMovementView): string => {
  const outgoing = movement.tipo === "EGRESO" || movement.tipo === "VUELTO" || (movement.tipo === "AJUSTE" && movement.montoCentimos < 0);
  const neutral = movement.tipo === "CIERRE";
  return `${outgoing ? "−" : neutral ? "" : "+"}${format(cents(Math.abs(movement.montoCentimos)))}`;
};

ChartJS.register(ArcElement, ChartTooltip, Legend);

function PaymentMethodChart({ summary }: { summary: CashSummary }) {
  const data = {
    labels: summary.porMetodo.map((item) => METHOD_LABEL[item.metodo] ?? item.metodo),
    datasets: [
      {
        data: summary.porMetodo.map((item) => item.totalCentimos / 100),
        backgroundColor: ["#14b8a6", "#7c3aed", "#0ea5e9", "#f59e0b", "#ec4899", "#22c55e", "#6366f1", "#f97316"],
        borderColor: "transparent",
        hoverOffset: 5,
      },
    ],
  };
  return (
    <div className="mx-auto h-52 max-w-[280px]">
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { position: "bottom", labels: { color: "#718096", usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 14 } },
            tooltip: { callbacks: { label: (context) => `${context.label}: S/ ${Number(context.raw).toFixed(2)}` } },
          },
        }}
      />
    </div>
  );
}

export function CashboxModule() {
  const [tab, setTab] = useState<Tab>("turno");
  const [shift, setShift] = useState<Shift | null | undefined>(undefined);
  const [summary, setSummary] = useState<CashSummary | null>(null);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [plantillaId, setPlantillaId] = useState("");
  const [apertura, setApertura] = useState("");

  const [movTipo, setMovTipo] = useState<"INGRESO" | "EGRESO" | "AJUSTE">("INGRESO");
  const [movMonto, setMovMonto] = useState("");
  const [movMotivo, setMovMotivo] = useState("");
  const [showMovForm, setShowMovForm] = useState(false);

  const [closing, setClosing] = useState(false);
  const [denominacionesCierre, setDenominacionesCierre] = useState<Record<string, number>>({});
  const [justificacion, setJustificacion] = useState("");

  const [arqueando, setArqueando] = useState(false);
  const [denominacionesArqueo, setDenominacionesArqueo] = useState<Record<string, number>>({});
  const [arqueos, setArqueos] = useState<Arqueo[]>([]);

  const [desde, setDesde] = useState(daysAgoIso(7));
  const [hasta, setHasta] = useState(todayIso());
  const [history, setHistory] = useState<Shift[]>([]);
  const [rangeSummary, setRangeSummary] = useState<CashSummary | null>(null);

  const [ventasDesde, setVentasDesde] = useState(todayIso());
  const [ventasHasta, setVentasHasta] = useState(todayIso());
  const [ventas, setVentas] = useState<Sale[] | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("Venta duplicada");
  const [cancelCustomMotivo, setCancelCustomMotivo] = useState("");
  const [cancelCorrelationId, setCancelCorrelationId] = useState("");
  const [cancelIdempotencyKey, setCancelIdempotencyKey] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [anulacionesDesde, setAnulacionesDesde] = useState(daysAgoIso(7));
  const [anulacionesHasta, setAnulacionesHasta] = useState(todayIso());
  const [anulaciones, setAnulaciones] = useState<CancelledSale[] | null>(null);

  const [movementDesde, setMovementDesde] = useState(todayIso());
  const [movementHasta, setMovementHasta] = useState(todayIso());
  const [movementHoraDesde, setMovementHoraDesde] = useState("00:00");
  const [movementHoraHasta, setMovementHoraHasta] = useState("23:59");
  const [movementTipo, setMovementTipo] = useState("");
  const [movementMetodo, setMovementMetodo] = useState("");
  const [movements, setMovements] = useState<CashMovementView[] | null>(null);

  const loadShift = async () => {
    const current = await api.myShift();
    setShift(current);
    if (current) {
      setSummary(await api.shiftSummary(current.id));
      setArqueos(await api.arqueos(current.id));
    }
  };

  useEffect(() => {
    loadShift();
    api.shiftTemplates().then(setTemplates);
  }, []);

  const loadHistory = async () => {
    const [shifts, sum] = await Promise.all([api.shifts({ desde, hasta }), api.rangeSummary({ desde, hasta })]);
    setHistory(shifts);
    setRangeSummary(sum);
  };

  const loadVentas = async () => {
    setVentas(null);
    setVentas(await api.salesByRange({ desde: ventasDesde, hasta: ventasHasta }));
  };

  const loadAnulaciones = async () => {
    setAnulaciones(null);
    try {
      const list = await api.cancelledSales({ desde: anulacionesDesde, hasta: anulacionesHasta });
      setAnulaciones(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las anulaciones.");
      setAnulaciones([]);
    }
  };

  const openCancelModal = (sale: Sale) => {
    setCancellingSale(sale);
    setCancelMotivo("Venta duplicada");
    setCancelCustomMotivo("");
    const randomHex = Math.random().toString(36).substring(2, 9);
    setCancelCorrelationId(`corr_caja_${Date.now()}_${randomHex}`);
    setCancelIdempotencyKey(`idem_caja_${sale.id.slice(0, 8)}_${Date.now()}`);
  };

  const handleConfirmCancel = async () => {
    if (!cancellingSale) return;
    const finalMotivo = cancelCustomMotivo.trim()
      ? `${cancelMotivo}: ${cancelCustomMotivo.trim()}`
      : cancelMotivo;
    setCancelBusy(true);
    setError(null);
    try {
      await api.cancelSale(cancellingSale.id, finalMotivo, cancelCorrelationId, cancelIdempotencyKey);
      setCancelSuccess(`Venta ${cancellingSale.serie}-${cancellingSale.correlativo} anulada con éxito. Movimientos en caja revertidos para cuadre.`);
      setCancellingSale(null);
      await Promise.all([loadVentas(), loadShift(), loadMovements()]);
      if (tab === "anulaciones") await loadAnulaciones();
      setTimeout(() => setCancelSuccess(null), 6000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al anular la venta.");
    } finally {
      setCancelBusy(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const loadMovements = async () => {
    setMovements(null);
    setError(null);
    try {
      const desdeIso = new Date(`${movementDesde}T${movementHoraDesde || "00:00"}:00`).toISOString();
      const hastaIso = new Date(`${movementHasta}T${movementHoraHasta || "23:59"}:59.999`).toISOString();
      setMovements(await api.cashMovements({ desde: desdeIso, hasta: hastaIso, tipo: movementTipo || undefined, metodo: movementMetodo || undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los movimientos.");
      setMovements([]);
    }
  };

  useEffect(() => {
    if (tab === "historial") loadHistory();
    if (tab === "ventas") loadVentas();
    if (tab === "movimientos") loadMovements();
    if (tab === "anulaciones") loadAnulaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const printSale = async (sale: Sale) => {
    setPrintingId(sale.id);
    setError(null);
    try {
      await printReceiptForSale(sale.id, sale.cuartoId);
    } catch {
      setError("No se pudo preparar la impresión de esa venta.");
    } finally {
      setPrintingId(null);
    }
  };

  const openShift = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.openShift({ plantillaId: plantillaId || null, aperturaCentimos: soles(Number(apertura) || 0) });
      await loadShift();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir el turno.");
    } finally {
      setBusy(false);
    }
  };

  const addMovement = async () => {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      await api.addCashMovement(shift.id, { tipo: movTipo, montoCentimos: soles(Number(movMonto) || 0), motivo: movMotivo });
      setMovMonto("");
      setMovMotivo("");
      setShowMovForm(false);
      setSummary(await api.shiftSummary(shift.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el movimiento.");
    } finally {
      setBusy(false);
    }
  };

  const closeShift = async () => {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      const closed = await api.closeShift(shift.id, { denominaciones: denominacionesCierre, justificacion: justificacion || null });
      setClosing(false);
      setDenominacionesCierre({});
      setJustificacion("");
      try {
        await printShiftClosureReceipt(closed.id);
      } catch (err) {
        console.error("No se pudo abrir el ticket de cuadre:", err);
      }
      await loadShift();
      if (tab === "historial") await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar el turno.");
    } finally {
      setBusy(false);
    }
  };

  const registrarArqueo = async () => {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      await api.registrarArqueo(shift.id, denominacionesArqueo);
      setDenominacionesArqueo({});
      setArqueando(false);
      setArqueos(await api.arqueos(shift.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el arqueo.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = "fecha,usuario,apertura,esperado,declarado,diferencia,estado\n";
    const rows = history
      .map((s) =>
        [
          s.fecha,
          s.usuarioId,
          s.aperturaCentimos / 100,
          (s.efectivoEsperadoCentimos ?? "") && s.efectivoEsperadoCentimos! / 100,
          (s.efectivoDeclaradoCentimos ?? 0) / 100,
          (s.diferenciaCentimos ?? 0) / 100,
          s.estado,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuadre_${desde}_a_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const diferenciaCierre = summary ? sumDenominaciones(denominacionesCierre) - summary.efectivoEsperadoCentimos : 0;

  return (
    <>
      <PageHeader
        title="Caja"
        subtitle="Control del dinero, impuestos y trazabilidad de cada entrada y salida"
        actions={
          <Tabs<Tab>
            tabs={[
              { id: "turno", label: "Mi turno" },
              { id: "movimientos", label: "Movimientos" },
              { id: "ventas", label: "Ventas" },
              { id: "anulaciones", label: "Anulaciones" },
              { id: "historial", label: "Cierres" },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      {cancelSuccess && (
        <div className="mb-4">
          <Notice tone="ok">{cancelSuccess}</Notice>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {/* ---------------- Mi turno ---------------- */}
      {tab === "turno" && (
        <>
          {shift === undefined && <Skeleton className="h-64 rounded-2xl" />}

          {shift === null && (
            <Card className="mx-auto max-w-md p-6">
              <EmptyState
                icon={<IconCash className="h-6 w-6" />}
                title="No tenés un turno abierto"
                hint="Abrí el turno con el monto de apertura para empezar a registrar movimientos."
              />
              <div className="flex flex-col gap-3">
                {templates.length > 0 && (
                  <Field label="Plantilla de turno">
                    <select
                      value={plantillaId}
                      onChange={(e) => setPlantillaId(e.target.value)}
                      className="w-full cursor-pointer rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                    >
                      <option value="">Sin plantilla</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre} ({formatTime12h(t.horaInicio)} – {formatTime12h(t.horaFin)})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Monto de apertura (S/)">
                  <Input type="number" placeholder="0.00" value={apertura} onChange={(e) => setApertura(e.target.value)} />
                </Field>
                <Button variant="primary" size="lg" block onClick={openShift} disabled={busy}>
                  {busy ? "Abriendo…" : "Abrir turno"}
                </Button>
              </div>
            </Card>
          )}

          {shift && summary && !closing && (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Cobrado en el turno" value={format(cents(summary.ventasBrutasCentimos))} hint={`${summary.porMetodo.reduce((sum, item) => sum + item.cantidad, 0)} operaciones cobradas`} icon={<IconReceipt className="h-4 w-4" />} />
                <StatCard label="Valor de venta" value={format(cents(summary.valorVentaCentimos))} hint="Base imponible incluida" tone="tone-sky" delay={40} />
                <StatCard label="IGV (18%)" value={format(cents(summary.igvCentimos))} hint="Impuesto incluido en las ventas" tone="tone-violet" delay={80} />
                <StatCard label="Efectivo esperado" value={format(cents(summary.efectivoEsperadoCentimos))} hint="Dinero físico que debe haber" icon={<IconCash className="h-4 w-4" />} delay={120} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.55fr_0.8fr]">
                <div className="flex flex-col gap-5">
                  <Section title="Resumen del turno" subtitle={`Abierto ${formatDateTime12h(shift.abiertoEn)}`}>
                    <Row label="Fondo de apertura" value={format(cents(summary.aperturaCentimos))} />
                    <Row label="Ingresos manuales" value={format(cents(summary.ingresosManualesCentimos))} tone="text-ok" />
                    <Row label="Egresos manuales" value={`−${format(cents(summary.egresosManualesCentimos))}`} tone="text-danger" />
                    <Row label="Vueltos entregados" value={`−${format(cents(summary.vueltosCentimos))}`} tone="text-danger" />
                    <div className="mt-2 border-t border-line pt-2">
                      <Row label="Efectivo esperado en caja" value={format(cents(summary.efectivoEsperadoCentimos))} strong tone="text-brand" />
                    </div>
                  </Section>

                  {summary.porMetodo.length > 0 && (
                    <Section title="Cobros por método" subtitle="Importes recibidos, incluido el IGV" delay={60}>
                      <div className="grid items-center gap-4 md:grid-cols-[260px_1fr]">
                        <PaymentMethodChart summary={summary} />
                        <div className="grid gap-x-6 sm:grid-cols-2 md:grid-cols-1">
                          {summary.porMetodo.map((m) => (
                            <Row key={m.metodo} label={`${METHOD_LABEL[m.metodo] ?? m.metodo} · ${m.cantidad}`} value={format(cents(m.totalCentimos))} />
                          ))}
                        </div>
                      </div>
                    </Section>
                  )}
                </div>

                <div className="flex flex-col gap-5">
                  <Section title="Acciones rápidas" delay={120}>
                    <div className="mb-3 rounded-xl border border-line bg-inset/60 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-subtle">Fondo inicial</p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{format(cents(summary.aperturaCentimos))}</p>
                    </div>
                  <div className="flex flex-col gap-2">
                    {showMovForm ? (
                      <div className="animate-fade flex flex-col gap-3 rounded-xl bg-inset p-3">
                        <div className="flex gap-1.5">
                          {(["INGRESO", "EGRESO", "AJUSTE"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setMovTipo(t)}
                              className={cx(
                                "flex-1 rounded-lg py-1.5 text-xs font-medium transition-all duration-150",
                                movTipo === t ? (t === "INGRESO" ? "bg-brand text-brand-ink" : t === "EGRESO" ? "bg-danger text-white" : "bg-warn text-white") : "bg-surface text-muted hover:text-ink",
                              )}
                            >
                              {t === "INGRESO" ? "Ingreso" : t === "EGRESO" ? "Egreso" : "Ajuste"}
                            </button>
                          ))}
                        </div>
                        <Input
                          type="number"
                          placeholder={movTipo === "AJUSTE" ? "Monto S/ (negativo para restar)" : "Monto S/"}
                          value={movMonto}
                          onChange={(e) => setMovMonto(e.target.value)}
                        />
                        <Input placeholder="Motivo" value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} />
                        <div className="flex gap-2">
                          <Button block onClick={() => setShowMovForm(false)}>
                            Cancelar
                          </Button>
                          <Button block variant="primary" onClick={addMovement} disabled={busy || !movMonto || !movMotivo}>
                            Registrar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button block onClick={() => setShowMovForm(true)}>
                        + Ingreso / egreso / ajuste manual
                      </Button>
                    )}

                    {arqueando ? (
                      <div className="animate-fade flex flex-col gap-3 rounded-xl bg-inset p-3">
                        <p className="text-xs text-muted">Conteo sin cerrar el turno — esperado {format(cents(summary.efectivoEsperadoCentimos))}</p>
                        <DenominationCounter value={denominacionesArqueo} onChange={setDenominacionesArqueo} />
                        <div className="flex gap-2">
                          <Button block onClick={() => setArqueando(false)}>
                            Cancelar
                          </Button>
                          <Button block variant="primary" onClick={registrarArqueo} disabled={busy}>
                            Registrar arqueo
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button block onClick={() => setArqueando(true)}>
                        Arqueo intermedio
                      </Button>
                    )}

                    <Button block variant="ghost" onClick={() => printShiftClosureReceipt(shift.id)}>
                      <span className="inline-flex items-center gap-1.5">
                        <IconPrinter className="h-4 w-4" />
                        <span>Imprimir cuadre (80 mm)</span>
                      </span>
                    </Button>

                    <Button block variant="warn" onClick={() => setClosing(true)}>
                      Cerrar turno
                    </Button>
                  </div>
                  </Section>

                {arqueos.length > 0 && (
                  <Section title="Arqueos de este turno" delay={180}>
                    {arqueos.map((a) => (
                      <Row
                        key={a.id}
                        label={formatTimeOnly12h(a.creadoEn)}
                        value={format(cents(a.diferenciaCentimos))}
                        tone={a.diferenciaCentimos === 0 ? "text-ok" : "text-warn"}
                      />
                    ))}
                  </Section>
                )}
                </div>
              </div>
            </div>
          )}

          {shift && closing && summary && (
            <Card className="mx-auto max-w-lg p-6">
              <h2 className="mb-1 text-base font-semibold text-ink">Cierre de turno</h2>
              <p className="mb-4 text-sm text-muted">Contá el efectivo billete por billete — esperado {format(cents(summary.efectivoEsperadoCentimos))}</p>

              <DenominationCounter value={denominacionesCierre} onChange={setDenominacionesCierre} />

              {Object.keys(denominacionesCierre).length > 0 && (
                <div className="mt-3">
                  <Notice kind={diferenciaCierre === 0 ? "ok" : "warn"}>Diferencia: {format(cents(diferenciaCierre))}</Notice>
                </div>
              )}

              <div className="mt-3">
                <Field label="Justificación (si hay diferencia)">
                  <Textarea rows={2} placeholder="Motivo de la diferencia…" value={justificacion} onChange={(e) => setJustificacion(e.target.value)} />
                </Field>
              </div>

              <div className="mt-4 flex gap-2">
                <Button block onClick={() => setClosing(false)}>
                  Atrás
                </Button>
                <Button block variant="warn" onClick={closeShift} disabled={busy}>
                  {busy ? "Cerrando…" : "Confirmar cierre"}
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ---------------- Libro de movimientos ---------------- */}
      {tab === "movimientos" && (
        <>
          <Card className="mb-5 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_.72fr_.72fr_1fr_1fr_auto] xl:items-end">
              <Field label="Desde">
                <Input type="date" value={movementDesde} onChange={(e) => setMovementDesde(e.target.value)} />
              </Field>
              <Field label="Hasta">
                <Input type="date" value={movementHasta} onChange={(e) => setMovementHasta(e.target.value)} />
              </Field>
              <Field label="Hora inicial">
                <Input type="time" value={movementHoraDesde} onChange={(e) => setMovementHoraDesde(e.target.value)} />
              </Field>
              <Field label="Hora final">
                <Input type="time" value={movementHoraHasta} onChange={(e) => setMovementHoraHasta(e.target.value)} />
              </Field>
              <Field label="Movimiento">
                <select value={movementTipo} onChange={(e) => setMovementTipo(e.target.value)} className="w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25">
                  <option value="">Todos</option>
                  {Object.entries(MOVEMENT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Método">
                <select value={movementMetodo} onChange={(e) => setMovementMetodo(e.target.value)} className="w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25">
                  <option value="">Todos</option>
                  {Object.entries(METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Button variant="primary" onClick={loadMovements}>Aplicar filtros</Button>
            </div>
          </Card>

          <Section
            title="Todos los movimientos"
            subtitle={movements ? `${movements.length} registros entre ${movementHoraDesde} y ${movementHoraHasta}` : "Cargando trazabilidad…"}
          >
            {movements === null ? (
              <div className="flex flex-col gap-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : movements.length === 0 ? (
              <EmptyState icon={<IconCash className="h-6 w-6" />} title="No hay movimientos" hint="Probá ampliando las fechas, horas o quitando filtros." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-subtle">
                    <tr>
                      <th className="pb-3 font-semibold">Fecha y hora</th>
                      <th className="pb-3 font-semibold">Tipo</th>
                      <th className="pb-3 font-semibold">Método / referencia</th>
                      <th className="pb-3 font-semibold">Registrado por</th>
                      <th className="pb-3 font-semibold">Motivo</th>
                      <th className="pb-3 text-right font-semibold">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id} className="border-t border-line-soft transition-colors hover:bg-inset/60">
                        <td className="py-3 pr-4 tabular-nums text-muted">{formatDateTime12h(movement.ocurridoEn)}</td>
                        <td className="py-3 pr-4"><Badge tone={movementTone(movement.tipo)}>{MOVEMENT_LABEL[movement.tipo]}</Badge></td>
                        <td className="py-3 pr-4 text-muted">
                          {movement.metodo ? METHOD_LABEL[movement.metodo] ?? movement.metodo : "—"}
                          {movement.ventaId ? <span className="block text-[11px] text-subtle">Venta {movement.ventaId.slice(0, 8)}</span> : null}
                        </td>
                        <td className="py-3 pr-4 text-muted">{movement.usuarioNombre}</td>
                        <td className="max-w-[260px] truncate py-3 pr-4 text-muted">{movement.motivo || "—"}</td>
                        <td className={cx("py-3 text-right font-semibold tabular-nums", movement.tipo === "EGRESO" || movement.tipo === "VUELTO" ? "text-danger" : movement.tipo === "CIERRE" ? "text-muted" : "text-ok")}>{movementAmount(movement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {/* ---------------- Ventas ---------------- */}
      {tab === "ventas" && (
        <>
          <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
            <Field label="Desde">
              <Input type="date" value={ventasDesde} onChange={(e) => setVentasDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={ventasHasta} onChange={(e) => setVentasHasta(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={loadVentas}>
              Filtrar
            </Button>
            <span className="ml-auto self-center text-sm text-muted">
              {ventas ? (() => {
                const total = cents(ventas.reduce((s, v) => s + v.totalCentimos, 0));
                const impuestos = splitIncludedIgv(total);
                return `${ventas.length} venta${ventas.length === 1 ? "" : "s"} · IGV ${format(impuestos.igv)} · Total ${format(total)}`;
              })() : ""}
            </span>
          </Card>

          <Section title="Ventas registradas" subtitle="Cada venta con su cliente — imprime la boleta emitida, o el borrador si todavía no se emitió">
            {ventas === null ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : ventas.length === 0 ? (
              <EmptyState icon={<IconReceipt className="h-6 w-6" />} title="Sin ventas en ese rango" hint="Cambiá las fechas para ver otro periodo." />
            ) : (
              <div className="flex flex-col gap-2">
                {ventas.map((v, i) => (
                  <div
                    key={v.id}
                    className="stagger flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3"
                    style={{ ["--i" as string]: i }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {v.clienteNombres ? `${v.clienteNombres} ${v.clienteApellidos ?? ""}`.trim() : "Sin cliente"}
                        {v.clienteDni ? <span className="ml-2 text-xs font-normal text-subtle">DNI {v.clienteDni}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {v.serie}-{v.correlativo} · {formatDateTime12h(v.creadoEn)}
                      </p>
                      {v.estado === "ANULADA" && v.motivoAnulacion && (
                        <p className="mt-1 text-xs font-medium text-rose-500">
                          Motivo: {v.motivoAnulacion}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cx("text-sm font-semibold tabular-nums", v.estado === "ANULADA" ? "line-through text-muted" : "text-ink")}>
                        {format(cents(v.totalCentimos))}
                      </span>
                      {v.estado === "ANULADA" ? (
                        <Badge tone="tone-red">Anulada</Badge>
                      ) : (
                        <Badge tone={v.saldoCentimos > 0 ? "tone-amber" : "tone-teal"}>
                          {v.saldoCentimos > 0 ? "Con saldo" : "Pagada"}
                        </Badge>
                      )}
                      <Button size="sm" icon={<IconPrinter className="h-3.5 w-3.5" />} onClick={() => printSale(v)} disabled={printingId === v.id}>
                        {printingId === v.id ? "…" : "Imprimir"}
                      </Button>
                      {v.estado !== "ANULADA" && (
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<IconTrash className="h-3.5 w-3.5" />}
                          onClick={() => openCancelModal(v)}
                          title="Anular venta duplicada o por error de digitación para corregir el cuadre de caja"
                        >
                          Anular
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {/* ---------------- Anulaciones de ventas ---------------- */}
      {tab === "anulaciones" && (
        <>
          <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
            <Field label="Desde">
              <Input type="date" value={anulacionesDesde} onChange={(e) => setAnulacionesDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={anulacionesHasta} onChange={(e) => setAnulacionesHasta(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={loadAnulaciones}>
              Filtrar
            </Button>
            <span className="ml-auto self-center text-sm text-muted">
              {anulaciones ? `${anulaciones.length} venta${anulaciones.length === 1 ? "" : "s"} anulada${anulaciones.length === 1 ? "" : "s"}` : ""}
            </span>
          </Card>

          <Section title="Ventas anuladas" subtitle="Historial de ventas dadas de baja por duplicidad o error de digitación — no suman en el cuadre de caja">
            {anulaciones === null ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : anulaciones.length === 0 ? (
              <EmptyState icon={<IconFileX className="h-6 w-6" />} title="Sin ventas anuladas en este rango" hint="Cambiá las fechas para ver otro periodo." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-inset text-xs uppercase tracking-wide text-subtle">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Venta</th>
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      <th className="px-4 py-3 font-semibold">Motivo</th>
                      <th className="px-4 py-3 font-semibold">Anulado por</th>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Trazabilidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {anulaciones.map((a) => (
                      <tr key={a.id} className="transition-colors hover:bg-inset/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink">{a.serie}-{a.correlativo}</p>
                          <span className="text-[11px] text-muted">ID: {a.id.slice(0, 8)}</span>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {a.clienteNombres ? `${a.clienteNombres} ${a.clienteApellidos ?? ""}`.trim() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-500 line-through">
                          {format(cents(a.totalCentimos))}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="tone-red">{a.motivoAnulacion || "Anulada"}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted text-xs">
                          {a.anuladoPorNombre ?? a.anuladoPorUsuarioId ?? "Usuario"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted tabular-nums">
                          {formatDateTime12h(a.anuladoEn ?? a.creadoEn)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {a.correlationId && (
                            <div className="flex items-center gap-1">
                              <code className="text-[10px] bg-inset px-1.5 py-0.5 rounded font-mono text-subtle">
                                {a.correlationId.slice(0, 16)}…
                              </code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(a.correlationId!, `tab_corr_${a.id}`)}
                                className="text-[10px] text-brand hover:underline"
                              >
                                {copiedKey === `tab_corr_${a.id}` ? "✓" : "Copiar"}
                              </button>
                            </div>
                          )}
                          {a.idempotencyKey && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <code className="text-[10px] bg-inset px-1.5 py-0.5 rounded font-mono text-subtle">
                                {a.idempotencyKey.slice(0, 16)}…
                              </code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(a.idempotencyKey!, `tab_idem_${a.id}`)}
                                className="text-[10px] text-brand hover:underline"
                              >
                                {copiedKey === `tab_idem_${a.id}` ? "✓" : "Copiar"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {/* ---------------- Historial de turnos ---------------- */}
      {tab === "historial" && (
        <>
          <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
            <Field label="Desde">
              <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={loadHistory}>
              Filtrar
            </Button>
            <Button className="ml-auto" onClick={exportCsv} disabled={history.length === 0}>
              Exportar CSV
            </Button>
          </Card>

          {rangeSummary && (
            <Section title="Resumen del periodo" className="mb-5">
              <Row label="Ventas brutas" value={format(cents(rangeSummary.ventasBrutasCentimos))} strong />
              <Row label="Valor de venta" value={format(cents(rangeSummary.valorVentaCentimos))} />
              <Row label="IGV (18%)" value={format(cents(rangeSummary.igvCentimos))} strong tone="text-brand" />
              <Row label="Efectivo esperado del periodo" value={format(cents(rangeSummary.efectivoEsperadoCentimos))} strong tone="text-brand" />
              {rangeSummary.porMetodo.map((m) => (
                <Row key={m.metodo} label={METHOD_LABEL[m.metodo] ?? m.metodo} value={format(cents(m.totalCentimos))} />
              ))}
            </Section>
          )}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-inset text-xs uppercase tracking-wide text-subtle">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Esperado</th>
                    <th className="px-4 py-3 text-right font-semibold">Declarado</th>
                    <th className="px-4 py-3 text-right font-semibold">Diferencia</th>
                    <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id} className="border-t border-line-soft transition-colors hover:bg-inset/50">
                      <td className="px-4 py-3 text-ink">{s.fecha}</td>
                      <td className="px-4 py-3">
                        <Badge tone={s.estado === "ABIERTO" ? "tone-sky" : "tone-stone"}>{s.estado === "ABIERTO" ? "Abierto" : "Cerrado"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{s.efectivoEsperadoCentimos !== null ? format(cents(s.efectivoEsperadoCentimos)) : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">{s.efectivoDeclaradoCentimos !== null ? format(cents(s.efectivoDeclaradoCentimos)) : "—"}</td>
                      <td className={cx("px-4 py-3 text-right tabular-nums", s.diferenciaCentimos ? "font-medium text-warn" : "text-muted")}>
                        {s.diferenciaCentimos !== null ? format(cents(s.diferenciaCentimos)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title="Imprimir cuadre de caja (80 mm)"
                          onClick={() => printShiftClosureReceipt(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-xs hover:border-brand hover:text-brand transition-colors active:scale-95"
                        >
                          <IconPrinter className="h-3.5 w-3.5" />
                          <span>Imprimir cuadre</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted">
                        Sin turnos en ese rango.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ---------------- Modal para anular venta ---------------- */}
      {cancellingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="relative w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-line-soft pb-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-500 mb-1">
                  <IconAlertTriangle className="h-3.5 w-3.5" />
                  Anulación de venta
                </span>
                <h3 className="text-lg font-bold text-ink">
                  Anular venta {cancellingSale.serie}-{cancellingSale.correlativo}
                </h3>
                <p className="text-xs text-muted">
                  Total: <strong className="text-ink">{format(cents(cancellingSale.totalCentimos))}</strong> · Cliente: {cancellingSale.clienteNombres ? `${cancellingSale.clienteNombres} ${cancellingSale.clienteApellidos ?? ""}`.trim() : "Sin cliente"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancellingSale(null)}
                className="rounded-lg p-1 text-muted hover:bg-inset hover:text-ink transition-colors"
                disabled={cancelBusy}
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-semibold">¿Por qué anular esta venta?</p>
              <p>
                Al anularla, <strong>se revertirán los movimientos en caja de este turno</strong> para que el efectivo esperado coincida con tu arqueo real (eliminando descuadres por ventas duplicadas o doble digitación). También se devolverá el stock de productos y se liberará la habitación si estaba vinculada.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-subtle">
                Motivo de anulación
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Venta duplicada",
                  "Error de digitación",
                  "Cobro duplicado por POS / billetera",
                  "Cliente canceló servicio",
                  "Otro motivo",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCancelMotivo(preset)}
                    className={cx(
                      "rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                      cancelMotivo === preset
                        ? "bg-rose-500 text-white shadow-sm"
                        : "bg-inset text-muted hover:bg-line hover:text-ink",
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Detalle adicional (ej: se digitó 2 veces el cobro por error en caja)..."
                value={cancelCustomMotivo}
                onChange={(e) => setCancelCustomMotivo(e.target.value)}
              />
            </div>

            {/* Trazabilidad técnica */}
            <div className="rounded-xl border border-line bg-inset/40 p-3 space-y-1.5 text-xs">
              <span className="font-semibold text-subtle text-[11px] uppercase tracking-wider">Trazabilidad de la operación</span>
              <div className="flex items-center justify-between text-muted text-[11px]">
                <span>Correlation ID:</span>
                <code className="font-mono bg-surface px-1.5 py-0.5 rounded text-ink">{cancelCorrelationId}</code>
              </div>
              <div className="flex items-center justify-between text-muted text-[11px]">
                <span>Idempotency Key:</span>
                <code className="font-mono bg-surface px-1.5 py-0.5 rounded text-ink">{cancelIdempotencyKey}</code>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-3">
              <Button onClick={() => setCancellingSale(null)} disabled={cancelBusy}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                icon={<IconTrash className="h-4 w-4" />}
                onClick={handleConfirmCancel}
                disabled={cancelBusy}
              >
                {cancelBusy ? "Anulando..." : "Confirmar anulación"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
