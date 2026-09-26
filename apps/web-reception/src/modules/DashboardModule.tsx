import { Fragment, useEffect, useState } from "react";
import type { DashboardReport, HoraPico, Product } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconBox } from "@casacarlos/ui";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Skeleton, cx } from "../components/ui.js";
import { METHOD_LABEL } from "./CashboxModule.js";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};
const startOfMonthIso = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const CHART_COLORS = ["var(--c-brand)", "#7c3aed", "#0284c7", "#d97706", "#db2777", "#0891b2"];

function Empty() {
  return <p className="text-sm text-muted">Sin datos en este periodo.</p>;
}

function Kpi({ label, value, delta, delay }: { label: string; value: string; delta?: number | null; delay?: number }) {
  return (
    <Card delay={delay} className="p-4 transition-transform duration-200 hover:-translate-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {delta !== undefined && (
        <p className={cx("mt-1 text-xs", delta === null ? "text-subtle" : delta >= 0 ? "text-ok" : "text-danger")}>
          {delta === null ? "Sin ventas en el periodo anterior" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}% vs. periodo anterior`}
        </p>
      )}
    </Card>
  );
}

function HorizontalBarChart({
  data,
  valueLabel,
  seriesName,
  color = "var(--c-brand)",
}: {
  data: Array<{ label: string; value: number; caption?: string }>;
  valueLabel: (value: number) => string;
  seriesName: string;
  color?: string;
}) {
  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 6, right: 20, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--c-line-soft)" horizontal={false} strokeDasharray="4 6" />
          <XAxis type="number" tick={{ fill: "var(--c-muted)", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={valueLabel} />
          <YAxis type="category" dataKey="label" width={116} tick={{ fill: "var(--c-muted)", fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "var(--c-inset)" }}
            contentStyle={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 12, boxShadow: "var(--shadow-card)" }}
            formatter={(value) => [valueLabel(Number(value)), seriesName]}
            labelFormatter={(label) => data.find((item) => item.label === label)?.caption ?? label}
          />
          <Bar dataKey="value" fill={color} radius={[0, 7, 7, 0]} maxBarSize={28} name={seriesName} />
        </BarChart>
      </ResponsiveContainer>
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
          <div key={h} className="text-center text-[9px] text-subtle">
            {h % 6 === 0 ? h : ""}
          </div>
        ))}
        {DIAS.map((dia, d) => (
          <Fragment key={dia}>
            <div className="pr-2 text-right text-[10px] leading-4 text-muted">{dia}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const count = byKey.get(`${d}-${h}`) ?? 0;
              const intensity = count / max;
              return (
                <div
                  key={h}
                  title={`${dia} ${h}:00 — ${count} check-in${count === 1 ? "" : "s"}`}
                  className="aspect-square rounded-[3px] transition-transform duration-150 hover:scale-125"
                  style={{
                    backgroundColor: count === 0 ? "var(--c-inset)" : "var(--c-brand)",
                    opacity: count === 0 ? 1 : 0.25 + intensity * 0.75,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function RevenueTrend({ report }: { report: DashboardReport }) {
  const data = report.serieTemporal.map((point) => ({
    ...point,
    label: new Date(`${point.fecha}T12:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
    ventas: point.ventasCentimos / 100,
    igv: point.igvCentimos / 100,
    operaciones: point.cantidadVentas,
  }));
  return (
    <div className="h-[290px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ventasGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-brand)" stopOpacity={0.42} />
              <stop offset="100%" stopColor="var(--c-brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--c-line-soft)" vertical={false} strokeDasharray="4 6" />
          <XAxis dataKey="label" tick={{ fill: "var(--c-muted)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis yAxisId="soles" tick={{ fill: "var(--c-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={58} tickFormatter={(value) => `S/${value}`} />
          <YAxis yAxisId="operaciones" orientation="right" tick={{ fill: "var(--c-muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "var(--c-line)", strokeDasharray: "4 4" }}
            contentStyle={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 12, boxShadow: "var(--shadow-card)" }}
            labelStyle={{ color: "var(--c-ink)", fontWeight: 600 }}
            formatter={(value, name) => [name === "operaciones" ? String(value) : `S/ ${Number(value).toFixed(2)}`, name === "ventas" ? "Ventas" : name === "igv" ? "IGV" : "Operaciones"]}
          />
          <Bar yAxisId="operaciones" dataKey="operaciones" fill="var(--c-brand-soft)" radius={[5, 5, 0, 0]} name="operaciones" />
          <Area yAxisId="soles" type="monotone" dataKey="ventas" stroke="var(--c-brand)" strokeWidth={2.5} fill="url(#ventasGradient)" name="ventas" />
          <Line yAxisId="soles" type="monotone" dataKey="igv" stroke="#7c3aed" strokeWidth={2} dot={false} name="igv" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaymentMixChart({ report }: { report: DashboardReport }) {
  const data = report.ingresosPorMetodo.map((item) => ({
    label: METHOD_LABEL[item.metodo] ?? item.metodo,
    total: item.totalCentimos / 100,
    operaciones: item.cantidad,
  }));
  const total = data.reduce((sum, item) => sum + item.total, 0);
  return (
    <div className="relative h-[274px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="total" nameKey="label" innerRadius={68} outerRadius={102} paddingAngle={3} stroke="var(--c-surface)">
            {data.map((item, index) => <Cell key={item.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--c-surface)", border: "1px solid var(--c-line)", borderRadius: 12, boxShadow: "var(--shadow-card)" }}
            formatter={(value, _name, entry) => [`S/ ${Number(value).toFixed(2)} · ${(entry.payload as { operaciones: number }).operaciones} operación(es)`, "Cobrado"]}
          />
          <Legend verticalAlign="bottom" iconType="circle" formatter={(value) => <span className="text-xs text-muted">{value}</span>} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center pb-8 text-center">
        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">Cobrado</p><p className="mt-1 text-xl font-semibold tabular-nums text-ink">S/ {total.toFixed(2)}</p></div>
      </div>
    </div>
  );
}

interface Props {
  onGoToInventory: () => void;
}

export function DashboardModule({ onGoToInventory }: Props) {
  const [desde, setDesde] = useState(daysAgoIso(6));
  const [hasta, setHasta] = useState(todayIso());
  const [report, setReport] = useState<DashboardReport | null>(null);
  const [lowStock, setLowStock] = useState<Product[] | null>(null);
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
    // El stock bajo no depende del rango de fechas: es el estado de hoy en bodega.
    api.lowStock().then(setLowStock);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
    loadRange(d, h);
  };

  const presets: Array<[string, () => void]> = [
    ["Hoy", () => applyPreset(todayIso(), todayIso())],
    ["7 días", () => applyPreset(daysAgoIso(6), todayIso())],
    ["Este mes", () => applyPreset(startOfMonthIso(), todayIso())],
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Ventas, ocupación y comportamiento del hotel en el periodo elegido" />

      <Card className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <Field label="Desde">
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </Field>
        <Button variant="primary" onClick={() => loadRange(desde, hasta)} disabled={loading}>
          {loading ? "Cargando…" : "Actualizar"}
        </Button>
        <div className="ml-auto flex gap-2">
          {presets.map(([label, fn]) => (
            <Button key={label} size="sm" onClick={fn}>
              {label}
            </Button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {loading && !report && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Reposición de bodega — fuera del rango de fechas a propósito: es el estado de hoy. */}
      <div className="mb-5">
        <Section
          title="Productos por reponer"
          subtitle="Stock en o por debajo del mínimo configurado"
          actions={
            <Button size="sm" onClick={onGoToInventory}>
              Ir a bodega
            </Button>
          }
        >
          {lowStock === null ? (
            <Skeleton className="h-12" />
          ) : lowStock.length === 0 ? (
            <EmptyState icon={<IconBox className="h-6 w-6" />} title="Todo con stock suficiente" hint="Ningún producto está en o debajo de su mínimo." />
          ) : (
            <div className="flex flex-col gap-2">
              {lowStock.map((p, i) => {
                const faltante = Math.max(0, p.stockMinimo - p.stock);
                return (
                  <div key={p.id} className="stagger flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-2.5" style={{ ["--i" as string]: i }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{p.nombre}</p>
                      <p className="truncate text-xs text-muted">
                        {p.categoria ?? "Sin categoría"} · mínimo {p.stockMinimo}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={p.stock === 0 ? "tone-red" : "tone-amber"}>{p.stock === 0 ? "Agotado" : `stock ${p.stock}`}</Badge>
                      {faltante > 0 && <span className="text-xs text-muted">faltan {faltante}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {report && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Ventas totales" value={format(cents(report.comparativa.actual.ventasCentimos))} delta={report.comparativa.variacionVentasPct} />
            <Kpi label="Cuartos alquilados" value={String(report.comparativa.actual.cuartosAlquilados)} delta={report.comparativa.variacionCuartosPct} delay={60} />
            <Kpi label="Ticket promedio" value={format(cents(report.comparativa.actual.ticketPromedioCentimos))} delay={120} />
            <Kpi label="Ocupación" value={`${report.comparativa.actual.ocupacionPct.toFixed(1)}%`} delay={180} />
          </div>

          <Section title="Evolución de ventas e IGV" subtitle="Importes diarios del periodo; los precios ya incluyen el impuesto">
            {report.serieTemporal.length === 0 ? <Empty /> : <RevenueTrend report={report} />}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Ocupación por piso" subtitle="Cuartos alquilados durante el periodo">
              {report.ocupacionPorPiso.length === 0 ? <Empty /> : (
                <HorizontalBarChart
                  data={report.ocupacionPorPiso.map((item) => ({ label: item.pisoNombre, value: item.cuartosAlquilados }))}
                  valueLabel={(value) => `${value} cuarto${value === 1 ? "" : "s"}`}
                  seriesName="Cuartos alquilados"
                  color="#7c3aed"
                />
              )}
            </Section>

            <Section title="Mix de habitaciones" subtitle="Ingresos por categoría de cuarto" delay={60}>
              {report.ocupacionPorCategoria.length === 0 ? <Empty /> : (
                <HorizontalBarChart
                  data={report.ocupacionPorCategoria.map((item) => ({ label: item.categoriaNombre, value: item.ingresosCentimos / 100, caption: `${item.cuartosAlquilados} cuarto(s) alquilado(s)` }))}
                  valueLabel={(value) => `S/ ${value.toFixed(2)}`}
                  seriesName="Ingresos"
                />
              )}
            </Section>

            <Section title="Ingresos por modalidad" subtitle="Qué tipo de alquiler genera más ventas" delay={120}>
              {report.ingresosPorModalidad.length === 0 ? <Empty /> : (
                <HorizontalBarChart
                  data={report.ingresosPorModalidad.map((item) => ({ label: item.modalidadNombre, value: item.ingresosCentimos / 100 }))}
                  valueLabel={(value) => `S/ ${value.toFixed(2)}`}
                  seriesName="Ingresos"
                  color="#0284c7"
                />
              )}
            </Section>

            <Section title="Distribución de cobros" subtitle="Métodos de pago aceptados en el periodo" delay={180}>
              {report.ingresosPorMetodo.length === 0 ? <Empty /> : <PaymentMixChart report={report} />}
            </Section>
          </div>

          <Section title="Ventas por recepcionista" subtitle="Facturación registrada por miembro del equipo">
            {report.ventasPorRecepcionista.length === 0 ? <Empty /> : (
              <HorizontalBarChart
                data={report.ventasPorRecepcionista.map((item) => ({ label: item.nombre, value: item.totalCentimos / 100, caption: `${item.cantidadVentas} venta${item.cantidadVentas === 1 ? "" : "s"}` }))}
                valueLabel={(value) => `S/ ${value.toFixed(2)}`}
                seriesName="Ventas registradas"
              />
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Productos más vendidos" subtitle="Unidades vendidas de bodega">
              {report.rankingProductos.length === 0 ? <Empty /> : (
                <HorizontalBarChart
                  data={report.rankingProductos.slice(0, 6).map((item) => ({ label: item.nombre, value: item.cantidadVendida, caption: format(cents(item.totalCentimos)) }))}
                  valueLabel={(value) => `${value} und.`}
                  seriesName="Unidades vendidas"
                  color="#7c3aed"
                />
              )}
            </Section>

            <Section title="Cargos extra" subtitle="Ingresos adicionales por concepto" delay={60}>
              {report.cargosExtra.length === 0 ? <Empty /> : (
                <HorizontalBarChart
                  data={report.cargosExtra.slice(0, 6).map((item) => ({ label: item.nombre, value: item.totalCentimos / 100, caption: `${item.cantidad} registro(s)` }))}
                  valueLabel={(value) => `S/ ${value.toFixed(2)}`}
                  seriesName="Ingresos por cargos"
                  color="#d97706"
                />
              )}
            </Section>
          </div>

          <Section title="Horas pico de check-in" subtitle="Intensidad de check-ins por día y hora">
            {report.horasPico.length === 0 ? <Empty /> : <Heatmap data={report.horasPico} />}
          </Section>
        </div>
      )}
    </>
  );
}
