import { useEffect, useState } from "react";
import type { KioskProduct, KioskSession } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { Shell } from "./Shell.js";

interface Props {
  session?: KioskSession | null;
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
        <div>
          <svg viewBox="0 0 48 48" className="mx-auto h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="m24 6 17 9v18l-17 9-17-9V15Z" />
            <path d="m7 15 17 9 17-9M24 24v18" />
          </svg>
          <span className="mt-2 block">Imagen no disponible</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-full w-full bg-white object-contain p-3 transition-transform duration-300 group-enabled:group-hover:scale-[1.02]"
    />
  );
}

/** Paso opcional entre elegir cuarto y pagar — sincronizado en vivo con lo que hace recepción. */
export function ProductsScreen({ session, products, totalCentimos, onAdd, onFinish, onCancel }: Props) {
  const [wantsProducts, setWantsProducts] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Las líneas reales de la venta (estadía + productos agregados)
  const lineas = session?.lineas ?? [];
  const productLines = lineas.filter((l) => l.tipo === "PRODUCTO");
  const hasProducts = productLines.length > 0;

  // Si recepción le dio a "Sí" o ya se agregó algún producto en recepción,
  // el kiosco avanza automáticamente sin obligar al cliente a tocar la pantalla.
  const activeProductsView = wantsProducts === true || session?.wantsProducts === true || hasProducts;

  const add = async (productoId: string) => {
    setBusyId(productoId);
    try {
      await onAdd(productoId);
    } finally {
      setBusyId(null);
    }
  };

  // Pantalla de pregunta previa si aún no se ha decidido
  if (!activeProductsView) {
    return (
      <Shell title="¿Desea agregar un producto o bebida a su habitación?" step="Opcional — productos de bodega" onBack={onCancel}>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center max-w-xl mx-auto">
          <div className="space-y-2">
            <h2 className="font-serif text-3xl font-bold text-ink">
              ¿Desea agregar productos o bebidas?
            </h2>
            <p className="text-base text-muted">
              Puede pedir aguas, gaseosas o snacks en recepción o agregarlos directamente a su habitación.
            </p>
          </div>

          <div className="stagger flex gap-6 w-full justify-center">
            <button
              style={{ ["--i" as string]: 0 }}
              onClick={() => setWantsProducts(true)}
              className="min-w-44 rounded-2xl bg-brand px-10 py-5 text-2xl font-semibold text-brand-ink shadow-[var(--shadow-card)] transition-transform active:scale-[0.98]"
            >
              Sí, deseo ver productos
            </button>
            <button
              style={{ ["--i" as string]: 1 }}
              onClick={onFinish}
              className="min-w-44 rounded-2xl bg-inset border border-line px-10 py-5 text-2xl font-semibold text-ink transition-transform active:scale-[0.98] hover:bg-surface"
            >
              No, continuar a pagar
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sincronizado en tiempo real con recepción</span>
          </div>
        </div>
      </Shell>
    );
  }

  // Vista activa con el catálogo y el resumen en vivo de la cuenta
  return (
    <Shell title="Productos y bebidas disponibles" step="Productos para su habitación" onBack={onCancel}>
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)] overflow-hidden">
        {/* Catálogo de productos */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-subtle font-semibold">Catálogo del hotel</p>
            <span className="text-xs text-muted">Indique a recepción o toque el producto</span>
          </div>

          {products.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-lg text-muted">No hay productos disponibles por ahora.</div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <div className="stagger grid grid-cols-2 gap-4 pb-2 sm:grid-cols-3">
                {products.map((p, i) => (
                  <button
                    key={p.id}
                    style={{ ["--i" as string]: i }}
                    onClick={() => add(p.id)}
                    disabled={busyId === p.id || !p.enStock}
                    className="group h-fit min-w-0 self-start overflow-hidden rounded-2xl bg-surface text-left shadow-[var(--shadow-card)] ring-1 ring-line transition-all duration-200 active:scale-[0.98] disabled:opacity-60 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[var(--shadow-pop)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-inset">
                      <ProductCover src={p.imagenes[0]} name={p.nombre} />
                      <span
                        className={`absolute right-2.5 top-2.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm ${
                          p.enStock ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                        }`}
                      >
                        {p.enStock ? "Disponible" : "Agotado"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3">
                      <span className="line-clamp-1 font-serif text-base font-semibold leading-tight text-ink">{p.nombre}</span>
                      {p.categoria && <span className="text-[10px] font-medium uppercase tracking-wide text-subtle">{p.categoria}</span>}
                      <span className="mt-1 text-lg font-bold text-brand">{format(cents(p.precioCentimos))}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resumen en vivo de la cuenta (actualizado al instante desde recepción) */}
        <div className="flex flex-col rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] min-h-0">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <div>
              <h3 className="font-serif text-lg font-bold text-ink">Detalle de su cuenta</h3>
              <p className="text-xs text-muted">Habitación y consumos agregados</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>En vivo</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 divide-y divide-line-soft">
            {lineas.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Cargando líneas de la cuenta…</p>
            ) : (
              lineas.map((linea) => (
                <div key={linea.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink truncate">{linea.descripcion}</p>
                    <p className="text-xs text-subtle">
                      {linea.cantidad} × {format(cents(linea.precioUnitarioCentimos))}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-ink shrink-0">
                    {format(cents(linea.subtotalCentimos))}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 border-t border-line pt-4 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold uppercase tracking-wider text-subtle">Total a pagar</span>
              <span className="font-serif text-3xl font-bold tabular-nums text-ink">{format(cents(totalCentimos))}</span>
            </div>

            <button
              onClick={onFinish}
              className="w-full rounded-2xl bg-brand py-4 text-lg font-semibold text-brand-ink shadow-sm transition-transform active:scale-[0.98] hover:bg-brand-hover"
            >
              Continuar al pago →
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
