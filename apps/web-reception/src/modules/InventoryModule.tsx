import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Product, ProductCategory, ProductMovement, ProductState, Role } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { IconBox, IconChevronDown, IconPlus, IconSearch } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, EmptyState, Field, Input, Notice, PageHeader, Section, Select, Skeleton, StatCard, Textarea, cx } from "../components/ui.js";

const MOVEMENT_LABEL: Record<string, string> = {
  INGRESO: "Ingreso",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
  ANULACION: "Anulación",
};

const PRODUCT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PRODUCT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

type Feedback = { kind: "error" | "ok"; message: string };

function validateProductImage(file: File): string | null {
  if (!PRODUCT_IMAGE_TYPES.has(file.type)) return "La imagen debe ser JPG, PNG o WebP.";
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) return "La imagen supera el máximo permitido de 3 MB.";
  return null;
}

interface Props {
  role: Role;
  onManageCategories: () => void;
}

function ProductPicture({ product, className = "h-12 w-12" }: { product: Product; className?: string }) {
  const principal = product.imagenes[0];
  if (principal) return <img src={principal.url} alt={product.nombre} className={cx(className, "shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-line")} />;
  return (
    <span className={cx(className, "grid shrink-0 place-items-center rounded-xl bg-inset text-subtle ring-1 ring-line")} aria-label="Producto sin imagen">
      <IconBox className="h-5 w-5" />
    </span>
  );
}

