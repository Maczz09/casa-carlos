import { useState } from "react";
import type { KioskProduct } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { Shell } from "./Shell.js";

interface Props {
  products: KioskProduct[];
  totalCentimos: number;
  onAdd: (productoId: string) => Promise<void>;
  onFinish: () => void;
  onCancel: () => void;
}

/** Paso opcional entre elegir cuarto y pagar — el huésped puede agregar productos de una vez, o seguir directo a pagar. */
export function ProductsScreen({ products, totalCentimos, onAdd, onFinish, onCancel }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async (productoId: string) => {
    setBusyId(productoId);
    try {
      await onAdd(productoId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Shell title="¿Algo más?" step="Opcional — productos y bebidas" onBack={onCancel}>
      {products.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-lg text-stone-500">No hay productos disponibles ahora.</div>
      ) : (
        <div className="grid flex-1 grid-cols-3 gap-4 content-start overflow-y-auto">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => add(p.id)}
              disabled={busyId === p.id}
              className="flex flex-col gap-1 rounded-2xl bg-white p-4 text-left shadow-md ring-1 ring-stone-900/5 transition active:scale-[0.98] disabled:opacity-50"
            >
              <span className="font-serif text-lg text-stone-800">{p.nombre}</span>
              {p.categoria && <span className="text-xs text-stone-400">{p.categoria}</span>}
              <span className="text-lg font-semibold text-teal-700">{format(cents(p.precioCentimos))}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between rounded-2xl bg-white p-5 shadow-md ring-1 ring-stone-900/5">
        <div>
          <p className="text-sm text-stone-500">Total hasta ahora</p>
          <p className="font-serif text-2xl text-stone-800">{format(cents(totalCentimos))}</p>
        </div>
        <button onClick={onFinish} className="rounded-2xl bg-teal-700 px-8 py-4 text-lg font-medium text-white active:scale-[0.98]">
          Continuar
        </button>
      </div>
    </Shell>
  );
}
