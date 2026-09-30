import { useEffect, useMemo, useState } from "react";
import type { CancelledSale, SaleLine } from "@casacarlos/contracts";
import { formatDateTime12h } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconAlertTriangle, IconCheck, IconFileChart, IconFileX, IconReceipt, IconSearch } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Row, Section, Skeleton, StatCard, cx } from "../components/ui.js";

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};
const startOfMonthIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

export function AnulacionesModule() {
  const [desde, setDesde] = useState(daysAgoIso(30));
  const [hasta, setHasta] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CancelledSale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<CancelledSale | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    setItems(null);
    setError(null);
    try {
      const list = await api.cancelledSales({ desde, hasta });
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las anulaciones.");
      setItems([]);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((sale) => {
      const correlativo = `${sale.serie}-${sale.correlativo}`.toLowerCase();
      const cliente = `${sale.clienteNombres ?? ""} ${sale.clienteApellidos ?? ""}`.toLowerCase();
      const dni = (sale.clienteDni ?? "").toLowerCase();
      const motivo = (sale.motivoAnulacion ?? "").toLowerCase();
      const usuario = (sale.anuladoPorNombre ?? sale.anuladoPorUsuarioId ?? "").toLowerCase();
      const corr = (sale.correlationId ?? "").toLowerCase();
      const idem = (sale.idempotencyKey ?? "").toLowerCase();
      return (
        correlativo.includes(q) ||
        cliente.includes(q) ||
        dni.includes(q) ||
        motivo.includes(q) ||
        usuario.includes(q) ||
        corr.includes(q) ||
        idem.includes(q)
      );
    });
  }, [items, search]);

  const stats = useMemo(() => {
    if (!items) return { count: 0, totalCentimos: 0, productsRestituted: 0 };
    let totalCentimos = 0;
    let productsRestituted = 0;
    for (const s of items) {
      totalCentimos += s.totalCentimos;
      if (s.lineas) {
        for (const l of s.lineas) {
          if (l.tipo === "PRODUCTO") productsRestituted += l.cantidad;
        }
      }
    }
    return { count: items.length, totalCentimos, productsRestituted };
  }, [items]);

  const exportCsv = () => {
    if (!items || items.length === 0) return;
    const header = "serie,correlativo,cliente,dni,total_soles,motivo_anulacion,anulado_por,fecha_anulacion,correlation_id,idempotency_key\n";
    const rows = items
      .map((s) => {
        const cliente = `"${(s.clienteNombres ? `${s.clienteNombres} ${s.clienteApellidos ?? ""}` : "").replace(/"/g, '""')}"`;
        const motivo = `"${(s.motivoAnulacion ?? "").replace(/"/g, '""')}"`;
        const usuario = `"${(s.anuladoPorNombre ?? s.anuladoPorUsuarioId ?? "").replace(/"/g, '""')}"`;
        return [
          s.serie,
          s.correlativo,
          cliente,
          s.clienteDni ?? "",
          (s.totalCentimos / 100).toFixed(2),
          motivo,
          usuario,
          s.anuladoEn ?? s.creadoEn,
          s.correlationId ?? "",
          s.idempotencyKey ?? "",
        ].join(",");
      })
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anulaciones_${desde}_a_${hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Anulaciones de ventas"
        subtitle="Registro y auditoría de ventas canceladas por error de digitación o duplicidad — trazabilidad por correlation ID, usuario e idempotencia"
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={loadData}>
              Actualizar
            </Button>
            <Button size="sm" variant="primary" icon={<IconFileChart className="h-3.5 w-3.5" />} onClick={exportCsv} disabled={!items || items.length === 0}>
              Exportar CSV
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {/* Tarjetas resumen */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ventas anuladas"
          value={stats.count}
          hint={`Periodo seleccionado (${desde} a ${hasta})`}
          icon={<IconFileX className="h-5 w-5" />}
          tone="tone-red"
        />
        <StatCard
          label="Monto total anulado"
          value={format(cents(stats.totalCentimos))}
          hint="Revertido de caja y cuentas de recepción"
          icon={<IconReceipt className="h-5 w-5" />}
          tone="tone-amber"
        />
        <StatCard
          label="Productos reincorporados"
          value={`${stats.productsRestituted} unid.`}
          hint="Stock devuelto a bodega automáticamente"
          icon={<IconCheck className="h-5 w-5" />}
          tone="tone-teal"
        />
      </div>

      {/* Barra de filtros */}
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Field>
          <div className="flex items-center gap-1.5 self-end pb-0.5">
            <Button size="sm" variant={desde === todayIso() && hasta === todayIso() ? "primary" : "secondary"} onClick={() => { setDesde(todayIso()); setHasta(todayIso()); }}>
              Hoy
            </Button>
            <Button size="sm" variant={desde === daysAgoIso(7) && hasta === todayIso() ? "primary" : "secondary"} onClick={() => { setDesde(daysAgoIso(7)); setHasta(todayIso()); }}>
              7 días
            </Button>
            <Button size="sm" variant={desde === startOfMonthIso() && hasta === todayIso() ? "primary" : "secondary"} onClick={() => { setDesde(startOfMonthIso()); setHasta(todayIso()); }}>
              Este mes
            </Button>
            <Button size="sm" variant={desde === "2024-01-01" ? "primary" : "secondary"} onClick={() => { setDesde("2024-01-01"); setHasta(todayIso()); }}>
              Todo
            </Button>
          </div>
          <div className="ml-auto w-full max-w-xs min-w-[200px]">
            <Field label="Buscar">
              <Input
                placeholder="Serie, cliente, DNI, motivo, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* Tabla de anulaciones */}
      <Section
        title="Historial de anulaciones"
        subtitle={
          items !== null
            ? `Mostrando ${filtered.length} de ${items.length} venta${items.length === 1 ? "" : "s"} anulada${items.length === 1 ? "" : "s"}`
            : "Cargando registros..."
        }
      >
        {items === null ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconFileX className="h-8 w-8 text-rose-400" />}
            title={items.length === 0 ? "No hay ventas anuladas en este periodo" : "No se encontraron coincidencias"}
            hint={items.length === 0 ? "Cuando se anulen ventas por duplicidad o error de digitación, aparecerán registradas aquí." : "Probá ajustando el término de búsqueda o ampliando las fechas."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-inset text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th className="px-4 py-3 font-semibold">Venta</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Motivo de anulación</th>
                  <th className="px-4 py-3 font-semibold">Anulado por</th>
                  <th className="px-4 py-3 font-semibold">Fecha / Hora</th>
                  <th className="px-4 py-3 font-semibold">Trazabilidad (Corr. ID / Idempotencia)</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filtered.map((sale) => (
                  <tr key={sale.id} className="transition-colors hover:bg-inset/40">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-ink">
                        {sale.serie}-{sale.correlativo}
                      </div>
                      <span className="text-[11px] text-muted">ID: {sale.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-ink">
                        {sale.clienteNombres ? `${sale.clienteNombres} ${sale.clienteApellidos ?? ""}`.trim() : "Sin cliente"}
                      </p>
                      {sale.clienteDni && <p className="text-xs text-muted">DNI {sale.clienteDni}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-rose-500 line-through">
                      {format(cents(sale.totalCentimos))}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-500">
                        <IconAlertTriangle className="h-3 w-3 shrink-0" />
                        {sale.motivoAnulacion || "Anulación sin motivo especificado"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-ink">{sale.anuladoPorNombre ?? "Usuario de caja"}</p>
                      {sale.anuladoPorUsuarioId && (
                        <p className="text-[11px] text-muted">ID: {sale.anuladoPorUsuarioId.slice(0, 8)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-xs text-muted">
                      {formatDateTime12h(sale.anuladoEn ?? sale.creadoEn)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        {sale.correlationId && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-subtle">Corr:</span>
                            <code className="rounded bg-inset px-1.5 py-0.5 font-mono text-[11px] text-ink">
                              {sale.correlationId.length > 20 ? `${sale.correlationId.slice(0, 20)}…` : sale.correlationId}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(sale.correlationId!, `corr_${sale.id}`)}
                              className="text-[11px] text-brand hover:underline"
                              title="Copiar correlation ID"
                            >
                              {copiedKey === `corr_${sale.id}` ? "✓ Copiado" : "Copiar"}
                            </button>
                          </div>
                        )}
                        {sale.idempotencyKey && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-subtle">Idem:</span>
                            <code className="rounded bg-inset px-1.5 py-0.5 font-mono text-[11px] text-ink">
                              {sale.idempotencyKey.length > 20 ? `${sale.idempotencyKey.slice(0, 20)}…` : sale.idempotencyKey}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(sale.idempotencyKey!, `idem_${sale.id}`)}
                              className="text-[11px] text-brand hover:underline"
                              title="Copiar idempotency key"
                            >
                              {copiedKey === `idem_${sale.id}` ? "✓ Copiado" : "Copiar"}
                            </button>
                          </div>
                        )}
                        {!sale.correlationId && !sale.idempotencyKey && (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button size="sm" onClick={() => setSelectedSale(sale)}>
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Modal de detalle de la anulación */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <Card className="relative w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-line-soft pb-4">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-500 mb-1.5">
                  <IconFileX className="h-3.5 w-3.5" />
                  Venta Anulada
                </span>
                <h3 className="text-lg font-bold text-ink">
                  Comprobante {selectedSale.serie}-{selectedSale.correlativo}
                </h3>
                <p className="text-xs text-muted">ID interno: {selectedSale.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSale(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-inset hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Motivo destacado */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">Motivo de la anulación</p>
              <p className="text-sm font-medium text-ink">{selectedSale.motivoAnulacion || "Sin motivo especificado"}</p>
            </div>

            {/* Auditoría y usuario */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-line bg-inset/40 p-3 space-y-1">
                <span className="text-subtle font-medium">Anulado por</span>
                <p className="font-semibold text-ink">{selectedSale.anuladoPorNombre ?? "Usuario"}</p>
                {selectedSale.anuladoPorUsuarioId && (
                  <p className="text-[11px] text-muted">ID: {selectedSale.anuladoPorUsuarioId}</p>
                )}
              </div>
              <div className="rounded-xl border border-line bg-inset/40 p-3 space-y-1">
                <span className="text-subtle font-medium">Fecha y hora</span>
                <p className="font-semibold text-ink">{formatDateTime12h(selectedSale.anuladoEn ?? selectedSale.creadoEn)}</p>
                <p className="text-[11px] text-muted">Venta creada: {formatDateTime12h(selectedSale.creadoEn)}</p>
              </div>
            </div>

            {/* Trazabilidad técnica */}
            <div className="rounded-xl border border-line bg-inset/30 p-3.5 space-y-2 text-xs">
              <span className="font-semibold uppercase tracking-wider text-subtle text-[10px]">Trazabilidad e Idempotencia</span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Correlation ID:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="rounded bg-surface border border-line px-2 py-0.5 font-mono text-[11px] text-ink">
                      {selectedSale.correlationId || "—"}
                    </code>
                    {selectedSale.correlationId && (
                      <Button size="sm" onClick={() => copyToClipboard(selectedSale.correlationId!, "modal_corr")}>
                        {copiedKey === "modal_corr" ? "✓" : "Copiar"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Idempotency Key:</span>
                  <div className="flex items-center gap-1.5">
                    <code className="rounded bg-surface border border-line px-2 py-0.5 font-mono text-[11px] text-ink">
                      {selectedSale.idempotencyKey || "—"}
                    </code>
                    {selectedSale.idempotencyKey && (
                      <Button size="sm" onClick={() => copyToClipboard(selectedSale.idempotencyKey!, "modal_idem")}>
                        {copiedKey === "modal_idem" ? "✓" : "Copiar"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Líneas de la venta */}
            {selectedSale.lineas && selectedSale.lineas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Líneas de la venta</p>
                <div className="divide-y divide-line-soft rounded-xl border border-line bg-surface overflow-hidden">
                  {selectedSale.lineas.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-2 p-3 text-xs">
                      <div>
                        <p className="font-medium text-ink">{line.descripcion}</p>
                        <span className="text-[11px] text-muted">
                          {line.tipo === "PRODUCTO" ? "Producto devuelto al inventario" : line.tipo === "HOSPEDAJE" ? "Estadía liberada" : "Cargo extra"}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums text-ink">{format(cents(line.subtotalCentimos))}</p>
                        <span className="text-[11px] text-muted">{line.cantidad} × {format(cents(line.precioUnitarioCentimos))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between border-t border-line-soft pt-3">
              <span className="text-sm font-medium text-muted">Total anulado:</span>
              <span className="text-lg font-bold tabular-nums text-rose-500 line-through">
                {format(cents(selectedSale.totalCentimos))}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedSale(null)}>Cerrar</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
