import { useEffect, useMemo, useState } from "react";
import type { ComprobantePagoView, DocumentType } from "@casacarlos/contracts";
import { formatDateTime12h } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconPrinter, IconReceipt, IconSearch, IconX } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { openComprobantePdf, printReceiptForSale } from "../components/receipt.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Skeleton, StatCard, cx } from "../components/ui.js";

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

type TipoFiltro = "TODOS" | "BOLETA" | "FACTURA";
type EstadoFiltro = "TODOS" | "BORRADOR" | "EMITIDO";

export function ComprobantesModule() {
  const [items, setItems] = useState<ComprobantePagoView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [desde, setDesde] = useState(daysAgoIso(30));
  const [hasta, setHasta] = useState(todayIso());
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [estado, setEstado] = useState<EstadoFiltro>("TODOS");
  const [search, setSearch] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal para emitir a SUNAT una venta en borrador
  const [emitModalItem, setEmitModalItem] = useState<ComprobantePagoView | null>(null);
  const [emitTipo, setEmitTipo] = useState<DocumentType>("BOLETA");
  const [facturaRuc, setFacturaRuc] = useState("");
  const [facturaRazonSocial, setFacturaRazonSocial] = useState("");
  const [emitBusy, setEmitBusy] = useState(false);

  const loadData = async (rangeDesde = desde, rangeHasta = hasta) => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listComprobantesPago({ desde: rangeDesde, hasta: rangeHasta });
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los comprobantes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleQuickPeriod = (d: string, h: string) => {
    setDesde(d);
    setHasta(h);
    void loadData(d, h);
  };

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (tipo !== "TODOS" && i.tipo !== tipo) return false;
      if (estado !== "TODOS" && i.estado !== estado) return false;
      if (q) {
        const clientFull = `${i.clienteNombres ?? ""} ${i.clienteApellidos ?? ""}`.toLowerCase();
        const dni = (i.clienteDni ?? "").toLowerCase();
        const ruc = (i.receptorRuc ?? "").toLowerCase();
        const razon = (i.receptorRazonSocial ?? "").toLowerCase();
        const serieCorrelativo = `${i.serie}-${i.correlativo}`.toLowerCase();
        const match =
          clientFull.includes(q) ||
          dni.includes(q) ||
          ruc.includes(q) ||
          razon.includes(q) ||
          serieCorrelativo.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [items, tipo, estado, search]);

  const print = async (item: ComprobantePagoView) => {
    setPrintingId(item.id);
    try {
      if (item.estado === "EMITIDO" && item.comprobanteId) {
        await openComprobantePdf(item.comprobanteId);
      } else {
        await printReceiptForSale(item.ventaId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al abrir o imprimir comprobante.");
    } finally {
      setPrintingId(null);
    }
  };

  const handleOpenEmitModal = (item: ComprobantePagoView) => {
    setEmitModalItem(item);
    setEmitTipo(item.tipo ?? "BOLETA");
    setFacturaRuc(item.receptorRuc || (item.clienteDni?.length === 11 ? item.clienteDni : ""));
    setFacturaRazonSocial(item.receptorRazonSocial || "");
  };

  const handleConfirmEmit = async () => {
    if (!emitModalItem) return;
    setEmitBusy(true);
    setError(null);
    try {
      if (emitTipo === "BOLETA") {
        await api.issueBoleta(emitModalItem.ventaId);
      } else {
        if (!facturaRuc || facturaRuc.length !== 11) {
          throw new Error("El RUC debe tener exactamente 11 dígitos para emitir una Factura.");
        }
        if (!facturaRazonSocial.trim()) {
          throw new Error("Debes indicar la Razón Social para emitir una Factura.");
        }
        await api.issueFactura(emitModalItem.ventaId, facturaRuc.trim(), facturaRazonSocial.trim());
      }
      setSuccess("Comprobante emitido a SUNAT con éxito.");
      setTimeout(() => setSuccess(null), 4000);
      setEmitModalItem(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al emitir a SUNAT.");
    } finally {
      setEmitBusy(false);
    }
  };

  const borradores = filtered?.filter((i) => i.estado === "BORRADOR").length ?? 0;
  const emitidos = filtered?.filter((i) => i.estado === "EMITIDO").length ?? 0;
  const totalCobradoCentimos = filtered?.reduce((acc, curr) => acc + (curr.totalCentimos || 0), 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Comprobantes de Pago"
        subtitle="Listado oficial de ventas y emisión de boletas o facturas con impresión directa de comprobantes"
      />

      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      {success && (
        <div className="mb-4">
          <Notice kind="ok">{success}</Notice>
        </div>
      )}

      {/* Tarjetas de estadísticas */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Comprobantes" value={filtered?.length ?? "—"} icon={<IconReceipt className="h-4 w-4" />} tone="tone-sky" />
        <StatCard label="Total en Ventas" value={format(cents(totalCobradoCentimos))} hint="Monto total del periodo" tone="tone-teal" delay={40} />
        <StatCard label="Tickets / Borradores" value={borradores} hint="Listos para imprimir o emitir" tone="tone-amber" delay={80} />
        <StatCard label="Emitidos a SUNAT" value={emitidos} hint="Con validez electrónica oficial" tone="tone-violet" delay={120} />
      </div>

      {/* Filtros de búsqueda */}
      <Card className="mb-5 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Períodos rápidos:</span>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant={desde === todayIso() && hasta === todayIso() ? "primary" : "secondary"} onClick={() => handleQuickPeriod(todayIso(), todayIso())}>
              Hoy
            </Button>
            <Button size="sm" variant={desde === daysAgoIso(7) ? "primary" : "secondary"} onClick={() => handleQuickPeriod(daysAgoIso(7), todayIso())}>
              Últimos 7 días
            </Button>
            <Button size="sm" variant={desde === daysAgoIso(30) ? "primary" : "secondary"} onClick={() => handleQuickPeriod(daysAgoIso(30), todayIso())}>
              Últimos 30 días
            </Button>
            <Button size="sm" variant={desde === "2020-01-01" ? "primary" : "secondary"} onClick={() => handleQuickPeriod("2020-01-01", todayIso())}>
              Todo el Historial
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="lg:col-span-2">
            <Field label="Buscar cliente, DNI, RUC o N° comprobante">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Ej. Juan Pérez, 72345678, B001-12..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
              </div>
            </Field>
          </div>

          <Field label="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Field>

          <Field label="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Field>

          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => loadData(desde, hasta)} disabled={loading}>
              {loading ? "Cargando…" : "Filtrar"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-line-soft">
          <Field label="Tipo de comprobante">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoFiltro)}>
              <option value="TODOS">Todos los tipos</option>
              <option value="BOLETA">Boletas de Venta</option>
              <option value="FACTURA">Facturas Electrónicas</option>
            </Select>
          </Field>

          <Field label="Estado tributario">
            <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoFiltro)}>
              <option value="TODOS">Todos los estados</option>
              <option value="BORRADOR">Borrador / Ticket de Venta interno</option>
              <option value="EMITIDO">Emitido oficialmente a SUNAT</option>
            </Select>
          </Field>
        </div>
      </Card>

      {/* Listado de comprobantes */}
      <Card>
        {filtered === null || loading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title="No se encontraron comprobantes para el filtro seleccionado"
            hint="Prueba cambiando las fechas o el término de búsqueda. Todas las ventas registradas se guardan automáticamente."
          />
        ) : (
          <div className="divide-y divide-line-soft">
            {filtered.map((item, idx) => {
              const correlativoFmt = `${item.serie}-${String(item.correlativo).padStart(6, "0")}`;
              const clienteNombre = item.clienteNombres
                ? `${item.clienteNombres} ${item.clienteApellidos ?? ""}`.trim()
                : item.receptorRazonSocial || "Venta mostrador / Sin cliente registrado";
              const documento = item.receptorRuc
                ? `RUC ${item.receptorRuc}`
                : item.clienteDni
                ? `DNI ${item.clienteDni}`
                : null;

              return (
                <div
                  key={item.id}
                  className="stagger flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-inset/50"
                  style={{ ["--i" as string]: idx }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.tipo === "FACTURA" ? "tone-violet" : "tone-sky"} className="font-bold">
                        {item.tipo}
                      </Badge>
                      <Badge tone={item.estado === "EMITIDO" ? "tone-teal" : "tone-amber"}>
                        {item.estado === "EMITIDO" ? "Emitido SUNAT" : "Ticket / Borrador"}
                      </Badge>
                      <span className="font-mono text-sm font-bold text-ink">{correlativoFmt}</span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-ink truncate">{clienteNombre}</span>
                      {documento && <span className="text-xs text-subtle">({documento})</span>}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span>🕒 {formatDateTime12h(item.creadoEn)}</span>
                      {item.saleEstado && (
                        <span className="text-[11px] text-subtle">
                          Estado venta: <strong>{item.saleEstado}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Importe y Acciones */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-ink">{format(cents(item.totalCentimos))}</p>
                      <p className={cx("text-[11px] font-semibold", item.saldoCentimos <= 0 ? "text-ok" : "text-warn")}>
                        {item.saldoCentimos <= 0 ? "✓ Pagada" : `Saldo: ${format(cents(item.saldoCentimos))}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<IconPrinter className="h-4 w-4" />}
                        disabled={printingId === item.id}
                        onClick={() => print(item)}
                      >
                        {printingId === item.id ? "Imprimiendo…" : "Imprimir"}
                      </Button>

                      {item.estado === "BORRADOR" && (
                        <Button size="sm" variant="secondary" onClick={() => handleOpenEmitModal(item)}>
                          Emitir SUNAT
                        </Button>
                      )}

                      {item.estado === "EMITIDO" && item.comprobanteId && (
                        <Button size="sm" variant="ghost" onClick={() => openComprobantePdf(item.comprobanteId!)}>
                          Ver PDF
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Modal para emitir a SUNAT */}
      {emitModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">Emitir Comprobante a SUNAT</h3>
                <p className="text-xs text-muted">Venta {emitModalItem.serie}-{emitModalItem.correlativo}</p>
              </div>
              <button
                onClick={() => setEmitModalItem(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-inset hover:text-ink transition-colors"
              >
                <IconX className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-inset p-3 text-xs space-y-1">
              <p>
                <strong>Cliente:</strong> {emitModalItem.clienteNombres} {emitModalItem.clienteApellidos}
              </p>
              <p>
                <strong>Total de la venta:</strong> {format(cents(emitModalItem.totalCentimos))}
              </p>
            </div>

            <div className="space-y-3">
              <Field label="Tipo de comprobante a emitir">
                <Select value={emitTipo} onChange={(e) => setEmitTipo(e.target.value as DocumentType)}>
                  <option value="BOLETA">Boleta de Venta Electrónica (DNI)</option>
                  <option value="FACTURA">Factura Electrónica (RUC)</option>
                </Select>
              </Field>

              {emitTipo === "BOLETA" ? (
                <div className="text-xs text-subtle leading-relaxed">
                  Se emitirá una Boleta de Venta electrónica con el DNI del cliente ({emitModalItem.clienteDni || "Sin DNI registrado"}).
                </div>
              ) : (
                <>
                  <Field label="RUC de la empresa (11 dígitos)">
                    <Input
                      type="text"
                      maxLength={11}
                      value={facturaRuc}
                      onChange={(e) => setFacturaRuc(e.target.value)}
                      placeholder="20123456789"
                    />
                  </Field>
                  <Field label="Razón Social">
                    <Input
                      type="text"
                      value={facturaRazonSocial}
                      onChange={(e) => setFacturaRazonSocial(e.target.value)}
                      placeholder="Empresa SAC"
                    />
                  </Field>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-line-soft">
              <Button variant="secondary" className="flex-1" onClick={() => setEmitModalItem(null)} disabled={emitBusy}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1" onClick={handleConfirmEmit} disabled={emitBusy}>
                {emitBusy ? "Emitiendo a SUNAT…" : "Confirmar y Emitir"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
