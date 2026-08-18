import { useEffect, useState } from "react";
import type { ComprobantePago } from "@casacarlos/contracts";
import { api } from "../api.js";

interface Props {
  onClose: () => void;
}

export function ComprobantesPagoPanel({ onClose }: Props) {
  const [items, setItems] = useState<ComprobantePago[]>([]);

  useEffect(() => {
    api.listComprobantesPago().then(setItems);
  }, []);

  const borradores = items.filter((i) => i.estado === "BORRADOR").length;
  const emitidos = items.filter((i) => i.estado === "EMITIDO").length;

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
            <div key={i.id} className="flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 text-slate-300">
              <span>
                {i.tipo === "BOLETA" ? "Boleta" : `Factura (${i.receptorRuc})`} — {new Date(i.creadoEn).toLocaleString("es-PE")}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${i.estado === "EMITIDO" ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                {i.estado === "EMITIDO" ? "Emitido" : "Borrador"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
