import { toast } from "@casacarlos/ui/components/sonner";
import { IconCash as ModuleIcon, IconAlertTriangle, IconCash, IconCheck, IconFileX, IconPrinter, IconReceipt, IconSliders, IconTrash, IconX } from "@casacarlos/ui";
import { ActionButton } from "@casacarlos/ui/components/action-button";
import { ModalFrame } from "@casacarlos/ui/components/modal-frame";

import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@casacarlos/ui/components/table";
import { Select } from "../components/ui.js";
import { useEffect, useRef, useState } from "react";
import type { Arqueo, CancelledSale, CashboxAutomation, CashMovementType, CashSummary, RoomBoardEntry, Sale, Shift, ShiftTemplate } from "@casacarlos/contracts";
import { formatDateTime12h, formatTime12h, formatTimeOnly12h } from "@casacarlos/contracts";
import { cents, format, soles, splitIncludedIgv } from "@casacarlos/money";

import { ArcElement, Chart as ChartJS, Legend, Tooltip as ChartTooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { api, ApiError, type CashMovementView, type ArqueoView, type ShiftCuadreDto } from "../api.js";
import { DenominationCounter, sumDenominaciones } from "../components/DenominationCounter.js";
import { printArqueoReceipt, printReceiptForSale, printShiftClosureReceipt } from "../components/receipt.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Row, Section, Skeleton, StatCard, Tabs, Textarea, cx } from "../components/ui.js";
import { SaleHistoryDialog } from "../components/SaleHistoryDialog.js";
import { CashReportDialog } from "../components/CashReportDialog.js";
import { ShiftTemplatesManager } from "./ShiftTemplatesManager.js";

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

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d);
};

type Tab = "turno" | "turnos" | "movimientos" | "ventas" | "anulaciones" | "historial";

const MOVEMENT_LABEL: Record<CashMovementType, string> = {
  APERTURA: "Apertura de caja",
  VENTA: "Cobro de venta",
  ANULACION: "Anulación de venta",
  CORRECCION: "Corrección de salida",
  DEVOLUCION: "Devolución por corrección de salida",
  INGRESO: "Ingreso manual",
  EGRESO: "Egreso manual",
  AJUSTE: "Ajuste",
  VUELTO: "Vuelto entregado",
  CIERRE: "Cierre de caja",
  TRASPASO_SALIDA: "Fondo entregado al siguiente turno",
};

const movementTone = (tipo: CashMovementType): string => {
  if (tipo === "VENTA" || tipo === "INGRESO" || tipo === "APERTURA") return "tone-teal";
  if (tipo === "EGRESO" || tipo === "VUELTO" || tipo === "ANULACION" || tipo === "DEVOLUCION") return "tone-red";
  if (tipo === "AJUSTE") return "tone-amber";
  return "tone-stone";
};

const movementAmount = (movement: CashMovementView): string => {
  const outgoing = movement.tipo === "EGRESO" || movement.tipo === "TRASPASO_SALIDA" || movement.tipo === "VUELTO" || movement.tipo === "ANULACION" || movement.tipo === "DEVOLUCION" || (movement.tipo === "AJUSTE" && movement.montoCentimos < 0);
  const neutral = movement.tipo === "CIERRE" || movement.tipo === "CORRECCION";
  return `${outgoing ? "−" : neutral ? "" : "+"}${format(cents(Math.abs(movement.montoCentimos)))}`;
};

ChartJS.register(ArcElement, ChartTooltip, Legend);

