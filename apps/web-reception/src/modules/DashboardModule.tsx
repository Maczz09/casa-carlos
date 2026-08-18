import { Fragment, useEffect, useState } from "react";
import type { DashboardReport, HoraPico, Product } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconBox } from "@casacarlos/ui";
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

const maxOf = (values: number[]): number => Math.max(1, ...values);

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

function BarRow({ label, value, valueLabel, max, tone = "brand" }: { label: string; value: number; valueLabel: string; max: number; tone?: "brand" | "violet" }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate text-muted">{label}</span>
        <span className="shrink-0 font-medium tabular-nums text-ink">{valueLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-inset">
        <div
          className={cx("h-2 rounded-full transition-[width] duration-700 ease-out", tone === "violet" ? "bg-[#7C3AED]" : "bg-brand")}
          style={{ width: `${pct}%` }}
        />
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

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Ocupación por piso">
              <div className="flex flex-col gap-3">
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
                      tone="violet"
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Ocupación por categoría" delay={60}>
              <div className="flex flex-col gap-3">
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
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Ingresos por modalidad" delay={120}>
              <div className="flex flex-col gap-3">
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
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Ingresos por método de pago" delay={180}>
              <div className="flex flex-col gap-3">
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
                    />
                  ))
                )}
              </div>
            </Section>
          </div>

          <Section title="Ventas por recepcionista">
            <div className="flex flex-col gap-3">
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
                  />
                ))
              )}
            </div>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Productos más vendidos">
              <div className="flex flex-col gap-3">
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
                      tone="violet"
                    />
                  ))
                )}
              </div>
            </Section>

            <Section title="Cargos extra" delay={60}>
              <div className="flex flex-col gap-3">
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
                      tone="violet"
                    />
                  ))
                )}
              </div>
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
