import { useEffect, useState } from "react";
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

function ProductCover({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div className="grid h-full place-items-center text-center text-sm text-subtle">
        <div><svg viewBox="0 0 48 48" className="mx-auto h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m24 6 17 9v18l-17 9-17-9V15Z"/><path d="m7 15 17 9 17-9M24 24v18"/></svg><span className="mt-2 block">Imagen no disponible</span></div>
      </div>
    );
  }

  return <img src={src} alt={name} onError={() => setFailed(true)} className="h-full w-full bg-white object-contain p-3 transition-transform duration-300 group-enabled:group-hover:scale-[1.02]" />;
}

/** Paso opcional entre elegir cuarto y pagar — el huésped puede agregar productos de una vez, o seguir directo a pagar. */
export function ProductsScreen({ products, totalCentimos, onAdd, onFinish, onCancel }: Props) {
  const [wantsProducts, setWantsProducts] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async (productoId: string) => {
    setBusyId(productoId);
    try {
      await onAdd(productoId);
    } finally {
      setBusyId(null);
    }
  };

  if (wantsProducts === null) {
    return (
      <Shell title="¿Desea agregar un producto a su habitación?" step="Opcional — productos y bebidas" onBack={onCancel}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="stagger flex gap-6">
            <button
              style={{ ["--i" as string]: 0 }}
              onClick={() => setWantsProducts(true)}
              className="rounded-2xl bg-brand px-12 py-6 text-2xl font-medium text-brand-ink shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
            >
              Sí
            </button>
            <button
              style={{ ["--i" as string]: 1 }}
              onClick={onFinish}
              className="rounded-2xl bg-inset px-12 py-6 text-2xl font-medium text-ink transition-transform active:scale-[0.98]"
            >
              No
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="¿Algo más?" step="Opcional — productos y bebidas" onBack={onCancel}>
      {products.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-lg text-muted">No hay productos disponibles ahora.</div>
      ) : (
        <div className="stagger grid flex-1 grid-cols-3 gap-4 content-start overflow-y-auto">
          {products.map((p, i) => (
            <button
              key={p.id}
              style={{ ["--i" as string]: i }}
              onClick={() => add(p.id)}
              disabled={busyId === p.id || !p.enStock}
              className="group overflow-hidden rounded-2xl bg-surface text-left shadow-[var(--shadow-card)] ring-1 ring-line transition-all duration-200 active:scale-[0.98] disabled:opacity-60 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[var(--shadow-pop)]"
            >
              <div className="relative aspect-video overflow-hidden bg-inset">
                <ProductCover src={p.imagenes[0]} name={p.nombre} />
                <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${p.enStock ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                  {p.enStock ? "Disponible" : "Agotado"}
                </span>
                {p.imagenes.length > 1 && <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">+{p.imagenes.length - 1}</span>}
              </div>
              <div className="flex flex-col gap-1 p-4">
                <span className="font-serif text-xl text-ink">{p.nombre}</span>
                {p.categoria && <span className="text-xs font-medium uppercase tracking-wide text-subtle">{p.categoria}</span>}
                {p.descripcion && <span className="line-clamp-2 min-h-8 text-sm text-muted">{p.descripcion}</span>}
                <span className="mt-1 text-xl font-semibold text-brand">{format(cents(p.precioCentimos))}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="animate-fade-up mt-6 flex items-center justify-between rounded-2xl bg-surface p-5 shadow-[var(--shadow-card)] ring-1 ring-line">
        <div>
          <p className="text-sm text-muted">Total hasta ahora</p>
          <p className="font-serif text-2xl text-ink">{format(cents(totalCentimos))}</p>
        </div>
        <button onClick={onFinish} className="rounded-2xl bg-brand px-8 py-4 text-lg font-medium text-brand-ink transition-transform active:scale-[0.98]">
          Continuar
        </button>
      </div>
    </Shell>
  );
}
