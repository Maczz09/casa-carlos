import { useEffect, useState } from "react";
import type { Arqueo, CashSummary, Shift, ShiftTemplate } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { api, ApiError } from "../api.js";
import { DenominationCounter, sumDenominaciones } from "./DenominationCounter.js";

interface Props {
  onClose: () => void;
}

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function CashboxPanel({ onClose }: Props) {
  const [tab, setTab] = useState<"turno" | "historial">("turno");
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

  useEffect(() => {
    if (tab === "historial") loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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
      await loadShift();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar el turno.");
    } finally {
      setBusy(false);
    }
  };

  const loadArqueos = async (turnoId: string) => setArqueos(await api.arqueos(turnoId));

  const registrarArqueo = async () => {
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      await api.registrarArqueo(shift.id, denominacionesArqueo);
      setDenominacionesArqueo({});
      setArqueando(false);
      await loadArqueos(shift.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el arqueo.");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const header = "fecha,usuario,apertura,esperado,declarado,diferencia,estado\n";
    const rows = history
      .map((s) => [s.fecha, s.usuarioId, s.aperturaCentimos / 100, (s.efectivoEsperadoCentimos ?? "") && s.efectivoEsperadoCentimos! / 100, (s.efectivoDeclaradoCentimos ?? 0) / 100, (s.diferenciaCentimos ?? 0) / 100, s.estado].join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuadre_${desde}_a_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Caja</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mb-5 flex gap-2 rounded-lg bg-slate-900 p-1 text-sm">
          <button onClick={() => setTab("turno")} className={`flex-1 rounded-md py-1.5 ${tab === "turno" ? "bg-slate-700 text-white" : "text-slate-400"}`}>
            Mi turno
          </button>
          <button onClick={() => setTab("historial")} className={`flex-1 rounded-md py-1.5 ${tab === "historial" ? "bg-slate-700 text-white" : "text-slate-400"}`}>
            Historial
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

        {tab === "turno" && (
          <>
            {shift === undefined && <p className="text-sm text-slate-400">Cargando…</p>}

            {shift === null && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-400">No tienes un turno abierto.</p>
                {templates.length > 0 && (
                  <select value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white">
                    <option value="">Sin plantilla</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre} ({t.horaInicio}–{t.horaFin})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="number"
                  placeholder="Monto de apertura S/"
                  value={apertura}
                  onChange={(e) => setApertura(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                />
                <button onClick={openShift} disabled={busy} className="rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                  Abrir turno
                </button>
              </div>
            )}

            {shift && summary && !closing && (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-slate-400">Abierto desde {new Date(shift.abiertoEn).toLocaleString("es-PE")}</p>

                <div className="rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span>Apertura</span>
                    <span className="text-white">{format(cents(summary.aperturaCentimos))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ingresos manuales</span>
                    <span className="text-white">{format(cents(summary.ingresosManualesCentimos))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Egresos manuales</span>
                    <span className="text-white">−{format(cents(summary.egresosManualesCentimos))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vueltos entregados</span>
                    <span className="text-white">−{format(cents(summary.vueltosCentimos))}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-700 pt-2 font-medium">
                    <span>Efectivo esperado en caja</span>
                    <span className="text-emerald-400">{format(cents(summary.efectivoEsperadoCentimos))}</span>
                  </div>
                </div>

                {summary.porMetodo.length > 0 && (
                  <div className="rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
                    <p className="mb-2 font-medium text-white">Por método</p>
                    {summary.porMetodo.map((m) => (
                      <div key={m.metodo} className="flex justify-between">
                        <span>
                          {METHOD_LABEL[m.metodo] ?? m.metodo} ({m.cantidad})
                        </span>
                        <span className="text-white">{format(cents(m.totalCentimos))}</span>
                      </div>
                    ))}
                  </div>
                )}

                {showMovForm ? (
                  <div className="flex flex-col gap-2 rounded-lg bg-slate-900 p-4">
                    <div className="flex gap-2">
                      <button onClick={() => setMovTipo("INGRESO")} className={`flex-1 rounded-md py-1.5 text-sm ${movTipo === "INGRESO" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                        Ingreso
                      </button>
                      <button onClick={() => setMovTipo("EGRESO")} className={`flex-1 rounded-md py-1.5 text-sm ${movTipo === "EGRESO" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                        Egreso
                      </button>
                      <button onClick={() => setMovTipo("AJUSTE")} className={`flex-1 rounded-md py-1.5 text-sm ${movTipo === "AJUSTE" ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-400"}`}>
                        Ajuste
                      </button>
                    </div>
                    <input
                      type="number"
                      placeholder={movTipo === "AJUSTE" ? "Monto S/ (negativo para restar)" : "Monto S/"}
                      value={movMonto}
                      onChange={(e) => setMovMonto(e.target.value)}
                      className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                    />
                    <input placeholder="Motivo" value={movMotivo} onChange={(e) => setMovMotivo(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowMovForm(false)} className="flex-1 rounded-lg bg-slate-700 py-2 text-white hover:bg-slate-600">
                        Cancelar
                      </button>
                      <button onClick={addMovement} disabled={busy || !movMonto || !movMotivo} className="flex-1 rounded-lg bg-emerald-600 py-2 text-white hover:bg-emerald-500 disabled:opacity-50">
                        Registrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowMovForm(true)} className="rounded-lg bg-slate-700 py-2.5 font-medium text-white hover:bg-slate-600">
                    + Ingreso / egreso / ajuste manual
                  </button>
                )}

                {arqueando ? (
                  <div className="flex flex-col gap-2 rounded-lg bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Conteo de caja sin cerrar el turno — Efectivo esperado: {format(cents(summary.efectivoEsperadoCentimos))}</p>
                    <DenominationCounter value={denominacionesArqueo} onChange={setDenominacionesArqueo} />
                    <div className="flex gap-2">
                      <button onClick={() => setArqueando(false)} className="flex-1 rounded-lg bg-slate-700 py-2 text-white hover:bg-slate-600">
                        Cancelar
                      </button>
                      <button onClick={registrarArqueo} disabled={busy} className="flex-1 rounded-lg bg-sky-600 py-2 text-white hover:bg-sky-500 disabled:opacity-50">
                        Registrar arqueo
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setArqueando(true)} className="rounded-lg bg-slate-700 py-2.5 font-medium text-white hover:bg-slate-600">
                    Arqueo intermedio
                  </button>
                )}

                {arqueos.length > 0 && (
                  <div className="rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
                    <p className="mb-2 font-medium text-white">Arqueos de este turno</p>
                    {arqueos.map((a) => (
                      <div key={a.id} className="flex justify-between">
                        <span>{new Date(a.creadoEn).toLocaleTimeString("es-PE")}</span>
                        <span className={a.diferenciaCentimos === 0 ? "text-emerald-400" : "text-amber-400"}>{format(cents(a.diferenciaCentimos))}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => setClosing(true)} className="rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-500">
                  Cerrar turno
                </button>
              </div>
            )}

            {shift && closing && summary && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-400">Efectivo esperado: {format(cents(summary.efectivoEsperadoCentimos))}</p>
                <DenominationCounter value={denominacionesCierre} onChange={setDenominacionesCierre} />
                {Object.keys(denominacionesCierre).length > 0 && (
                  <p className={`text-sm ${sumDenominaciones(denominacionesCierre) - summary.efectivoEsperadoCentimos === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                    Diferencia: {format(cents(sumDenominaciones(denominacionesCierre) - summary.efectivoEsperadoCentimos))}
                  </p>
                )}
                <textarea
                  placeholder="Justificación (si hay diferencia)"
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button onClick={() => setClosing(false)} className="flex-1 rounded-lg bg-slate-700 py-2.5 text-white hover:bg-slate-600">
                    Atrás
                  </button>
                  <button onClick={closeShift} disabled={busy} className="flex-1 rounded-lg bg-amber-600 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-50">
                    Confirmar cierre
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "historial" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-xs text-slate-400">
                Desde
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-white" />
              </label>
              <label className="flex flex-col text-xs text-slate-400">
                Hasta
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-white" />
              </label>
              <button onClick={loadHistory} className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600">
                Filtrar
              </button>
              <button onClick={exportCsv} disabled={history.length === 0} className="ml-auto rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-40">
                Exportar CSV
              </button>
            </div>

            {rangeSummary && (
              <div className="rounded-lg bg-slate-900 p-4 text-sm text-slate-300">
                <div className="flex justify-between font-medium">
                  <span>Efectivo esperado del periodo</span>
                  <span className="text-emerald-400">{format(cents(rangeSummary.efectivoEsperadoCentimos))}</span>
                </div>
                {rangeSummary.porMetodo.map((m) => (
                  <div key={m.metodo} className="flex justify-between">
                    <span>{METHOD_LABEL[m.metodo] ?? m.metodo}</span>
                    <span className="text-white">{format(cents(m.totalCentimos))}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-slate-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2 text-right">Esperado</th>
                    <th className="px-3 py-2 text-right">Declarado</th>
                    <th className="px-3 py-2 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id} className="border-t border-slate-700 text-slate-300">
                      <td className="px-3 py-2">{s.fecha}</td>
                      <td className="px-3 py-2">{s.estado === "ABIERTO" ? "Abierto" : "Cerrado"}</td>
                      <td className="px-3 py-2 text-right">{s.efectivoEsperadoCentimos !== null ? format(cents(s.efectivoEsperadoCentimos)) : "—"}</td>
                      <td className="px-3 py-2 text-right">{s.efectivoDeclaradoCentimos !== null ? format(cents(s.efectivoDeclaradoCentimos)) : "—"}</td>
                      <td className={`px-3 py-2 text-right ${s.diferenciaCentimos ? "text-amber-400" : "text-slate-400"}`}>
                        {s.diferenciaCentimos !== null ? format(cents(s.diferenciaCentimos)) : "—"}
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                        Sin turnos en ese rango.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
