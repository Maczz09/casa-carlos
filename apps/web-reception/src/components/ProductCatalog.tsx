import { useEffect, useState } from "react";
import type { Product, ProductMovement } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { api, ApiError } from "../api.js";

interface Props {
  onClose: () => void;
}

const MOVEMENT_LABEL: Record<string, string> = { INGRESO: "Ingreso", SALIDA: "Salida", AJUSTE: "Ajuste", ANULACION: "Anulación" };

export function ProductCatalog({ onClose }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.products().then(setProducts);

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Bodega</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

        {creating ? (
          <NewProductForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              reload();
            }}
            onError={setError}
          />
        ) : (
          <button onClick={() => setCreating(true)} className="mb-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + Nuevo producto
          </button>
        )}

        <div className="flex flex-col gap-2">
          {products.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-700">
              <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="flex w-full items-center justify-between px-3 py-2 text-left">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{p.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {p.categoria ?? "Sin categoría"} · {p.codigoBarras ?? "sin código"}
                  </p>
                </div>
                <div className="flex items-center gap-3 whitespace-nowrap text-sm">
                  <span className="text-white">{format(cents(p.precioCentimos))}</span>
                  <span className={p.stock <= p.stockMinimo ? "text-amber-400" : "text-slate-400"}>stock {p.stock}</span>
                  {p.estado !== "ACTIVO" && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{p.estado}</span>}
                </div>
              </button>
              {expandedId === p.id && (
                <ProductDetail
                  product={p}
                  onChanged={() => {
                    reload();
                  }}
                  onError={setError}
                />
              )}
            </div>
          ))}
          {products.length === 0 && !creating && <p className="text-sm text-slate-500">Sin productos todavía.</p>}
        </div>
      </div>
    </div>
  );
}

function NewProductForm({ onCancel, onCreated, onError }: { onCancel: () => void; onCreated: () => void; onError: (e: string | null) => void }) {
  const [codigoBarras, setCodigoBarras] = useState("");
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precio, setPrecio] = useState("");
  const [stockInicial, setStockInicial] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    onError(null);
    try {
      await api.createProduct({
        codigoBarras: codigoBarras || null,
        nombre,
        categoria: categoria || null,
        precioCentimos: soles(Number(precio) || 0),
        stockInicial: Number(stockInicial) || 0,
        stockMinimo: Number(stockMinimo) || 0,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "No se pudo crear el producto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg bg-slate-900 p-4">
      <input
        autoFocus
        placeholder="Código de barras (escanear o vacío)"
        value={codigoBarras}
        onChange={(e) => setCodigoBarras(e.target.value)}
        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
      />
      <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
      <input placeholder="Categoría (opcional)" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
      <div className="grid grid-cols-3 gap-2">
        <input type="number" placeholder="Precio S/" value={precio} onChange={(e) => setPrecio(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
        <input type="number" placeholder="Stock inicial" value={stockInicial} onChange={(e) => setStockInicial(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
        <input type="number" placeholder="Stock mínimo" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-lg bg-slate-700 py-2 text-white hover:bg-slate-600">
          Cancelar
        </button>
        <button onClick={submit} disabled={busy || !nombre || !precio} className="flex-1 rounded-lg bg-emerald-600 py-2 text-white hover:bg-emerald-500 disabled:opacity-50">
          Crear
        </button>
      </div>
    </div>
  );
}

function ProductDetail({ product, onChanged, onError }: { product: Product; onChanged: () => void; onError: (e: string | null) => void }) {
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.productMovements(product.id).then(setMovements);
  }, [product.id]);

  const registerIn = async () => {
    setBusy(true);
    onError(null);
    try {
      await api.stockIn(product.id, Number(cantidad) || 0, motivo || "Ingreso de mercadería");
      setCantidad("");
      setMotivo("");
      onChanged();
      setMovements(await api.productMovements(product.id));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "No se pudo registrar el ingreso.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-slate-700 p-3">
      <div className="mb-3 flex items-end gap-2">
        <input type="number" placeholder="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-24 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white" />
        <input placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-white" />
        <button onClick={registerIn} disabled={busy || !cantidad} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">
          + Ingreso
        </button>
      </div>
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Kardex</p>
      <div className="max-h-32 overflow-y-auto text-xs text-slate-400">
        {movements.length === 0 && <p>Sin movimientos.</p>}
        {movements.map((m) => (
          <div key={m.id} className="flex justify-between py-0.5">
            <span>
              {MOVEMENT_LABEL[m.tipo] ?? m.tipo} {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad} {m.motivo ? `· ${m.motivo}` : ""}
            </span>
            <span>{new Date(m.ocurridoEn).toLocaleString("es-PE")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
