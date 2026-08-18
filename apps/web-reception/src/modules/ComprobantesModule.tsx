import { useEffect, useState } from "react";
import type { ComprobantePago, SaleWithLines } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { IconPrinter, IconReceipt } from "@casacarlos/ui";
import { api, getToken } from "../api.js";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, StatCard } from "../components/ui.js";

export function ComprobantesModule() {
  const [items, setItems] = useState<ComprobantePago[] | null>(null);
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [borradorPrint, setBorradorPrint] = useState<{ item: ComprobantePago; sale: SaleWithLines } | null>(null);

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

  // El markup del borrador tiene que estar en el DOM antes de llamar a print().
  useEffect(() => {
    if (!borradorPrint) return;
    const id = setTimeout(() => window.print(), 50);
    return () => clearTimeout(id);
  }, [borradorPrint]);

  const print = async (item: ComprobantePago) => {
    if (item.estado === "EMITIDO" && item.comprobanteId) {
      const token = getToken();
      const res = await fetch(api.comprobantePdfUrl(item.comprobanteId), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      window.open(URL.createObjectURL(await res.blob()), "_blank");
      return;
    }
    setBorradorPrint({ item, sale: await api.getSale(item.ventaId) });
  };

  const borradores = items?.filter((i) => i.estado === "BORRADOR").length ?? 0;
  const emitidos = items?.filter((i) => i.estado === "EMITIDO").length ?? 0;

  return (
    <>
      <PageHeader title="Comprobantes" subtitle="Control interno de comprobantes de pago y su emisión a SUNAT" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={items?.length ?? "—"} icon={<IconReceipt className="h-4 w-4" />} tone="tone-sky" />
        <StatCard label="Borradores" value={borradores} hint="Sin emitir a SUNAT" tone="tone-amber" delay={60} />
        <StatCard label="Emitidos" value={emitidos} hint="Ya enviados a SUNAT" tone="tone-teal" delay={120} />
      </div>

      <Card>
        {items === null ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title="Todavía no hay comprobantes"
            hint="Los comprobantes de pago se generan desde el detalle de un cuarto cuando el saldo llega a cero."
          />
        ) : (
          <div className="divide-y divide-line-soft">
            {items.map((i, idx) => (
              <div key={i.id} className="stagger flex flex-wrap items-center justify-between gap-3 px-5 py-3" style={{ ["--i" as string]: idx }}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {i.tipo === "BOLETA" ? "Boleta" : `Factura · RUC ${i.receptorRuc}`} — {clientes[i.id] ?? "…"}
                  </p>
                  <p className="text-xs text-muted">{new Date(i.creadoEn).toLocaleString("es-PE")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={i.estado === "EMITIDO" ? "tone-teal" : "tone-amber"}>{i.estado === "EMITIDO" ? "Emitido" : "Borrador"}</Badge>
                  <Button size="sm" icon={<IconPrinter className="h-3.5 w-3.5" />} onClick={() => print(i)}>
                    Imprimir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {borradorPrint && (
        <div className="print-only-receipt hidden">
          <h2>CASA CARLOS</h2>
          <p className="receipt-center">Comprobante de pago (BORRADOR)</p>
          <p className="receipt-center">Control interno — no válido como comprobante SUNAT</p>
          <hr />
          <p>{new Date(borradorPrint.item.creadoEn).toLocaleString("es-PE")}</p>
          {borradorPrint.sale.clienteNombres && (
            <p>
              Cliente: {borradorPrint.sale.clienteNombres} {borradorPrint.sale.clienteApellidos}
            </p>
          )}
          {borradorPrint.sale.clienteDni && <p>DNI: {borradorPrint.sale.clienteDni}</p>}
          {borradorPrint.item.tipo === "FACTURA" && (
            <>
              <p>RUC: {borradorPrint.item.receptorRuc}</p>
              <p>Razón social: {borradorPrint.item.receptorRazonSocial}</p>
            </>
          )}
          <hr />
          <table>
            <tbody>
              {borradorPrint.sale.lineas.map((l) => (
                <tr key={l.id}>
                  <td>{l.descripcion}</td>
                  <td>{format(cents(l.subtotalCentimos))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr />
          <p className="receipt-total">TOTAL {format(cents(borradorPrint.sale.totalCentimos))}</p>
          <hr />
          <p className="receipt-center">{borradorPrint.item.tipo === "BOLETA" ? "BOLETA DE VENTA" : "FACTURA"}</p>
        </div>
      )}
    </>
  );
}