export function InventoryModule({ role, onManageCategories }: Props) {
  const isAdmin = role === "ADMIN";
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const feedbackTimer = useRef<number | null>(null);

  const notify = (kind: Feedback["kind"], message: string) => {
    setFeedback({ kind, message });
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => setFeedback(null), kind === "ok" ? 4500 : 8000);
  };

  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
  }, []);

  const reload = async () => setProducts(await api.products());

  useEffect(() => {
    void reload().catch(() => notify("error", "No se pudo cargar el catálogo de productos."));
    if (isAdmin) void api.productCategories().then(setCategories).catch(() => notify("error", "No se pudieron cargar las categorías."));
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!products || !q) return products ?? [];
    return products.filter((product) => [product.nombre, product.codigoBarras, product.categoria, product.descripcion].some((value) => value?.toLowerCase().includes(q)));
  }, [products, query]);

  const openStockModal = (product?: Product | null) => {
    setStockModalProduct(product ?? null);
    setIsStockModalOpen(true);
  };

  if (!isAdmin) {
    return (
      <>
        {feedback && (
          <div role="status" aria-live="polite" className="fixed right-5 top-20 z-[100] w-[min(26rem,calc(100vw-2.5rem))] drop-shadow-xl">
            <Notice kind={feedback.kind}>
              <div className="flex items-start justify-between gap-3">
                <span>{feedback.message}</span>
                <button type="button" onClick={() => setFeedback(null)} className="shrink-0 rounded px-1 font-semibold opacity-70 hover:opacity-100" aria-label="Cerrar notificación">×</button>
              </div>
            </Notice>
          </div>
        )}
        <ReceptionPriceCatalog
          products={filtered}
          loading={products === null}
          query={query}
          onQuery={setQuery}
          onReload={reload}
          onOpenStock={openStockModal}
        />
        {isStockModalOpen && (
          <StockOperationModal
            initialProduct={stockModalProduct}
            products={products ?? []}
            onClose={() => setIsStockModalOpen(false)}
            onChanged={reload}
            onSuccess={(msg) => notify("ok", msg)}
            onError={(msg) => notify("error", msg)}
          />
        )}
      </>
    );
  }

  const lowStock = products?.filter((product) => product.stock <= product.stockMinimo).length ?? 0;
  const withoutImage = products?.filter((product) => product.imagenes.length === 0).length ?? 0;

  return (
    <>
      {feedback && (
        <div role="status" aria-live="polite" className="fixed right-5 top-20 z-[100] w-[min(26rem,calc(100vw-2.5rem))] drop-shadow-xl">
          <Notice kind={feedback.kind}>
            <div className="flex items-start justify-between gap-3">
              <span>{feedback.message}</span>
              <button type="button" onClick={() => setFeedback(null)} className="shrink-0 rounded px-1 font-semibold opacity-70 hover:opacity-100" aria-label="Cerrar notificación">×</button>
            </div>
          </Notice>
        </div>
      )}

      <PageHeader
        title="Bodega"
        subtitle="Administración de productos, imágenes, entradas de stock y kardex"
        actions={
          <>
            <Button size="lg" onClick={onManageCategories}>Categorías</Button>
            <Button size="lg" icon={<IconPlus className="h-4 w-4" />} onClick={() => openStockModal(filtered[0] ?? null)}>
              + Ingreso de stock
            </Button>
            {!creating && (
              <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>
                Nuevo producto
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Productos" value={products?.length ?? "—"} icon={<IconBox className="h-4 w-4" />} />
        <StatCard label="Bajo stock" value={lowStock} hint="En o debajo del mínimo" tone={lowStock > 0 ? "tone-amber" : "tone-teal"} delay={60} />
        <StatCard label="Sin imagen" value={withoutImage} hint="Pendientes de completar" tone={withoutImage > 0 ? "tone-amber" : "tone-sky"} delay={120} />
      </div>

      {creating && (
        <div className="mb-5">
          <NewProductForm
            categories={categories}
            onManageCategories={onManageCategories}
            onCancel={() => setCreating(false)}
            onCreated={async (id) => { setCreating(false); setExpandedId(id); await reload(); }}
            onSuccess={(message) => notify("ok", message)}
            onError={(message) => notify("error", message)}
          />
        </div>
      )}

      <Section
        title="Catálogo"
        subtitle="Gestiona precios, imágenes, entradas de nuevo stock y kardex de cada producto"
        actions={<SearchBox value={query} onChange={setQuery} />}
      >
        {products === null ? (
          <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<IconBox className="h-6 w-6" />} title={query ? "Sin resultados" : "Todavía no hay productos"} hint={query ? "Prueba con otro nombre o código." : "Agrega el primer producto para comenzar."} />
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((product, i) => {
              const open = expandedId === product.id;
              const low = product.stock <= product.stockMinimo;
              return (
                <div key={product.id} className="stagger overflow-hidden rounded-xl border border-line" style={{ ["--i" as string]: i }}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : product.id)}
                    className={cx("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", open ? "bg-inset" : "hover:bg-inset/60")}
                  >
                    <ProductPicture product={product} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{product.nombre}</p>
                      <p className="truncate text-xs text-subtle">{product.categoria ?? "Sin categoría"} · {product.codigoBarras ?? "sin código"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                      <span className="font-semibold tabular-nums text-ink">{format(cents(product.precioCentimos))}</span>
                      <Badge tone={product.stock === 0 ? "tone-red" : low ? "tone-amber" : "tone-teal"}>
                        stock: {product.stock}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openStockModal(product);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-soft active:scale-95 shadow-sm"
                        title="Registrar nuevo stock o ajuste para este producto"
                      >
                        <IconPlus className="h-3 w-3" />
                        Stock
                      </button>
                      {product.imagenes.length === 0 && <Badge tone="tone-stone">sin imagen</Badge>}
                      <IconChevronDown className={cx("h-4 w-4 text-subtle transition-transform", open && "rotate-180")} />
                    </div>
                  </button>
                  {open && (
                    <AdminProductDetail
                      product={product}
                      categories={categories}
                      onChanged={reload}
                      onOpenStockModal={() => openStockModal(product)}
                      onSuccess={(message) => notify("ok", message)}
                      onError={(message) => notify("error", message)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {isStockModalOpen && (
        <StockOperationModal
          initialProduct={stockModalProduct}
          products={products ?? []}
          onClose={() => setIsStockModalOpen(false)}
          onChanged={reload}
          onSuccess={(msg) => notify("ok", msg)}
          onError={(msg) => notify("error", msg)}
        />
      )}
    </>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Buscar o escanear código" className="w-64 pl-9" />
    </div>
  );
}

/* ---------------- Catálogo para Recepción ---------------- */

function ReceptionPriceCatalog({
  products,
  loading,
  query,
  onQuery,
  onReload,
  onOpenStock,
}: {
  products: Product[];
  loading: boolean;
  query: string;
  onQuery: (value: string) => void;
  onReload: () => Promise<void>;
  onOpenStock: (p?: Product | null) => void;
}) {
  return (
    <>
      <PageHeader
        title="Bodega y Precios"
        subtitle="Recepción puede consultar el catálogo, registrar ingresos de nuevo stock y ajustar precios de venta"
        actions={
          <Button size="lg" variant="primary" icon={<IconPlus className="h-4 w-4" />} onClick={() => onOpenStock(null)}>
            + Ingreso de stock
          </Button>
        }
      />
      <Section title="Catálogo de productos" actions={<SearchBox value={query} onChange={onQuery} />}>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : products.length === 0 ? (
          <EmptyState icon={<IconBox className="h-6 w-6" />} title="No hay productos para mostrar" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <ReceptionPriceCard key={product.id} product={product} onReload={onReload} onOpenStock={() => onOpenStock(product)} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function ReceptionPriceCard({ product, onReload, onOpenStock }: { product: Product; onReload: () => Promise<void>; onOpenStock: () => void }) {
  const [price, setPrice] = useState((product.precioCentimos / 100).toFixed(2));
  const [barcode, setBarcode] = useState(product.codigoBarras ?? "");
  const [editingBarcode, setEditingBarcode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setPrice((product.precioCentimos / 100).toFixed(2));
    setBarcode(product.codigoBarras ?? "");
  }, [product.precioCentimos, product.codigoBarras]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await api.updateProduct(product.id, {
        precioCentimos: soles(Number(price) || 0),
        codigoBarras: barcode.trim() || null,
      });
      setMessage("Guardado correctamente");
      setEditingBarcode(false);
      await onReload();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  };

  const low = product.stock <= product.stockMinimo;

  return (
    <div className="rounded-2xl border border-line bg-raised p-4 flex flex-col justify-between gap-3 shadow-sm">
      <div className="flex gap-3">
        <ProductPicture product={product} className="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{product.nombre}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{product.categoria ?? "Sin categoría"}</span>
            <span>·</span>
            <span className="font-mono text-ink/80">{product.codigoBarras ? `Cód: ${product.codigoBarras}` : "Sin código"}</span>
            <button
              type="button"
              onClick={() => setEditingBarcode(!editingBarcode)}
              className="text-[11px] text-brand hover:underline font-medium ml-1"
            >
              {editingBarcode ? "Cancelar" : product.codigoBarras ? "Cambiar cód." : "+ Código"}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone={product.stock === 0 ? "tone-red" : low ? "tone-amber" : "tone-teal"}>
              Stock: {product.stock}
            </Badge>
            {product.stockMinimo > 0 && <span className="text-[11px] text-subtle">mín: {product.stockMinimo}</span>}
          </div>
        </div>
      </div>

      {editingBarcode && (
        <div className="rounded-xl border border-line bg-surface p-2.5 space-y-1">
          <Field label="Código de barras (escanear o escribir)">
            <Input
              autoFocus
              placeholder="Código de barras"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
            />
          </Field>
        </div>
      )}

      <div className="flex items-end gap-2 pt-2 border-t border-line-soft">
        <Field label="Precio venta (S/)">
          <Input type="number" min="0" step="0.10" value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        <Button variant="secondary" onClick={save} disabled={busy}>
          {busy ? "Guardando" : "Guardar"}
        </Button>
        <Button variant="primary" icon={<IconPlus className="h-3.5 w-3.5" />} onClick={onOpenStock}>
          + Stock
        </Button>
      </div>

      {message && <p className={cx("text-xs", message.includes("correctamente") ? "text-ok" : "text-danger")}>{message}</p>}
    </div>
  );
}

/* ---------------- Formulario Nuevo Producto ---------------- */

function NewProductForm({
  categories,
  onManageCategories,
  onCancel,
  onCreated,
  onSuccess,
  onError,
}: {
  categories: ProductCategory[];
  onManageCategories: () => void;
  onCancel: () => void;
  onCreated: (id: string) => Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState({
    codigoBarras: "",
    nombre: "",
    descripcion: "",
    categoriaId: "",
    precio: "",
    costo: "",
    stockInicial: "10",
    stockMinimo: "3",
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const activeCategories = categories.filter((category) => category.activo);
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  useEffect(() => {
    if (!image) { setImagePreview(null); return; }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const chooseImage = (file: File | undefined) => {
    if (!file) return;
    const validationError = validateProductImage(file);
    if (validationError) {
      onError(validationError);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    setImage(file);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const product = await api.createProduct({
        codigoBarras: form.codigoBarras || null,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        categoriaId: form.categoriaId || null,
        precioCentimos: soles(Number(form.precio) || 0),
        costoCentimos: soles(Number(form.costo) || 0),
        stockInicial: Number(form.stockInicial) || 0,
        stockMinimo: Number(form.stockMinimo) || 0,
      });
      if (image) {
        try {
          await api.uploadProductImage(product.id, image);
        } catch (error) {
          await onCreated(product.id);
          onError(`El producto se creó, pero la imagen no pudo guardarse: ${error instanceof ApiError ? error.message : "inténtalo nuevamente desde su galería."}`);
          return;
        }
      }
      await onCreated(product.id);
      onSuccess(image ? "Producto e imagen guardados correctamente. Ya están disponibles en el kiosco." : "Producto creado correctamente. Puedes agregar su imagen desde la galería.");
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "No se pudo crear el producto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Nuevo producto" subtitle="Completa la ficha y especifica el stock inicial que ingresa">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Código de barras"><Input autoFocus placeholder="Escanear o dejar vacío" {...field("codigoBarras")} /></Field>
          <Field label="Nombre"><Input placeholder="Ej: Gaseosa Inka Kola 500ml" {...field("nombre")} /></Field>
          <Field label="Categoría">
            {activeCategories.length === 0 ? (
              <Button size="sm" onClick={onManageCategories}>Crear una categoría</Button>
            ) : (
              <Select {...field("categoriaId")}>
                <option value="">Sin categoría</option>
                {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Precio de venta (S/)"><Input type="number" min="0" step="0.10" placeholder="0.00" {...field("precio")} /></Field>
          <Field label="Costo compra (S/)"><Input type="number" min="0" step="0.10" placeholder="0.00" {...field("costo")} /></Field>
          <Field label="Stock inicial (unidades)"><Input type="number" min="0" {...field("stockInicial")} /></Field>
          <Field label="Stock mínimo de alerta"><Input type="number" min="0" {...field("stockMinimo")} /></Field>
          <Field label="Descripción"><Textarea rows={2} placeholder="Descripción opcional" {...field("descripcion")} /></Field>
        </div>
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-subtle">Imagen principal (opcional)</p>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="group relative grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-inset text-center transition-colors hover:border-brand"
          >
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])} />
            {imagePreview ? (
              <img src={imagePreview} alt="Vista previa" className="h-full w-full bg-white object-contain p-2" />
            ) : (
              <span className="px-5 text-sm text-muted">
                <IconBox className="mx-auto mb-2 h-8 w-8 text-subtle" />Seleccionar imagen
              </span>
            )}
          </button>
          <p className="mt-2 text-xs leading-relaxed text-muted"><strong className="text-ink">Recomendado:</strong> horizontal 4:3 o 16:9, JPG/PNG/WebP, máx 3 MB.</p>
          {image && (
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
              <span className="min-w-0 truncate">{image.name}</span>
              <Button size="sm" variant="ghost" onClick={() => { setImage(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}>Quitar</Button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={busy || !form.nombre.trim() || !form.precio}>
          {busy ? "Guardando…" : image ? "Crear con imagen" : "Crear producto"}
        </Button>
      </div>
    </Section>
  );
}

/* ---------------- Detalle del Producto (Admin) ---------------- */

function AdminProductDetail({
  product,
  categories,
  onChanged,
  onOpenStockModal,
  onSuccess,
  onError,
}: {
  product: Product;
  categories: ProductCategory[];
  onChanged: () => Promise<void>;
  onOpenStockModal: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [stockQty, setStockQty] = useState("");
  const [stockReason, setStockReason] = useState("Compra de mercadería");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("Conteo físico de inventario");
  const [edit, setEdit] = useState({
    nombre: product.nombre,
    codigoBarras: product.codigoBarras ?? "",
    descripcion: product.descripcion ?? "",
    categoriaId: product.categoriaId ?? "",
    precio: (product.precioCentimos / 100).toFixed(2),
    costo: (product.costoCentimos / 100).toFixed(2),
    stockMinimo: String(product.stockMinimo),
    estado: product.estado,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEdit({
      nombre: product.nombre,
      codigoBarras: product.codigoBarras ?? "",
      descripcion: product.descripcion ?? "",
      categoriaId: product.categoriaId ?? "",
      precio: (product.precioCentimos / 100).toFixed(2),
      costo: (product.costoCentimos / 100).toFixed(2),
      stockMinimo: String(product.stockMinimo),
      estado: product.estado,
    });
  }, [product]);

  useEffect(() => {
    void api.productMovements(product.id).then(setMovements).catch(() => {});
  }, [product.id]);

  const saveDetails = async () => {
    setBusy(true);
    try {
      await api.updateProduct(product.id, {
        nombre: edit.nombre.trim(),
        codigoBarras: edit.codigoBarras.trim() || null,
        descripcion: edit.descripcion.trim() || null,
        categoriaId: edit.categoriaId || null,
        precioCentimos: soles(Number(edit.precio) || 0),
        costoCentimos: soles(Number(edit.costo) || 0),
        stockMinimo: Number(edit.stockMinimo) || 0,
        estado: edit.estado,
      });
      await onChanged();
      onSuccess("Ficha del producto guardada correctamente.");
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "No se pudo editar el producto.");
    } finally {
      setBusy(false);
    }
  };

  const registerStockIn = async () => {
    const qty = Number(stockQty);
    if (!qty || qty <= 0) {
      onError("Indica una cantidad mayor a 0 para el ingreso.");
      return;
    }
    setBusy(true);
    try {
      await api.stockIn(product.id, qty, stockReason.trim() || "Ingreso de mercadería");
      setStockQty("");
      setMovements(await api.productMovements(product.id));
      await onChanged();
      onSuccess(`Ingreso de ${qty} unidad(es) registrado correctamente.`);
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "No se pudo registrar el ingreso.");
    } finally {
      setBusy(false);
    }
  };

  const registerAdjust = async () => {
    const qty = Number(adjustQty);
    if (qty === 0 || isNaN(qty)) {
      onError("Indica una diferencia válida (positiva para sumar o negativa para restar).");
      return;
    }
    setBusy(true);
    try {
      await api.adjustStock(product.id, qty, adjustReason.trim() || "Ajuste de inventario");
      setAdjustQty("");
      setMovements(await api.productMovements(product.id));
      await onChanged();
      onSuccess(`Ajuste de stock (${qty > 0 ? `+${qty}` : qty}) aplicado correctamente.`);
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "No se pudo aplicar el ajuste.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade border-t border-line bg-surface p-5 space-y-6">
      {/* Sección 1: Ficha del producto y Galería */}
      <div className="grid gap-6 xl:grid-cols-2">
        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-subtle">Ficha y Precios</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código de barras">
              <Input
                placeholder="Escanear o ingresar código"
                value={edit.codigoBarras}
                onChange={(event) => setEdit({ ...edit, codigoBarras: event.target.value })}
              />
            </Field>
            <Field label="Nombre"><Input value={edit.nombre} onChange={(event) => setEdit({ ...edit, nombre: event.target.value })} /></Field>
            <Field label="Categoría">
              <Select value={edit.categoriaId} onChange={(event) => setEdit({ ...edit, categoriaId: event.target.value })}>
                <option value="">Sin categoría</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
              </Select>
            </Field>
            <Field label="Precio venta (S/)"><Input type="number" min="0" value={edit.precio} onChange={(event) => setEdit({ ...edit, precio: event.target.value })} /></Field>
            <Field label="Costo compra (S/)"><Input type="number" min="0" value={edit.costo} onChange={(event) => setEdit({ ...edit, costo: event.target.value })} /></Field>
            <Field label="Stock mínimo de alerta"><Input type="number" min="0" value={edit.stockMinimo} onChange={(event) => setEdit({ ...edit, stockMinimo: event.target.value })} /></Field>
            <Field label="Estado en Kiosco">
              <Select value={edit.estado} onChange={(event) => setEdit({ ...edit, estado: event.target.value as ProductState })}>
                <option value="ACTIVO">Activo (Visible)</option>
                <option value="AGOTADO">Agotado</option>
                <option value="DESCONTINUADO">Descontinuado</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Descripción"><Textarea rows={2} value={edit.descripcion} onChange={(event) => setEdit({ ...edit, descripcion: event.target.value })} /></Field>
            </div>
          </div>
          <Button className="mt-3" variant="primary" onClick={saveDetails} disabled={busy || !edit.nombre.trim()}>
            Guardar cambios de ficha
          </Button>
        </div>

        <ProductImagesEditor product={product} onChanged={onChanged} onSuccess={onSuccess} onError={onError} />
      </div>

      {/* Sección 2: GESTIÓN DE STOCK (Ingreso, Ajuste y Kardex) */}
      <div className="rounded-2xl border border-line bg-raised/50 p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft pb-4">
          <div>
            <h4 className="text-base font-bold text-ink">Gestión de Stock y Reabastecimiento</h4>
            <p className="text-xs text-muted">Registra entradas de mercadería nueva o realiza ajustes por conteo físico o mermas</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-line bg-surface px-4 py-2 text-center shadow-sm">
              <span className="text-[10px] font-semibold uppercase text-subtle block">Stock Actual</span>
              <span className={cx("text-2xl font-bold tabular-nums", product.stock <= product.stockMinimo ? "text-amber-500" : "text-brand")}>
                {product.stock}
              </span>
            </div>
            <div className="rounded-xl border border-line bg-surface px-4 py-2 text-center shadow-sm">
              <span className="text-[10px] font-semibold uppercase text-subtle block">Stock Mínimo</span>
              <span className="text-2xl font-bold tabular-nums text-muted">{product.stockMinimo}</span>
            </div>
          </div>
        </div>

        {/* Formularios de Stock: Ingreso rápido y Ajuste */}
        <div className="grid gap-5 md:grid-cols-2">
          {/* Tarjeta de Ingreso de Stock */}
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-sm">+</span>
              <h5 className="text-sm font-semibold text-ink">Registrar Ingreso de Stock</h5>
            </div>
            <p className="text-xs text-muted">Suma unidades por compra o recepción de mercadería:</p>

            <div className="flex flex-wrap gap-1.5">
              {[6, 12, 24, 48].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStockQty(String((Number(stockQty) || 0) + n))}
                  className="rounded-lg border border-line bg-inset px-2.5 py-1 text-xs font-semibold text-ink hover:bg-line active:scale-95"
                >
                  +{n}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <Input
                type="number"
                min="1"
                placeholder="Cantidad"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
              <Input
                placeholder="Motivo (ej: Compra a proveedor)"
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
              />
            </div>

            {Number(stockQty) > 0 && (
              <div className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Stock resultante: {product.stock} + {stockQty} = <strong className="font-bold">{product.stock + Number(stockQty)} unidades</strong>
              </div>
            )}

            <Button
              variant="primary"
              onClick={registerStockIn}
              disabled={busy || !Number(stockQty)}
              icon={<IconPlus className="h-4 w-4" />}
              className="w-full"
            >
              Confirmar Ingreso (+{Number(stockQty) || 0})
            </Button>
          </div>

          {/* Tarjeta de Ajuste / Cuadre Físico */}
          <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 font-bold text-sm">±</span>
              <h5 className="text-sm font-semibold text-ink">Ajuste de Inventario / Mermas</h5>
            </div>
            <p className="text-xs text-muted">Ajusta la diferencia para cuadrar con el conteo físico en bodega:</p>

            <div className="flex flex-wrap gap-1.5">
              {["Conteo físico", "Merma / Dañado", "Vencimiento"].map((mot) => (
                <button
                  key={mot}
                  type="button"
                  onClick={() => setAdjustReason(mot)}
                  className="rounded-lg border border-line bg-inset px-2 py-0.5 text-[11px] text-muted hover:bg-line"
                >
                  {mot}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <Input
                type="number"
                placeholder="Diferencia (ej: -1 o +2)"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
              />
              <Input
                placeholder="Motivo del ajuste"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>

            {adjustQty && !isNaN(Number(adjustQty)) && (
              <div className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                Stock resultante: {product.stock} {Number(adjustQty) >= 0 ? `+ ${adjustQty}` : adjustQty} = <strong className="font-bold">{product.stock + Number(adjustQty)} unidades</strong>
              </div>
            )}

            <Button
              variant="secondary"
              onClick={registerAdjust}
              disabled={busy || !Number(adjustQty)}
              className="w-full"
            >
              Aplicar Ajuste ({adjustQty ? (Number(adjustQty) > 0 ? `+${adjustQty}` : adjustQty) : "±0"})
            </Button>
          </div>
        </div>

        {/* Kardex: Historial de movimientos */}
        <div className="space-y-2 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Historial de Movimientos (Kardex)</p>
          {movements.length === 0 ? (
            <p className="text-xs text-muted">No hay movimientos registrados para este producto.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-xl border border-line-soft bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="bg-inset text-subtle sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Fecha y Hora</th>
                    <th className="py-2 px-3">Tipo</th>
                    <th className="py-2 px-3">Cantidad</th>
                    <th className="py-2 px-3">Stock Resultante</th>
                    <th className="py-2 px-3">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-inset/50">
                      <td className="py-2 px-3 text-subtle">{new Date(m.ocurridoEn).toLocaleString("es-PE")}</td>
                      <td className="py-2 px-3 font-medium">
                        <Badge tone={m.tipo === "INGRESO" ? "tone-teal" : m.tipo === "SALIDA" ? "tone-sky" : m.tipo === "ANULACION" ? "tone-red" : "tone-amber"}>
                          {MOVEMENT_LABEL[m.tipo] ?? m.tipo}
                        </Badge>
                      </td>
                      <td className={cx("py-2 px-3 font-bold tabular-nums", m.cantidad > 0 ? "text-ok" : "text-danger")}>
                        {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                      </td>
                      <td className="py-2 px-3 font-semibold tabular-nums text-ink">{m.stockResultante}</td>
                      <td className="py-2 px-3 text-muted truncate max-w-xs">{m.motivo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Modal Rápido de Operación de Stock ---------------- */

function StockOperationModal({
  initialProduct,
  products,
  onClose,
  onChanged,
  onSuccess,
  onError,
}: {
  initialProduct: Product | null;
  products: Product[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(() => initialProduct?.id ?? products[0]?.id ?? "");
  const [tab, setTab] = useState<"INGRESO" | "AJUSTE">("INGRESO");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("Compra de mercadería");
  const [busy, setBusy] = useState(false);

  const product = products.find((p) => p.id === selectedId) ?? initialProduct;

  const currentStock = product?.stock ?? 0;
  const numQty = Number(qty) || 0;
  const resultingStock = tab === "INGRESO" ? currentStock + numQty : currentStock + numQty;

  const submit = async () => {
    if (!product) return;
    if (tab === "INGRESO" && (!numQty || numQty <= 0)) {
      onError("Indica una cantidad positiva para ingresar.");
      return;
    }
    if (tab === "AJUSTE" && numQty === 0) {
      onError("Indica la diferencia a ajustar.");
      return;
    }

    setBusy(true);
    try {
      if (tab === "INGRESO") {
        await api.stockIn(product.id, numQty, reason.trim() || "Ingreso de mercadería");
        onSuccess(`Ingreso de ${numQty} unidades a "${product.nombre}" registrado correctamente.`);
      } else {
        await api.adjustStock(product.id, numQty, reason.trim() || "Ajuste de inventario");
        onSuccess(`Ajuste de stock en "${product.nombre}" aplicado correctamente.`);
      }
      await onChanged();
      onClose();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "No se pudo actualizar el stock.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-raised px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-ink">
              <IconBox className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-ink">Gestión de Stock</h3>
              <p className="text-xs text-muted">Añadir nuevo stock o ajustar inventario físico</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-subtle hover:bg-inset hover:text-ink">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Selección de producto */}
          <div>
            <label className="text-xs font-semibold text-muted block mb-1">Producto</label>
            <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} (Stock actual: {p.stock})
                </option>
              ))}
            </Select>
          </div>

          {/* Tarjeta de estado actual del producto */}
          {product && (
            <div className="flex items-center justify-between rounded-xl bg-inset p-3 border border-line-soft">
              <div className="flex items-center gap-3">
                <ProductPicture product={product} className="h-10 w-10" />
                <div>
                  <p className="text-sm font-semibold text-ink">{product.nombre}</p>
                  <p className="text-xs text-muted">{product.categoria ?? "Sin categoría"}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-semibold uppercase text-subtle block">Stock actual</span>
                <span className="text-xl font-bold tabular-nums text-brand">{product.stock}</span>
              </div>
            </div>
          )}

          {/* Selector de modo: Ingreso o Ajuste */}
          <div className="flex rounded-xl bg-inset p-1 border border-line-soft">
            <button
              type="button"
              onClick={() => { setTab("INGRESO"); setReason("Compra de mercadería"); setQty(""); }}
              className={cx("flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all", tab === "INGRESO" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
            >
              + Ingreso / Reabastecimiento
            </button>
            <button
              type="button"
              onClick={() => { setTab("AJUSTE"); setReason("Conteo físico de inventario"); setQty(""); }}
              className={cx("flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all", tab === "AJUSTE" ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}
            >
              ± Ajuste de Inventario
            </button>
          </div>

          {/* Botones de incremento rápido para Ingreso */}
          {tab === "INGRESO" && (
            <div>
              <span className="text-xs text-muted block mb-1.5">Atajos rápidos de cantidad:</span>
              <div className="flex flex-wrap gap-2">
                {[6, 12, 24, 48, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQty(String((Number(qty) || 0) + n))}
                    className="rounded-lg border border-line bg-surface px-3 py-1 text-xs font-bold text-ink hover:bg-inset active:scale-95"
                  >
                    +{n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQty("")}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  Limpiar
                </button>
              </div>
            </div>
          )}

          {/* Campos de cantidad y motivo */}
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <Field label={tab === "INGRESO" ? "Cantidad a sumar" : "Diferencia (±)"}>
              <Input
                type="number"
                min={tab === "INGRESO" ? "1" : undefined}
                placeholder={tab === "INGRESO" ? "Ej: 24" : "Ej: -2 o +3"}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Motivo de la operación">
              <Input
                placeholder="Motivo del movimiento"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </div>

          {/* Sugerencias de motivo */}
          <div className="flex flex-wrap gap-1.5">
            {(tab === "INGRESO"
              ? ["Compra a distribuidor", "Reposición de mercadería", "Carga inicial de stock"]
              : ["Conteo físico de inventario", "Merma / Botella rota", "Producto vencido", "Diferencia de inventario"]
            ).map((sug) => (
              <button
                key={sug}
                type="button"
                onClick={() => setReason(sug)}
                className="rounded-md border border-line bg-inset/50 px-2 py-0.5 text-[11px] text-muted hover:bg-line hover:text-ink"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Preview del stock resultante */}
          {product && numQty !== 0 && (
            <div className={cx("rounded-xl p-3 text-xs font-medium border", tab === "INGRESO" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-200" : "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-200")}>
              <div className="flex items-center justify-between">
                <span>Stock actual: <strong>{currentStock}</strong></span>
                <span>Operación: <strong>{tab === "INGRESO" ? `+${numQty}` : (numQty > 0 ? `+${numQty}` : numQty)}</strong></span>
                <span>Nuevo Stock: <strong className="text-base">{resultingStock}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3">
          <Button onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !numQty}>
            {busy ? "Guardando…" : tab === "INGRESO" ? `Confirmar Ingreso (+${numQty || 0})` : "Aplicar Ajuste"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Galería de Imágenes ---------------- */

function ProductImagesEditor({
  product,
  onChanged,
  onSuccess,
  onError,
}: {
  product: Product;
  onChanged: () => Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const validationError = validateProductImage(file);
    if (validationError) {
      onError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      await api.uploadProductImage(product.id, file);
      await onChanged();
      onSuccess("Imagen guardada correctamente. Ya está visible en el kiosco.");
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= product.imagenes.length) return;
    const ids = product.imagenes.map((image) => image.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusy(true);
    try {
      await api.reorderProductImages(product.id, ids);
      await onChanged();
      onSuccess("Orden de imágenes actualizado correctamente.");
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "No se pudo reordenar la galería.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    setBusy(true);
    try {
      await api.deleteProductImage(product.id, id);
      setConfirmDelete(null);
      await onChanged();
      onSuccess("Imagen eliminada correctamente.");
    } catch (error) {
      onError(error instanceof ApiError ? error.message : "No se pudo eliminar la imagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Galería</p>
          <p className="text-xs text-muted"><strong className="text-ink">Usa imágenes horizontales 4:3 o 16:9.</strong> JPG, PNG o WebP · máx 3 MB · {product.imagenes.length}/4</p>
        </div>
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy || product.imagenes.length >= 4}>
          Agregar imagen
        </Button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
      </div>

      {product.imagenes.length === 0 ? (
        <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-line bg-inset text-center">
          <div>
            <IconBox className="mx-auto h-8 w-8 text-subtle" />
            <p className="mt-2 text-sm text-muted">Este producto todavía no tiene imagen</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
          {product.imagenes.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-xl border border-line bg-raised">
              <div className="relative aspect-[4/3] bg-white">
                <img src={image.url} alt={`${product.nombre} ${index + 1}`} className="h-full w-full object-contain p-2" />
                {index === 0 && <Badge tone="tone-teal" className="absolute left-2 top-2">Principal</Badge>}
              </div>
              <div className="flex gap-1 p-2">
                <Button size="sm" onClick={() => void move(index, -1)} disabled={busy || index === 0}>←</Button>
                <Button size="sm" onClick={() => void move(index, 1)} disabled={busy || index === product.imagenes.length - 1}>→</Button>
                <Button size="sm" variant={confirmDelete === image.id ? "danger" : "ghost"} onClick={() => void remove(image.id)} disabled={busy}>
                  {confirmDelete === image.id ? "Confirmar" : "Eliminar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