function PaymentMethodChart({ summary }: { summary: CashSummary }) {
  const data = {
    labels: summary.porMetodo.filter((item) => item.totalCentimos > 0).map((item) => METHOD_LABEL[item.metodo] ?? item.metodo),
    datasets: [
      {
        data: summary.porMetodo.filter((item) => item.totalCentimos > 0).map((item) => item.totalCentimos / 100),
        backgroundColor: ["#14b8a6", "#7c3aed", "#0ea5e9", "#f59e0b", "#ec4899", "#22c55e", "#6366f1", "#f97316"],
        borderColor: "transparent",
        hoverOffset: 5,
      },
    ],
  };
  return (
    <div className="mx-auto h-52 max-w-[280px]">
      <Doughnut
        aria-label="Distribución de cobros por método de pago"
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
  const [legacyShifts, setLegacyShifts] = useState<Shift[]>([]);
  const [automation, setAutomation] = useState<CashboxAutomation | null>(null);
  const [legacyClosing, setLegacyClosing] = useState<Shift | null>(null);
  const loadRevision = useRef(0);
  const activeShiftId = useRef<string | null | undefined>(undefined);
  const refreshVisibleList = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [plantillaId, setPlantillaId] = useState("");
  const [apertura, setApertura] = useState("");

  const [movTipo, setMovTipo] = useState<"INGRESO" | "EGRESO" | "AJUSTE">("INGRESO");
  const [movMonto, setMovMonto] = useState("");
  const [movMotivo, setMovMotivo] = useState("");
  const [showMovForm, setShowMovForm] = useState(false);

  const [closing, setClosing] = useState(false);
  const [pendingRoomsToWarn, setPendingRoomsToWarn] = useState<RoomBoardEntry[]>([]);
  const [showPendingRoomsWarning, setShowPendingRoomsWarning] = useState(false);
  const [cuadre, setCuadre] = useState<ShiftCuadreDto | null>(null);
  const [denominacionesCierre, setDenominacionesCierre] = useState<Record<string, number>>({});
  const [justificacion, setJustificacion] = useState("");

  const [arqueando, setArqueando] = useState(false);
  const [denominacionesArqueo, setDenominacionesArqueo] = useState<Record<string, number>>({});
  const [arqueos, setArqueos] = useState<ArqueoView[]>([]);

  const [desde, setDesde] = useState(daysAgoIso(7));
  const [hasta, setHasta] = useState(todayIso());
  const [history, setHistory] = useState<Shift[]>([]);
  const [rangeSummary, setRangeSummary] = useState<CashSummary | null>(null);

  const [ventasDesde, setVentasDesde] = useState(todayIso());
  const [ventasHasta, setVentasHasta] = useState(todayIso());
  const [ventas, setVentas] = useState<Sale[] | null>(null);
  const [historySaleId, setHistorySaleId] = useState<string | null>(null);
  const [reportShiftId, setReportShiftId] = useState<string | null>(null);
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
    const revision = ++loadRevision.current;
    const current = await api.myShift();
    const [legacy, config] = await Promise.all([api.legacyShifts(), api.cashboxAutomation()]);
    if (revision !== loadRevision.current) return;
    if (activeShiftId.current !== undefined && activeShiftId.current !== current?.id && activeShiftId.current !== (current?.id ?? null)) {
      setClosing(false); setShowPendingRoomsWarning(false); setArqueando(false); setShowMovForm(false);
      setDenominacionesCierre({}); setDenominacionesArqueo({}); setJustificacion("");
      toast.info("La caja activa cambió. Se actualizó el turno compartido.");
    }
    activeShiftId.current = current?.id ?? null;
    setShift(current);
    setLegacyShifts(legacy);
    setAutomation(config);
    if (current) {
      const [sum, arqs, cdr] = await Promise.all([
        api.shiftSummary(current.id),
        api.arqueos(current.id),
        api.shiftCuadre(current.id).catch(() => null),
      ]);
      if (revision !== loadRevision.current) return;
      setSummary(sum);
      setArqueos(arqs);
      setCuadre(cdr);
    } else {
      setSummary(null);
      setArqueos([]);
      setCuadre(null);
    }
  };

  useEffect(() => {
    const refresh = () => { void loadShift().catch(err => setError(err.message)); refreshVisibleList.current(); };
    let pending: ReturnType<typeof setTimeout>;
    const invalidate = () => { clearTimeout(pending); pending = setTimeout(refresh, 75); };
    refresh();
      api.shiftTemplates().then((list) => {
        if (list) setTemplates(list);
      }).catch(console.error);
    window.addEventListener("casacarlos:cashbox-changed", invalidate);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => { ++loadRevision.current; clearInterval(timer); clearTimeout(pending); window.removeEventListener("casacarlos:cashbox-changed", invalidate); window.removeEventListener("focus", refresh); };
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
      setCancelSuccess(`Venta ${cancellingSale.serie}-${cancellingSale.correlativo} anulada con éxito. Anulación registrada con motivo en la caja abierta.`);
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

  const copyToClipboard = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); } catch { toast.error("No se pudo copiar. Selecciona el código para copiarlo manualmente."); return; }
    toast.success("Copiado al portapapeles");
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

  refreshVisibleList.current = () => {
    if (tab === "historial") void loadHistory().catch(err => setError(err.message));
    if (tab === "ventas") void loadVentas().catch(err => setError(err.message));
    if (tab === "movimientos") void loadMovements();
    if (tab === "anulaciones") void loadAnulaciones();
  };

  const printSale = async (sale: Sale) => {
    setPrintingId(sale.id);
    setError(null);
    try {
      await printReceiptForSale(sale.id, sale.cuartoNumero);
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

  const handleInitiateClosing = async () => {
    setBusy(true);
    setError(null);
    try {
      const board = await api.board();
      const occupied = board
        .flatMap((f) => f.rooms)
        .filter((r) => ["OCUPADO", "EN_TOLERANCIA", "EXCEDIDO"].includes(r.estado));
      if (occupied.length > 0) {
        setPendingRoomsToWarn(occupied);
        setShowPendingRoomsWarning(true);
        return;
      }
      setClosing(true);
    } catch {
      setClosing(true);
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

  const closeLegacyShift = async () => {
    if (!legacyClosing || !justificacion.trim()) return;
    setBusy(true); setError(null);
    try {
      await api.closeShift(legacyClosing.id, { denominaciones: denominacionesCierre, justificacion: `Conciliación de turno anterior: ${justificacion.trim()}` });
      setLegacyClosing(null); setDenominacionesCierre({}); setJustificacion("");
      await loadShift(); if (tab === "historial") await loadHistory();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo conciliar el turno anterior."); }
    finally { setBusy(false); }
  };

  const registrarArqueo = async () => {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      const arqueo = await api.registrarArqueo(shift.id, denominacionesArqueo);
      setDenominacionesArqueo({});
      setArqueando(false);
      const list = await api.arqueos(shift.id);
      setArqueos(list);
      if (arqueo?.id) {
        try {
          await printArqueoReceipt(arqueo.id);
        } catch (printErr) {
          console.error("Error al imprimir ticket de arqueo:", printErr);
        }
      }
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
      <PageHeader icon={<ModuleIcon className="h-5 w-5" />}
        title="Caja"
        subtitle="Control del dinero, impuestos y trazabilidad de cada entrada y salida"
        actions={
          <Tabs<Tab>
            tabs={[
              { id: "turno", label: "Caja compartida" },
              { id: "turnos", label: "Turnos y Horarios" },
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
          <Notice kind="ok">{cancelSuccess}</Notice>
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {legacyShifts.length > 0 && <Card className="mb-5 border-warn/30 p-4 space-y-3">
        <p className="font-semibold text-ink">{legacyShifts.length} turno(s) anterior(es) pendiente(s) de conciliar</p>
        <p className="text-sm text-muted">La caja compartida usa el turno activo más reciente. Los turnos anteriores y sus movimientos se conservaron íntegros. Revisa su dinero por separado: sus fondos no se suman automáticamente para evitar duplicarlos.</p>
        <div className="flex flex-wrap gap-2">{legacyShifts.map(s => <Button key={s.id} onClick={() => { setLegacyClosing(s); setDenominacionesCierre({}); setJustificacion(""); }}>Revisar turno del {formatDateTime12h(s.abiertoEn)}</Button>)}</div>
      </Card>}

      {/* ---------------- Caja compartida ---------------- */}
      {tab === "turno" && (
        <>
          {shift === undefined && <Skeleton className="h-64 rounded-2xl" />}

          {shift === null && (
            <Card className="mx-auto max-w-md p-6">
              <EmptyState
                icon={<IconCash className="h-6 w-6" />}
                title="La caja del hotel está cerrada"
                hint="La apertura y los movimientos se comparten entre todos los recepcionistas. Declara el fondo inicial para comenzar."
              />
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">Plantilla de turno</span>
                    <ActionButton
                      type="button"
                      onClick={() => setTab("turnos")}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      <IconSliders className="h-3 w-3" />
                      Modificar / crear turnos
                    </ActionButton>
                  </div>

                  {/* Selección de turno directa y táctil (100% visible sin popups bloqueados del sistema) */}
                  {automation?.habilitado && automation.horarioValido ? <Notice kind="info">El horario del turno se asignará automáticamente según la hora de Lima. Solo declara el fondo inicial.</Notice> : <div className="grid gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                    <ActionButton
                      type="button"
                      onClick={() => setPlantillaId("")}
                      className={cx(
                        "flex items-center justify-between rounded-xl border p-2.5 text-left transition-all duration-150 active:scale-[0.99]",
                        plantillaId === "" ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-surface hover:bg-inset",
                      )}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={cx("font-semibold text-xs truncate", plantillaId === "" ? "text-brand" : "text-ink")}>
                          Sin plantilla
                        </p>
                        <p className="text-[11px] text-muted">Apertura general sin horario asignado</p>
                      </div>
                      {plantillaId === "" && (
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                          <IconCheck className="h-3 w-3" />
                        </span>
                      )}
                    </ActionButton>

                    {templates.map((t) => {
                      const isSelected = plantillaId === t.id;
                      return (
                        <ActionButton
                          key={t.id}
                          type="button"
                          onClick={() => setPlantillaId(t.id)}
                          className={cx(
                            "flex items-center justify-between rounded-xl border p-2.5 text-left transition-all duration-150 active:scale-[0.99]",
                            isSelected ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line bg-surface hover:bg-inset",
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <p className={cx("font-semibold text-xs truncate", isSelected ? "text-brand" : "text-ink")}>
                              {t.nombre}
                            </p>
                            <p className="text-[11px] text-muted">
                              {formatTime12h(t.horaInicio)} – {formatTime12h(t.horaFin)}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-brand-ink">
                              <IconCheck className="h-3 w-3" />
                            </span>
                          )}
                        </ActionButton>
                      );
                    })}
                  </div>}

                  {templates.length === 0 && (
                    <div className="rounded-xl border border-dashed border-line bg-inset/50 p-3 text-center space-y-1.5">
                      <p className="text-xs text-muted">No hay turnos registrados en el sistema.</p>
                      <ActionButton
                        type="button"
                        onClick={() => setTab("turnos")}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        ⚡ Configurar 3 turnos de atención (9am, 5pm, 1am)
                      </ActionButton>
                    </div>
                  )}
                </div>
                <Field label="Monto de apertura (S/)">
                  <Input aria-label="Fondo inicial en soles" type="number" min="0" step="0.01" placeholder="0.00" value={apertura} onChange={(e) => setApertura(e.target.value)} />
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
                <StatCard label="Cobros menos anulaciones y devoluciones" value={format(cents(summary.ventasBrutasCentimos))} hint={`${summary.porMetodo.reduce((sum, item) => sum + item.cantidad, 0)} operaciones cobradas`} icon={<IconReceipt className="h-4 w-4" />} />
                <StatCard label="Valor de venta" value={format(cents(summary.valorVentaCentimos))} hint="Base imponible incluida" tone="tone-sky" delay={40} />
                <StatCard label="IGV (18%)" value={format(cents(summary.igvCentimos))} hint="Impuesto incluido en las ventas" tone="tone-violet" delay={80} />
                <StatCard label="Efectivo esperado" value={format(cents(summary.efectivoEsperadoCentimos))} hint="Dinero físico que debe haber" icon={<IconCash className="h-4 w-4" />} delay={120} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.55fr_0.8fr]">
                <div className="flex flex-col gap-5">
                  <Section
                    title="Resumen del turno"
                    subtitle={`Abierto ${formatDateTime12h(shift.abiertoEn)}${
                      templates.find((t) => t.id === shift.plantillaId)
                        ? ` · ${templates.find((t) => t.id === shift.plantillaId)!.nombre} (${formatTime12h(templates.find((t) => t.id === shift.plantillaId)!.horaInicio)} – ${formatTime12h(templates.find((t) => t.id === shift.plantillaId)!.horaFin)})`
                        : ""
                    }`}
                  >
                    <p className="mb-3 text-xs text-muted">Caja compartida por todos los recepcionistas. Cada operación conserva su usuario.</p>
                    {shift.programadoHasta && <p className="mb-3 text-sm font-medium text-brand">Próximo relevo automático: {formatDateTime12h(shift.programadoHasta)}</p>}
                    {shift.turnoAnteriorId && <Notice kind="info">El fondo inicial se recibió del turno anterior por relevo automático. Registra un arqueo para verificar el efectivo físico.</Notice>}
                    <Row label="Fondo de apertura" value={format(cents(summary.aperturaCentimos))} />
                    <Row label="Ingresos manuales" value={format(cents(summary.ingresosManualesCentimos))} tone="text-ok" />
                    <Row label="Egresos manuales" value={`−${format(cents(summary.egresosManualesCentimos))}`} tone="text-danger" />
                    <Row label="Vueltos entregados (informativo)" value={`−${format(cents(summary.vueltosCentimos))}`} tone="text-danger" />
                    <div className="mt-2 border-t border-line pt-2">
                      <Row label="Efectivo esperado en caja" value={format(cents(summary.efectivoEsperadoCentimos))} strong tone="text-brand" />
                    </div>
                  </Section>

                  {cuadre?.totalesConceptos && (
                    <Section title="Composición de ventas vinculadas" subtitle="Importes completos de las ventas; los cobros de este turno figuran por separado" delay={40}>
                      <Row label="Hospedaje / Habitaciones" value={format(cents(cuadre.totalesConceptos.totalHospedajeCentimos))} />
                      <Row label="Horas extra / Excesos" value={format(cents(cuadre.totalesConceptos.totalHorasExtraCentimos))} strong tone="text-brand" />
                      <Row label="Productos / Consumo" value={format(cents(cuadre.totalesConceptos.totalProductosCentimos))} />
                      {cuadre.totalesConceptos.totalOtrosCargosCentimos > 0 && (
                        <Row label="Otros cargos" value={format(cents(cuadre.totalesConceptos.totalOtrosCargosCentimos))} />
                      )}
                      <Row label="Vueltos entregados (informativo)" value={`−${format(cents(cuadre.totalesConceptos.totalVueltosCentimos))}`} tone="text-danger" />
                    </Section>
                  )}

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
                            <ActionButton
                              key={t}
                              onClick={() => setMovTipo(t)}
                              className={cx(
                                "flex-1 rounded-lg py-1.5 text-xs font-medium transition-all duration-150",
                                movTipo === t ? (t === "INGRESO" ? "bg-brand text-brand-ink" : t === "EGRESO" ? "bg-danger text-white" : "bg-warn text-white") : "bg-surface text-muted hover:text-ink",
                              )}
                            >
                              {t === "INGRESO" ? "Ingreso" : t === "EGRESO" ? "Egreso" : "Ajuste"}
                            </ActionButton>
                          ))}
                        </div>
                        <Input aria-label={movTipo === "AJUSTE" ? "Monto S/ (negativo para restar)" : "Monto S/"}
                          type="number"
                          placeholder={movTipo === "AJUSTE" ? "Monto S/ (negativo para restar)" : "Monto S/"}
                          value={movMonto}
                          onChange={(e) => setMovMonto(e.target.value)}
                        />
                        <Input aria-label="Motivo" placeholder="Motivo" value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} />
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
                            Registrar e imprimir arqueo (80 mm)
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

                    <Button block variant="warn" onClick={handleInitiateClosing}>
                      Cerrar turno
                    </Button>
                  </div>
                  </Section>

                {arqueos.length > 0 && (
                  <Section title="Arqueos de este turno" delay={180}>
                    <div className="flex flex-col gap-2">
                      {arqueos.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-xl border border-line-soft bg-surface p-2.5 shadow-xs">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-xs font-semibold text-ink">{formatTimeOnly12h(a.creadoEn)}</span>
                            <span className="truncate text-[11px] text-muted">{a.usuarioNombre || "Recepcionista"} • Contado: {format(cents(a.totalCentimos))}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={cx("text-xs font-bold", a.diferenciaCentimos === 0 ? "text-ok" : "text-warn")}>
                              {a.diferenciaCentimos === 0 ? "Cuadrado" : format(cents(a.diferenciaCentimos))}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void printArqueoReceipt(a.id)}
                              title="Imprimir ticket de arqueo (80 mm)"
                              icon={<IconPrinter className="h-3.5 w-3.5" />}
                            >
                              Ticket
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
                </div>
              </div>

              {shift && <Button className="mb-3" onClick={() => setReportShiftId(shift.id)}>Ver reporte detallado del turno</Button>}
              {cuadre?.ventasDetalle && cuadre.ventasDetalle.length > 0 && (
                <Section
                  title="Cuartos y ventas de este turno"
                  subtitle={`${cuadre.ventasDetalle.length} venta(s) registradas con desglose de cliente, cuarto, productos y horas extra`}
                  delay={140}
                >
                  <div className="flex flex-col gap-2.5">
                    {cuadre.ventasDetalle.map((v) => (
                      <div
                        key={v.ventaId}
                        className="rounded-xl border border-line bg-surface p-3.5 shadow-xs transition-colors hover:border-brand/40"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-brand/10 px-2.5 py-0.5 font-bold text-xs text-brand">
                              {v.cuartoNumero ? `Hab. ${v.cuartoNumero}` : "Mostrador"}
                            </span>
                            <span className="font-semibold text-sm text-ink">{v.clienteNombre}</span>
                            {v.clienteDni && <span className="text-xs text-muted">DNI {v.clienteDni}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-ink">{format(cents(v.totalCentimos))}</span>
                            <Badge tone={v.saldoCentimos > 0 ? "tone-amber" : "tone-teal"}>
                              {v.estado === "ANULADA" ? "Anulada" : v.estado === "CERRADA" ? "Cerrada" : v.saldoCentimos > 0 ? `Saldo: ${format(cents(v.saldoCentimos))}` : "Pagado"}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-2 space-y-1 text-xs">
                          {v.hospedajeDescripcion && (
                            <div className="flex justify-between text-muted">
                              <span>• Hospedaje: {v.hospedajeDescripcion}</span>
                              <span className="font-mono">{format(cents(v.hospedajeMontoCentimos))}</span>
                            </div>
                          )}
                          {v.horasExtra.map((h, idx) => (
                            <div key={idx} className="flex justify-between font-semibold text-brand">
                              <span>• [HORA EXTRA] {h.descripcion} x{h.cantidad}</span>
                              <span className="font-mono">{format(cents(h.subtotalCentimos))}</span>
                            </div>
                          ))}
                          {v.productos.map((p, idx) => (
                            <div key={idx} className="flex justify-between text-ink">
                              <span>• [PRODUCTO] {p.descripcion} x{p.cantidad}</span>
                              <span className="font-mono">{format(cents(p.subtotalCentimos))}</span>
                            </div>
                          ))}
                          {v.otrosCargos.map((c, idx) => (
                            <div key={idx} className="flex justify-between text-muted">
                              <span>• [CARGO] {c.descripcion} x{c.cantidad}</span>
                              <span className="font-mono">{format(cents(c.subtotalCentimos))}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center justify-between border-t border-line-soft pt-2 text-[11px] text-muted">
                          <div>
                            <p className="font-semibold">Cobrado en este turno: {format(cents(v.cobradoTurnoCentimos))} · Anulado: {format(cents(v.anuladoTurnoCentimos))} · Devuelto: {format(cents(v.devueltoTurnoCentimos))}</p>
                            {v.cobros.map((c, i) => <p key={i}>{c.usuarioNombre} · {METHOD_LABEL[c.metodo] ?? c.metodo} · {format(cents(c.montoCentimos))}{c.recibidoCentimos != null ? " · Recibido " + format(cents(c.recibidoCentimos)) : ""} · Vuelto {format(cents(c.vueltoCentimos ?? 0))}{c.codigoOperacion ? " · Op. " + c.codigoOperacion : ""}</p>)}
                            <span>Pago: {v.metodosPago.map((m) => METHOD_LABEL[m] || m).join(", ") || "Efectivo"}</span>
                            {v.vueltoCentimos && v.vueltoCentimos > 0 ? (
                              <span className="ml-2 font-semibold text-rose-600 dark:text-rose-400">
                                (Vuelto entregado: {format(cents(v.vueltoCentimos))})
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setHistorySaleId(v.ventaId)}>Ver detalle</Button>
                            <span>{v.serie}-{String(v.correlativo).padStart(8, "0")} · {formatDateTime12h(v.creadoEn)}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<IconPrinter className="h-3 w-3" />}
                              onClick={() => printReceiptForSale(v.ventaId, v.cuartoNumero ?? undefined)}
                            >
                              Ticket
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
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

          {/* Modal de advertencia si hay cuartos ocupados al cerrar turno */}
          {showPendingRoomsWarning && (
            <ModalFrame title="Cerrar caja con habitaciones abiertas" onClose={() => setShowPendingRoomsWarning(false)} busy={busy}>
              <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
                    <IconAlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink">¿Deseas cerrar caja con cuartos aún abiertos?</h3>
                    <p className="text-xs text-muted">Existen habitaciones con huéspedes activos en el hotel</p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                  <p className="text-xs font-semibold text-ink">
                    Hay {pendingRoomsToWarn.length} cuarto(s) ocupados actualmente:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingRoomsToWarn.map((r) => (
                      <span
                        key={r.room.id}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 dark:text-amber-400"
                      >
                        Hab. {r.room.numero}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted">
                    Las habitaciones y sus saldos pendientes seguirán abiertos. Sus próximos cobros ingresarán en la caja activa del hotel; los cobros ya registrados se conservarán en este turno.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
                  <Button disabled={busy}
                    block
                    variant="secondary"
                    onClick={() => setShowPendingRoomsWarning(false)}
                  >
                    Cancelar y revisar cuartos
                  </Button>
                  <Button
                    block
                    variant="warn"
                    onClick={() => {
                      setShowPendingRoomsWarning(false);
                      setClosing(true);
                    }}
                  >
                    Continuar al conteo de cierre
                  </Button>
                </div>
              </div>
            </ModalFrame>
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
                <Select value={movementTipo} onChange={(e) => setMovementTipo(e.target.value)} className="w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25">
                  <option value="">Todos</option>
                  {Object.entries(MOVEMENT_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Método">
                <Select value={movementMetodo} onChange={(e) => setMovementMetodo(e.target.value)} className="w-full rounded-xl border border-line bg-raised px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25">
                  <option value="">Todos</option>
                  {Object.entries(METHOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
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
                <Table className="w-full min-w-[860px] text-left text-sm">
                  <TableHeader className="text-xs uppercase tracking-wide text-subtle">
                    <TableRow>
                      <TableHead className="pb-3 font-semibold">Fecha y hora</TableHead>
                      <TableHead className="pb-3 font-semibold">Tipo</TableHead>
                      <TableHead className="pb-3 font-semibold">Método / referencia</TableHead>
                      <TableHead className="pb-3 font-semibold">Registrado por</TableHead>
                      <TableHead className="pb-3 font-semibold">Motivo</TableHead>
                      <TableHead className="pb-3 text-right font-semibold">Importe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id} className="border-t border-line-soft transition-colors hover:bg-inset/60">
                        <TableCell className="py-3 pr-4 tabular-nums text-muted">{formatDateTime12h(movement.ocurridoEn)}</TableCell>
                        <TableCell className="py-3 pr-4"><Badge tone={movementTone(movement.tipo)}>{MOVEMENT_LABEL[movement.tipo]}</Badge></TableCell>
                        <TableCell className="py-3 pr-4 text-muted">
                          {movement.metodo ? METHOD_LABEL[movement.metodo] ?? movement.metodo : "—"}
                          {movement.ventaId ? <span className="block text-[11px] text-subtle">Venta {movement.ventaId.slice(0, 8)}</span> : null}
                        </TableCell>
                        <TableCell className="py-3 pr-4 text-muted">{movement.usuarioNombre}</TableCell>
                        <TableCell className="max-w-[260px] truncate py-3 pr-4 text-muted">{movement.motivo || "—"}</TableCell>
                        <TableCell className={cx("py-3 text-right font-semibold tabular-nums", movement.tipo === "EGRESO" || movement.tipo === "VUELTO" || movement.tipo === "ANULACION" || movement.tipo === "DEVOLUCION" ? "text-danger" : movement.tipo === "CIERRE" ? "text-muted" : "text-ok")}>{movementAmount(movement)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                const total = cents(ventas.filter((v) => v.estado !== "ANULADA").reduce((s, v) => s + v.totalCentimos, 0));
                const impuestos = splitIncludedIgv(total);
                return `${ventas.length} venta${ventas.length === 1 ? "" : "s"} · IGV ${format(impuestos.igv)} · Total ${format(total)}`;
              })() : ""}
            </span>
          </Card>

          <Section title="Ventas registradas" subtitle="Consulta el historial completo de cobros, adicionales, horas extra, checkout y anulaciones">
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
                      <p className="truncate text-sm font-medium text-ink flex items-center gap-2">
                        {v.cuartoNumero ? (
                          <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-xs font-bold text-brand">
                            Hab. {v.cuartoNumero}
                          </span>
                        ) : null}
                        <span>{v.clienteNombres ? `${v.clienteNombres} ${v.clienteApellidos ?? ""}`.trim() : "Sin cliente"}</span>
                        {v.clienteDni ? <span className="text-xs font-normal text-subtle">DNI {v.clienteDni}</span> : null}
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
                          {v.estado === "CERRADA" ? "Cerrada" : v.saldoCentimos > 0 ? "Con saldo" : "Pagada"}
                        </Badge>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => setHistorySaleId(v.id)}>Ver detalle</Button>
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
                <Table className="w-full text-left text-sm">
                  <TableHeader className="bg-inset text-xs uppercase tracking-wide text-subtle">
                    <TableRow>
                      <TableHead className="px-4 py-3 font-semibold">Venta</TableHead>
                      <TableHead className="px-4 py-3 font-semibold">Cliente</TableHead>
                      <TableHead className="px-4 py-3 text-right font-semibold">Total</TableHead>
                      <TableHead className="px-4 py-3 font-semibold">Motivo</TableHead>
                      <TableHead className="px-4 py-3 font-semibold">Anulado por</TableHead>
                      <TableHead className="px-4 py-3 font-semibold">Fecha</TableHead>
                      <TableHead className="px-4 py-3 font-semibold">Trazabilidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-line-soft">
                    {anulaciones.map((a) => (
                      <TableRow key={a.id} className="transition-colors hover:bg-inset/40">
                        <TableCell className="px-4 py-3">
                          <p className="font-semibold text-ink">{a.serie}-{a.correlativo}</p>
                          <span className="text-[11px] text-muted">ID: {a.id.slice(0, 8)}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted">
                          {a.clienteNombres ? `${a.clienteNombres} ${a.clienteApellidos ?? ""}`.trim() : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right font-semibold tabular-nums text-rose-500 line-through">
                          {format(cents(a.totalCentimos))}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge tone="tone-red">{a.motivoAnulacion || "Anulada"}</Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted text-xs">
                          {a.anuladoPorNombre ?? a.anuladoPorUsuarioId ?? "Usuario"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs text-muted tabular-nums">
                          {formatDateTime12h(a.anuladoEn ?? a.creadoEn)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-xs">
                          {a.correlationId && (
                            <div className="flex items-center gap-1">
                              <code className="text-[10px] bg-inset px-1.5 py-0.5 rounded font-mono text-subtle">
                                {a.correlationId.slice(0, 16)}…
                              </code>
                              <ActionButton
                                type="button"
                                onClick={() => copyToClipboard(a.correlationId!, `tab_corr_${a.id}`)}
                                className="text-[10px] text-brand hover:underline"
                              >
                                {copiedKey === `tab_corr_${a.id}` ? "✓" : "Copiar"}
                              </ActionButton>
                            </div>
                          )}
                          {a.idempotencyKey && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <code className="text-[10px] bg-inset px-1.5 py-0.5 rounded font-mono text-subtle">
                                {a.idempotencyKey.slice(0, 16)}…
                              </code>
                              <ActionButton
                                type="button"
                                onClick={() => copyToClipboard(a.idempotencyKey!, `tab_idem_${a.id}`)}
                                className="text-[10px] text-brand hover:underline"
                              >
                                {copiedKey === `tab_idem_${a.id}` ? "✓" : "Copiar"}
                              </ActionButton>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
              <Row label="Cobros menos anulaciones y devoluciones" value={format(cents(rangeSummary.ventasBrutasCentimos))} strong />
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
              <Table className="w-full text-left text-sm">
                <TableHeader className="bg-inset text-xs uppercase tracking-wide text-subtle">
                  <TableRow>
                    <TableHead className="px-4 py-3 font-semibold">Fecha</TableHead>
                    <TableHead className="px-4 py-3 font-semibold">Estado</TableHead>
                    <TableHead className="px-4 py-3 text-right font-semibold">Esperado</TableHead>
                    <TableHead className="px-4 py-3 text-right font-semibold">Declarado</TableHead>
                    <TableHead className="px-4 py-3 text-right font-semibold">Diferencia</TableHead>
                    <TableHead className="px-4 py-3 text-right font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((s) => (
                    <TableRow key={s.id} className="border-t border-line-soft transition-colors hover:bg-inset/50">
                      <TableCell className="px-4 py-3 text-ink">{s.fecha}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge tone={s.estado === "ABIERTO" ? "tone-sky" : "tone-stone"}>{s.estado === "ABIERTO" ? "Abierto" : "Cerrado"}</Badge>
                        {s.tipoCierre === "AUTOMATICO" && <p className="mt-1 text-xs text-muted">Relevo automático · Sin arqueo</p>}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right tabular-nums text-muted">{s.efectivoEsperadoCentimos !== null ? format(cents(s.efectivoEsperadoCentimos)) : "—"}</TableCell>
                      <TableCell className="px-4 py-3 text-right tabular-nums text-muted">{s.efectivoDeclaradoCentimos !== null ? format(cents(s.efectivoDeclaradoCentimos)) : "—"}</TableCell>
                      <TableCell className={cx("px-4 py-3 text-right tabular-nums", s.diferenciaCentimos ? "font-medium text-warn" : "text-muted")}>
                        {s.diferenciaCentimos !== null ? format(cents(s.diferenciaCentimos)) : "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button size="sm" variant="secondary" onClick={() => setReportShiftId(s.id)}>Ver detalle</Button>
                        <ActionButton aria-label="Imprimir cuadre de caja (80 mm)"
                          type="button"
                          title="Imprimir cuadre de caja (80 mm)"
                          onClick={() => printShiftClosureReceipt(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-xs hover:border-brand hover:text-brand transition-colors active:scale-95"
                        >
                          <IconPrinter className="h-3.5 w-3.5" />
                          <span>Imprimir cuadre</span>
                        </ActionButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-8 text-center text-muted">
                        Sin turnos en ese rango.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      {historySaleId && <SaleHistoryDialog saleId={historySaleId} onClose={() => setHistorySaleId(null)} />}
      {legacyClosing && <ModalFrame title="Conciliar turno anterior" busy={busy} onClose={() => setLegacyClosing(null)}><Card className="w-full max-w-lg p-5 space-y-4">
        <h2 className="text-lg font-semibold text-ink">Conciliar turno anterior</h2>
        <p className="text-sm text-muted">Abierto {formatDateTime12h(legacyClosing.abiertoEn)}. Registra el efectivo comprobado para ese turno y explica la conciliación. Esta operación conserva sus cobros y no añade ni retira dinero de la caja activa.</p>
        <Button onClick={() => setReportShiftId(legacyClosing.id)}>Ver movimientos y reporte</Button>
        <DenominationCounter value={denominacionesCierre} onChange={setDenominacionesCierre} />
        <Field label="Motivo y sustento de la conciliación"><Textarea value={justificacion} onChange={e => setJustificacion(e.target.value)} /></Field>
        {error && <Notice>{error}</Notice>}
        <div className="grid gap-2 sm:grid-cols-2"><Button disabled={busy} onClick={() => setLegacyClosing(null)}>Cancelar</Button><Button variant="primary" disabled={busy || !justificacion.trim()} onClick={closeLegacyShift}>Registrar conteo y cerrar turno anterior</Button></div>
      </Card></ModalFrame>}
      {reportShiftId && <CashReportDialog shiftId={reportShiftId} onClose={() => setReportShiftId(null)} onSale={setHistorySaleId} />}

      {/* ---------------- Turnos y Horarios ---------------- */}
      {tab === "turnos" && (
        <ShiftTemplatesManager onTemplatesChange={(newTemplates) => setTemplates(newTemplates)} />
      )}

      {/* ---------------- Modal para anular venta ---------------- */}
      {cancellingSale && (
        <ModalFrame title="Anular venta" onClose={() => setCancellingSale(null)} busy={cancelBusy}>
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
              <ActionButton
                type="button"
                onClick={() => setCancellingSale(null)}
                className="rounded-lg p-1 text-muted hover:bg-inset hover:text-ink transition-colors"
                disabled={cancelBusy}
              >
                ✕
              </ActionButton>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 space-y-1">
              <p className="font-semibold">¿Por qué anular esta venta?</p>
              <p>
                Al anularla, se conservarán los cobros originales y <strong>se registrará la resta por método en tu caja abierta</strong>, con tu usuario y el motivo. Los turnos cerrados conservan sus movimientos. Solo el efectivo reduce el dinero esperado en el cajón. También se devolverá el stock de productos y se liberará la habitación si la estadía sigue activa.
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
                  <ActionButton
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
                  </ActionButton>
                ))}
              </div>
              <Input aria-label="Detalle adicional (ej: se digitó 2 veces el cobro por error en caja)..."
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
        </ModalFrame>
      )}
    </>
  );
}
