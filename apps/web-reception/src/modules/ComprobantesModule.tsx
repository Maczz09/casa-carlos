import { useEffect, useMemo, useState } from "react";
import type { ComprobantePago } from "@casacarlos/contracts";
import { IconPrinter, IconReceipt } from "@casacarlos/ui";
import { api } from "../api.js";
import { printComprobantePago } from "../components/receipt.js";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton, StatCard } from "../components/ui.js";

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

type TipoFiltro = "TODOS" | "BOLETA" | "FACTURA";
type EstadoFiltro = "TODOS" | "BORRADOR" | "EMITIDO";

export function ComprobantesModule() {
  const [items, setItems] = useState<ComprobantePago[] | null>(null);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [printingId, setPrintingId] = useState<string | null>(null);

  const [desde, setDesde] = useState(daysAgoIso(30));
  const [hasta, setHasta] = useState(todayIso());
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [estado, setEstado] = useState<EstadoFiltro>("TODOS");

  useEffect(() => {
    api.listComprobantesPago().then(async (list) => {
      setItems(list);
      const sales = await Promise.all(list.map((i) => api.getSale(i.ventaId)));
      const map: Record<string, string> = {};
      sales.forEach((s, idx) => {
        map[list[idx]!.id] = s.clienteNombres ? `${s.clienteNombres} ${s.clienteApellidos ?? ""}`.trim() : "Sin cliente";
      });
      setClientes(map);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    const desdeMs = new Date(`${desde}T00:00:00`).getTime();
    const hastaMs = new Date(`${hasta}T23:59:59.999`).getTime();
    return items.filter((i) => {
      const t = new Date(i.creadoEn).getTime();
      if (t < desdeMs || t > hastaMs) return false;
      if (tipo !== "TODOS" && i.tipo !== tipo) return false;
      if (estado !== "TODOS" && i.estado !== estado) return false;
      return true;
    });
  }, [items, desde, hasta, tipo, estado]);

  const print = async (item: ComprobantePago) => {
    setPrintingId(item.id);
    try {
      await printComprobantePago(item);
    } finally {
      setPrintingId(null);
    }
  };

  const borradores = filtered?.filter((i) => i.estado === "BORRADOR").length ?? 0;
  const emitidos = filtered?.filter((i) => i.estado === "EMITIDO").length ?? 0;

  return (
    <>
      <PageHeader title="Comprobantes" subtitle="Control interno de comprobantes de pago y su emisión a SUNAT" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={filtered?.length ?? "—"} icon={<IconReceipt className="h-4 w-4" />} tone="tone-sky" />
        <StatCard label="Borradores" value={borradores} hint="Sin emitir a SUNAT" tone="tone-amber" delay={60} />
        <StatCard label="Emitidos" value={emitidos} hint="Ya enviados a SUNAT" tone="tone-teal" delay={120} />
      </div>

      <Card className="mb-5">
        <div className="grid gap-3 p-4 sm:grid-cols-4">
          <Field label="Desde">
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoFiltro)}>
              <option value="TODOS">Todos</option>
              <option value="BOLETA">Boleta</option>
              <option value="FACTURA">Factura</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoFiltro)}>
              <option value="TODOS">Todos</option>
              <option value="BORRADOR">Borrador</option>
              <option value="EMITIDO">Emitido</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {filtered === null ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title="No hay comprobantes en este rango"
            hint="Los comprobantes de pago se generan desde el detalle de un cuarto cuando el saldo llega a cero. Probá ajustando los filtros."
          />
        ) : (
          <div className="divide-y divide-line-soft">
            {filtered.map((i, idx) => (
              <div key={i.id} className="stagger flex flex-wrap items-center justify-between gap-3 px-5 py-3" style={{ ["--i" as string]: idx }}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {i.tipo === "BOLETA" ? "Boleta" : `Factura · RUC ${i.receptorRuc}`} — {clientes[i.id] ?? "…"}
                  </p>
                  <p className="text-xs text-muted">{new Date(i.creadoEn).toLocaleString("es-PE")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={i.estado === "EMITIDO" ? "tone-teal" : "tone-amber"}>{i.estado === "EMITIDO" ? "Emitido" : "Borrador"}</Badge>
                  <Button size="sm" icon={<IconPrinter className="h-3.5 w-3.5" />} disabled={printingId === i.id} onClick={() => print(i)}>
                    Imprimir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
