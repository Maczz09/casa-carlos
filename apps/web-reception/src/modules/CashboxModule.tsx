import { useEffect, useState } from "react";
import type { Arqueo, CashSummary, Sale, Shift, ShiftTemplate } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { IconCash, IconPrinter, IconReceipt } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { DenominationCounter, sumDenominaciones } from "../components/DenominationCounter.js";
import { printReceiptForSale } from "../components/receipt.js";
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

type Tab = "turno" | "ventas" | "historial";

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

  useEffect(() => {
    if (tab === "historial") loadHistory();
    if (tab === "ventas") loadVentas();
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
      await api.closeShift(shift.id, { denominaciones: denominacionesCierre, justificacion: justificacion || null });
      setClosing(false);
      setDenominacionesCierre({});
      setJustificacion("");
      await loadShift();
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
        subtitle="Turno actual, ventas del periodo y cuadre histórico"
        actions={<Tabs<Tab> tabs={[{ id: "turno", label: "Mi turno" }, { id: "ventas", label: "Ventas" }, { id: "historial", label: "Historial" }]} active={tab} onChange={setTab} />}
      />

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
                          {t.nombre} ({t.horaInicio}–{t.horaFin})
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
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatCard label="Efectivo esperado" value={format(cents(summary.efectivoEsperadoCentimos))} hint="Lo que debería haber en caja" icon={<IconCash className="h-4 w-4" />} />
                  <StatCard label="Apertura" value={format(cents(summary.aperturaCentimos))} hint={`Abierto ${new Date(shift.abiertoEn).toLocaleString("es-PE")}`} tone="tone-sky" delay={60} />
                </div>

                <Section title="Movimientos del turno">
                  <Row label="Apertura" value={format(cents(summary.aperturaCentimos))} />
                  <Row label="Ingresos manuales" value={format(cents(summary.ingresosManualesCentimos))} tone="text-ok" />
                  <Row label="Egresos manuales" value={`−${format(cents(summary.egresosManualesCentimos))}`} tone="text-danger" />
                  <Row label="Vueltos entregados" value={`−${format(cents(summary.vueltosCentimos))}`} tone="text-danger" />
                  <div className="mt-2 border-t border-line pt-2">
                    <Row label="Efectivo esperado en caja" value={format(cents(summary.efectivoEsperadoCentimos))} strong tone="text-brand" />
                  </div>
                </Section>

                {summary.porMetodo.length > 0 && (
                  <Section title="Cobrado por método" delay={60}>
                    {summary.porMetodo.map((m) => (
                      <Row key={m.metodo} label={`${METHOD_LABEL[m.metodo] ?? m.metodo} (${m.cantidad})`} value={format(cents(m.totalCentimos))} />
                    ))}
                  </Section>
                )}
              </div>

              <div className="flex flex-col gap-5">
                <Section title="Acciones" delay={120}>
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
                        label={new Date(a.creadoEn).toLocaleTimeString("es-PE")}
                        value={format(cents(a.diferenciaCentimos))}
                        tone={a.diferenciaCentimos === 0 ? "text-ok" : "text-warn"}
                      />
                    ))}
                  </Section>
                )}
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
              {ventas ? `${ventas.length} venta${ventas.length === 1 ? "" : "s"} · ${format(cents(ventas.reduce((s, v) => s + v.totalCentimos, 0)))}` : ""}
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
                        {v.serie}-{v.correlativo} · {new Date(v.creadoEn).toLocaleString("es-PE")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-ink">{format(cents(v.totalCentimos))}</span>
                      <Badge tone={v.saldoCentimos > 0 ? "tone-amber" : "tone-teal"}>{v.saldoCentimos > 0 ? "Con saldo" : "Pagada"}</Badge>
                      <Button size="sm" icon={<IconPrinter className="h-3.5 w-3.5" />} onClick={() => printSale(v)} disabled={printingId === v.id}>
                        {printingId === v.id ? "…" : "Imprimir"}
                      </Button>
                    </div>
                  </div>
                ))}
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
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted">
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
    </>
  );
}
