import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { Product } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api, ApiError } from "../api.js";

interface Props {
  onAdd: (productoId: string) => Promise<void>;
}

/** Search box doubles as a barcode-scanner target — the scanner just "types" the code and Enter. */
export function ProductPicker({ onAdd }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.products().then(setProducts);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.nombre.toLowerCase().includes(q) || p.codigoBarras?.toLowerCase().includes(q));
  }, [products, query]);

  const add = async (product: Product) => {
    setBusyId(product.id);
    setError(null);
    try {
      await onAdd(product.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo agregar el producto.");
    } finally {
      setBusyId(null);
    }
  };

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const exact = products.find((p) => p.codigoBarras === query.trim());
    if (exact) {
      await add(exact);
      setQuery("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar producto o escanear código de barras"
        className="rounded-lg border border-line bg-raised px-3 py-2 text-ink"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-subtle">Sin resultados.</p>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-line px-3 py-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{p.nombre}</p>
                <p className="text-xs text-subtle">
                  {format(cents(p.precioCentimos))} · stock {p.stock}
                  {p.stock <= p.stockMinimo && <span className="ml-1 text-warn">bajo</span>}
                </p>
              </div>
              <button
                onClick={() => add(p)}
                disabled={busyId === p.id || p.stock <= 0}
                className="rounded-lg bg-brand px-3 py-1 text-sm font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-40"
              >
                {p.stock <= 0 ? "Sin stock" : "+ Agregar"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
