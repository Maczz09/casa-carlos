import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { DashboardReport, HoraPico } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api, ApiError } from "../api.js";
import { METHOD_LABEL } from "./CashboxPanel.js";

interface Props {
  onClose: () => void;
}

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-slate-500">Sin datos en este periodo.</p>;
}

function KpiCard({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="rounded-xl bg-slate-900 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {delta !== undefined && (
        <p className={`mt-1 text-xs ${delta === null ? "text-slate-500" : delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {delta === null ? "Sin ventas en el periodo anterior" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}% vs. periodo anterior`}
        </p>
      )}
    </div>
  );
}

function BarRow({ label, value, valueLabel, max, color = "indigo" }: { label: string; value: number; valueLabel: string; max: number; color?: "indigo" | "emerald" }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-slate-300">{label}</span>
        <span className="shrink-0 font-medium text-white">{valueLabel}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800">
        <div className={`h-2 rounded-full ${color === "emerald" ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Heatmap({ data }: { data: HoraPico[] }) {
  const byKey = new Map(data.map((d) => [`${d.diaSemana}-${d.hora}`, d.cantidad]));
  const max = Math.max(1, ...data.map((d) => d.cantidad));
  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: "auto repeat(24, minmax(16px, 1fr))" }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-[9px] text-slate-500">
            {h % 6 === 0 ? h : ""}
          </div>
        ))}
        {DIAS.map((dia, d) => (
          <Fragment key={dia}>
            <div className="pr-2 text-right text-[10px] leading-4 text-slate-400">{dia}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const count = byKey.get(`${d}-${h}`) ?? 0;
              const intensity = count / max;
              return (
                <div
                  key={h}
                  title={`${dia} ${h}:00 — ${count} check-in${count === 1 ? "" : "s"}`}
                  className="aspect-square rounded-[3px]"
                  style={{ backgroundColor: count === 0 ? "#1e293b" : `rgba(99,102,241,${(0.2 + intensity * 0.8).toFixed(2)})` }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

const maxOf = (values: number[]): number => Math.max(1, ...values);

export function DashboardPanel({ onClose }: Props) {
  const [desde, setDesde] = useState(daysAgoIso(6));
  const [hasta, setHasta] = useState(todayIso());
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadRange = async (d: string, h: string) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await api.dashboard({ desde: d, hasta: h }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRange(desde, hasta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
    loadRange(d, h);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Dashboard</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mb-5 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-slate-400">
            Desde
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-white" />
          </label>
          <label className="flex flex-col text-xs text-slate-400">
            Hasta
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-white" />
          </label>
          <button onClick={() => loadRange(desde, hasta)} className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600">
            Actualizar
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={() => applyPreset(todayIso(), todayIso())} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700">
              Hoy
            </button>
            <button onClick={() => applyPreset(daysAgoIso(6), todayIso())} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700">
              7 días
            </button>
            <button onClick={() => applyPreset(startOfMonthIso(), todayIso())} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700">
              Este mes
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}
        {loading && !report && <p className="text-sm text-slate-400">Cargando…</p>}

        {report && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <KpiCard label="Ventas totales" value={format(cents(report.comparativa.actual.ventasCentimos))} delta={report.comparativa.variacionVentasPct} />
              <KpiCard label="Cuartos alquilados" value={String(report.comparativa.actual.cuartosAlquilados)} delta={report.comparativa.variacionCuartosPct} />
              <KpiCard label="Ticket promedio" value={format(cents(report.comparativa.actual.ticketPromedioCentimos))} />
              <KpiCard label="Ocupación" value={`${report.comparativa.actual.ocupacionPct.toFixed(1)}%`} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Section title="Ocupación por piso">
                {report.ocupacionPorPiso.length === 0 ? (
                  <Empty />
                ) : (
                  report.ocupacionPorPiso.map((p) => (
                    <BarRow
                      key={p.pisoId}
                      label={p.pisoNombre}
                      value={p.cuartosAlquilados}
                      valueLabel={`${p.cuartosAlquilados} cuarto${p.cuartosAlquilados === 1 ? "" : "s"}`}
                      max={maxOf(report.ocupacionPorPiso.map((x) => x.cuartosAlquilados))}
                    />
                  ))
                )}
              </Section>

              <Section title="Ocupación por categoría">
                {report.ocupacionPorCategoria.length === 0 ? (
                  <Empty />
                ) : (
                  report.ocupacionPorCategoria.map((c) => (
                    <BarRow
                      key={c.categoriaId}
                      label={c.categoriaNombre}
                      value={c.cuartosAlquilados}
                      valueLabel={format(cents(c.ingresosCentimos))}
                      max={maxOf(report.ocupacionPorCategoria.map((x) => x.cuartosAlquilados))}
                      color="emerald"
                    />
                  ))
                )}
              </Section>

              <Section title="Ingresos por modalidad">
                {report.ingresosPorModalidad.length === 0 ? (
                  <Empty />
                ) : (
                  report.ingresosPorModalidad.map((m) => (
                    <BarRow
                      key={m.modalidadId}
                      label={m.modalidadNombre}
                      value={m.ingresosCentimos}
                      valueLabel={format(cents(m.ingresosCentimos))}
                      max={maxOf(report.ingresosPorModalidad.map((x) => x.ingresosCentimos))}
                      color="emerald"
                    />
                  ))
                )}
              </Section>

              <Section title="Ingresos por método de pago">
                {report.ingresosPorMetodo.length === 0 ? (
                  <Empty />
                ) : (
                  report.ingresosPorMetodo.map((m) => (
                    <BarRow
                      key={m.metodo}
                      label={METHOD_LABEL[m.metodo] ?? m.metodo}
                      value={m.totalCentimos}
                      valueLabel={format(cents(m.totalCentimos))}
                      max={maxOf(report.ingresosPorMetodo.map((x) => x.totalCentimos))}
                      color="emerald"
                    />
                  ))
                )}
              </Section>
            </div>

            <Section title="Ventas por recepcionista">
              {report.ventasPorRecepcionista.length === 0 ? (
                <Empty />
              ) : (
                report.ventasPorRecepcionista.map((v) => (
                  <BarRow
                    key={v.usuarioId}
                    label={v.nombre}
                    value={v.totalCentimos}
                    valueLabel={`${format(cents(v.totalCentimos))} · ${v.cantidadVentas} venta${v.cantidadVentas === 1 ? "" : "s"}`}
                    max={maxOf(report.ventasPorRecepcionista.map((x) => x.totalCentimos))}
                    color="emerald"
                  />
                ))
              )}
            </Section>

            <div className="grid gap-4 md:grid-cols-2">
              <Section title="Productos más vendidos">
                {report.rankingProductos.length === 0 ? (
                  <Empty />
                ) : (
                  report.rankingProductos.map((p) => (
                    <BarRow
                      key={p.productoId}
                      label={p.nombre}
                      value={p.cantidadVendida}
                      valueLabel={`${p.cantidadVendida} und. · ${format(cents(p.totalCentimos))}`}
                      max={maxOf(report.rankingProductos.map((x) => x.cantidadVendida))}
                    />
                  ))
                )}
              </Section>

              <Section title="Cargos extra">
                {report.cargosExtra.length === 0 ? (
                  <Empty />
                ) : (
                  report.cargosExtra.map((c) => (
                    <BarRow
                      key={c.codigo}
                      label={c.nombre}
                      value={c.cantidad}
                      valueLabel={`${c.cantidad} · ${format(cents(c.totalCentimos))}`}
                      max={maxOf(report.cargosExtra.map((x) => x.cantidad))}
                    />
                  ))
                )}
              </Section>
            </div>

            <Section title="Horas pico de check-in">{report.horasPico.length === 0 ? <Empty /> : <Heatmap data={report.horasPico} />}</Section>
          </div>
        )}
      </div>
    </div>
  );
}
