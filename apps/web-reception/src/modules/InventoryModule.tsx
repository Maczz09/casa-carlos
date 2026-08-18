import { useEffect, useMemo, useState } from "react";
import type { Product, ProductMovement } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { IconBox, IconChevronDown, IconPlus, IconSearch } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Skeleton, StatCard, cx } from "../components/ui.js";

const MOVEMENT_LABEL: Record<string, string> = { INGRESO: "Ingreso", SALIDA: "Salida", AJUSTE: "Ajuste", ANULACION: "Anulación" };

export function InventoryModule() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = () => api.products().then(setProducts);

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!products) return [];
    if (!q) return products;
    return products.filter((p) => p.nombre.toLowerCase().includes(q) || p.codigoBarras?.toLowerCase().includes(q) || p.categoria?.toLowerCase().includes(q));
  }, [products, query]);

  const bajoStock = products?.filter((p) => p.stock <= p.stockMinimo).length ?? 0;
  const valorizado = products?.reduce((sum, p) => sum + p.precioCentimos * Math.max(0, p.stock), 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Bodega"
        subtitle="Productos, stock y kardex de movimientos"
        actions={
          !creating && (
            <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Nuevo producto
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Productos" value={products?.length ?? "—"} icon={<IconBox className="h-4 w-4" />} />
        <StatCard label="Bajo stock" value={bajoStock} hint="En o debajo del mínimo" tone={bajoStock > 0 ? "tone-amber" : "tone-teal"} delay={60} />
        <StatCard label="Valorizado" value={format(cents(valorizado))} hint="Stock × precio de venta" tone="tone-sky" delay={120} />
      </div>

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {creating && (
        <div className="mb-5">
          <NewProductForm
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              reload();
            }}
            onError={setError}
          />
        </div>
      )}

      <Section
        title="Catálogo"
        actions={
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar o escanear código…" className="w-64 pl-9" />
          </div>
        }
      >
        {products === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconBox className="h-6 w-6" />}
            title={query ? "Sin resultados" : "Todavía no hay productos"}
            hint={query ? "Probá con otro nombre o código de barras." : "Agregá el primer producto para empezar a vender desde el cuarto o el kiosco."}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((p, i) => {
              const low = p.stock <= p.stockMinimo;
              const open = expandedId === p.id;
              return (
                <div key={p.id} className="stagger overflow-hidden rounded-xl border border-line" style={{ ["--i" as string]: i }}>
                  <button
                    onClick={() => setExpandedId(open ? null : p.id)}
                    className={cx("flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors", open ? "bg-inset" : "hover:bg-inset/60")}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{p.nombre}</p>
                      <p className="truncate text-xs text-subtle">
                        {p.categoria ?? "Sin categoría"} · {p.codigoBarras ?? "sin código"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                      <span className="font-medium tabular-nums text-ink">{format(cents(p.precioCentimos))}</span>
                      <Badge tone={low ? "tone-amber" : "tone-teal"}>stock {p.stock}</Badge>
                      {p.estado !== "ACTIVO" && <Badge tone="tone-stone">{p.estado}</Badge>}
                      <IconChevronDown className={cx("h-4 w-4 text-subtle transition-transform duration-200", open && "rotate-180")} />
                    </div>
                  </button>
                  {open && <ProductDetail product={p} onChanged={reload} onError={setError} />}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </>
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
    <Section title="Nuevo producto" subtitle="El campo de código de barras acepta el escáner directamente">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Código de barras">
            <Input autoFocus placeholder="Escanear o dejar vacío" value={codigoBarras} onChange={(e) => setCodigoBarras(e.target.value)} />
          </Field>
          <Field label="Nombre">
            <Input placeholder="Nombre del producto" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label="Categoría (opcional)">
            <Input placeholder="Bebidas, snacks…" value={categoria} onChange={(e) => setCategoria(e.target.value)} />
          </Field>
          <Field label="Precio de venta (S/)">
            <Input type="number" placeholder="0.00" value={precio} onChange={(e) => setPrecio(e.target.value)} />
          </Field>
          <Field label="Stock inicial">
            <Input type="number" placeholder="0" value={stockInicial} onChange={(e) => setStockInicial(e.target.value)} />
          </Field>
          <Field label="Stock mínimo">
            <Input type="number" placeholder="0" value={stockMinimo} onChange={(e) => setStockMinimo(e.target.value)} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !nombre || !precio}>
            {busy ? "Creando…" : "Crear producto"}
          </Button>
        </div>
      </div>
    </Section>
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
    <div className="animate-fade border-t border-line bg-surface p-4">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Input type="number" placeholder="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="w-28" />
        <Input placeholder="Motivo del ingreso" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-w-40 flex-1" />
        <Button variant="primary" onClick={registerIn} disabled={busy || !cantidad} icon={<IconPlus className="h-3.5 w-3.5" />}>
          Ingreso
        </Button>
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-subtle">Kardex</p>
      {movements.length === 0 ? (
        <p className="text-sm text-muted">Sin movimientos registrados.</p>
      ) : (
        <div className="max-h-44 overflow-y-auto rounded-xl border border-line-soft">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2 text-xs last:border-0">
              <span className="min-w-0 truncate text-muted">
                <span className="font-medium text-ink">{MOVEMENT_LABEL[m.tipo] ?? m.tipo}</span>{" "}
                <span className={m.cantidad > 0 ? "text-ok" : "text-danger"}>
                  {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                </span>
                {m.motivo ? ` · ${m.motivo}` : ""}
              </span>
              <span className="shrink-0 text-subtle">{new Date(m.ocurridoEn).toLocaleString("es-PE")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
