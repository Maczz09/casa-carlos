import { useEffect, useState } from "react";
import type { ComprobantePago, SaleWithLines } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api, getToken } from "../api.js";

interface Props {
  onClose: () => void;
}

export function ComprobantesPagoPanel({ onClose }: Props) {
  const [items, setItems] = useState<ComprobantePago[]>([]);
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

  useEffect(() => {
    if (!borradorPrint) return;
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, [borradorPrint]);

  const borradores = items.filter((i) => i.estado === "BORRADOR").length;
  const emitidos = items.filter((i) => i.estado === "EMITIDO").length;

  const print = async (item: ComprobantePago) => {
    if (item.estado === "EMITIDO" && item.comprobanteId) {
      const token = getToken();
      const res = await fetch(api.comprobantePdfUrl(item.comprobanteId), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
      return;
    }
    const sale = await api.getSale(item.ventaId);
    setBorradorPrint({ item, sale });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Comprobantes de pago (control interno)</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mb-4 flex gap-3 text-sm">
          <div className="rounded-lg bg-slate-900 px-4 py-2">
            <p className="text-slate-400">Total</p>
            <p className="text-lg font-semibold text-white">{items.length}</p>
          </div>
          <div className="rounded-lg bg-slate-900 px-4 py-2">
            <p className="text-slate-400">Borradores</p>
            <p className="text-lg font-semibold text-amber-400">{borradores}</p>
          </div>
          <div className="rounded-lg bg-slate-900 px-4 py-2">
            <p className="text-slate-400">Emitidos</p>
            <p className="text-lg font-semibold text-teal-400">{emitidos}</p>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          {items.length === 0 && <p className="text-slate-400">No hay comprobantes de pago registrados todavía.</p>}
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-slate-300">
              <span className="min-w-0 truncate">
                {i.tipo === "BOLETA" ? "Boleta" : `Factura (${i.receptorRuc})`} — {clientes[i.id] ?? "…"} — {new Date(i.creadoEn).toLocaleString("es-PE")}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${i.estado === "EMITIDO" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                  {i.estado === "EMITIDO" ? "Emitido" : "Borrador"}
                </span>
                <button onClick={() => print(i)} className="rounded-md bg-slate-700 px-2.5 py-1 text-xs text-white hover:bg-slate-600">
                  Imprimir
                </button>
              </div>
            </div>
          ))}
        </div>

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
      </div>
    </div>
  );
}
