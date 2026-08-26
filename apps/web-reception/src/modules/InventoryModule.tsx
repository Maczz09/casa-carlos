import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Product, ProductCategory, ProductMovement, ProductState, Role } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { IconBox, IconChevronDown, IconPlus, IconSearch } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, EmptyState, Field, Input, Notice, PageHeader, Section, Select, Skeleton, StatCard, Textarea, cx } from "../components/ui.js";

const MOVEMENT_LABEL: Record<string, string> = { INGRESO: "Ingreso", SALIDA: "Salida", AJUSTE: "Ajuste", ANULACION: "Anulación" };

interface Props {
  role: Role;
  onManageCategories: () => void;
}

function ProductPicture({ product, className = "h-12 w-12" }: { product: Product; className?: string }) {
  const principal = product.imagenes[0];
  if (principal) return <img src={principal.url} alt={product.nombre} className={cx(className, "shrink-0 rounded-xl object-cover ring-1 ring-line")} />;
  return <span className={cx(className, "grid shrink-0 place-items-center rounded-xl bg-inset text-subtle ring-1 ring-line")} aria-label="Producto sin imagen"><IconBox className="h-5 w-5" /></span>;
}

export function InventoryModule({ role, onManageCategories }: Props) {
  const isAdmin = role === "ADMIN";
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = async () => setProducts(await api.products());

  useEffect(() => {
    void reload();
    if (isAdmin) void api.productCategories().then(setCategories);
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!products || !q) return products ?? [];
    return products.filter((product) => [product.nombre, product.codigoBarras, product.categoria, product.descripcion].some((value) => value?.toLowerCase().includes(q)));
  }, [products, query]);

  if (!isAdmin) return <ReceptionPriceCatalog products={filtered} loading={products === null} query={query} onQuery={setQuery} onReload={reload} />;

  const lowStock = products?.filter((product) => product.stock <= product.stockMinimo).length ?? 0;
  const withoutImage = products?.filter((product) => product.imagenes.length === 0).length ?? 0;

  return (
    <>
      <PageHeader title="Bodega" subtitle="Administración de productos, imágenes, stock y kardex" actions={<><Button size="lg" onClick={onManageCategories}>Categorías</Button>{!creating && <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>Nuevo producto</Button>}</>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Productos" value={products?.length ?? "—"} icon={<IconBox className="h-4 w-4" />} />
        <StatCard label="Bajo stock" value={lowStock} hint="En o debajo del mínimo" tone={lowStock > 0 ? "tone-amber" : "tone-teal"} delay={60} />
        <StatCard label="Sin imagen" value={withoutImage} hint="Pendientes de completar" tone={withoutImage > 0 ? "tone-amber" : "tone-sky"} delay={120} />
      </div>
      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {creating && <div className="mb-5"><NewProductForm categories={categories} onManageCategories={onManageCategories} onCancel={() => setCreating(false)} onCreated={async (id) => { setCreating(false); setExpandedId(id); await reload(); }} onError={setError} /></div>}
      <Section title="Catálogo" subtitle="La primera imagen será la portada que ve el cliente" actions={<SearchBox value={query} onChange={setQuery} />}>
        {products === null ? <div className="flex flex-col gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : filtered.length === 0 ? <EmptyState icon={<IconBox className="h-6 w-6" />} title={query ? "Sin resultados" : "Todavía no hay productos"} hint={query ? "Prueba con otro nombre o código." : "Agrega el primer producto para comenzar."} /> : (
          <div className="flex flex-col gap-2">{filtered.map((product, i) => {
            const open = expandedId === product.id;
            const low = product.stock <= product.stockMinimo;
            return <div key={product.id} className="stagger overflow-hidden rounded-xl border border-line" style={{ ["--i" as string]: i }}>
              <button onClick={() => setExpandedId(open ? null : product.id)} className={cx("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", open ? "bg-inset" : "hover:bg-inset/60")}>
                <ProductPicture product={product} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{product.nombre}</p><p className="truncate text-xs text-subtle">{product.categoria ?? "Sin categoría"} · {product.codigoBarras ?? "sin código"}</p></div>
                <div className="flex shrink-0 items-center gap-3 text-sm"><span className="font-semibold tabular-nums text-ink">{format(cents(product.precioCentimos))}</span><Badge tone={low ? "tone-amber" : "tone-teal"}>stock {product.stock}</Badge>{product.imagenes.length === 0 && <Badge tone="tone-stone">sin imagen</Badge>}<IconChevronDown className={cx("h-4 w-4 text-subtle transition-transform", open && "rotate-180")} /></div>
              </button>
              {open && <AdminProductDetail product={product} categories={categories} onChanged={reload} onError={setError} />}
            </div>;
          })}</div>
        )}
      </Section>
    </>
  );
}

function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="relative"><IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Buscar o escanear código" className="w-64 pl-9" /></div>;
}

function ReceptionPriceCatalog({ products, loading, query, onQuery, onReload }: { products: Product[]; loading: boolean; query: string; onQuery: (value: string) => void; onReload: () => Promise<void> }) {
  return <><PageHeader title="Precios de productos" subtitle="Recepción puede consultar el catálogo y modificar únicamente el precio de venta" /><Section title="Catálogo para recepción" actions={<SearchBox value={query} onChange={onQuery} />}>{loading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : products.length === 0 ? <EmptyState icon={<IconBox className="h-6 w-6" />} title="No hay productos para mostrar" /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{products.map((product) => <ReceptionPriceCard key={product.id} product={product} onReload={onReload} />)}</div>}</Section></>;
}

function ReceptionPriceCard({ product, onReload }: { product: Product; onReload: () => Promise<void> }) {
  const [price, setPrice] = useState((product.precioCentimos / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => setPrice((product.precioCentimos / 100).toFixed(2)), [product.precioCentimos]);
  const save = async () => {
    setBusy(true); setMessage(null);
    try { await api.updateProductPrice(product.id, soles(Number(price) || 0)); setMessage("Precio actualizado"); await onReload(); }
    catch (error) { setMessage(error instanceof ApiError ? error.message : "No se pudo actualizar el precio."); }
    finally { setBusy(false); }
  };
  return <div className="rounded-2xl border border-line bg-raised p-4"><div className="mb-4 flex gap-3"><ProductPicture product={product} className="h-20 w-20" /><div className="min-w-0"><p className="truncate font-semibold text-ink">{product.nombre}</p><p className="text-xs text-muted">{product.categoria ?? "Sin categoría"}</p><Badge tone={product.stock > 0 ? "tone-teal" : "tone-red"} className="mt-2">{product.stock > 0 ? "Disponible" : "Agotado"}</Badge></div></div><div className="flex items-end gap-2"><Field label="Precio de venta (S/)"><Input type="number" min="0" step="0.10" value={price} onChange={(event) => setPrice(event.target.value)} /></Field><Button variant="primary" onClick={save} disabled={busy}>{busy ? "Guardando" : "Guardar"}</Button></div>{message && <p className={cx("mt-2 text-xs", message === "Precio actualizado" ? "text-ok" : "text-danger")}>{message}</p>}</div>;
}

function NewProductForm({ categories, onManageCategories, onCancel, onCreated, onError }: { categories: ProductCategory[]; onManageCategories: () => void; onCancel: () => void; onCreated: (id: string) => Promise<void>; onError: (message: string | null) => void }) {
  const [form, setForm] = useState({ codigoBarras: "", nombre: "", descripcion: "", categoriaId: "", precio: "", costo: "", stockInicial: "", stockMinimo: "" });
  const [busy, setBusy] = useState(false);
  const activeCategories = categories.filter((category) => category.activo);
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value })) });
  const submit = async () => {
    setBusy(true); onError(null);
    try {
      const product = await api.createProduct({ codigoBarras: form.codigoBarras || null, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, categoriaId: form.categoriaId || null, precioCentimos: soles(Number(form.precio) || 0), costoCentimos: soles(Number(form.costo) || 0), stockInicial: Number(form.stockInicial) || 0, stockMinimo: Number(form.stockMinimo) || 0 });
      await onCreated(product.id);
    } catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo crear el producto."); }
    finally { setBusy(false); }
  };
  return <Section title="Nuevo producto" subtitle="Después de crearlo se abrirá su galería para cargar imágenes"><div className="grid gap-4 sm:grid-cols-3"><Field label="Código de barras"><Input autoFocus placeholder="Escanear o dejar vacío" {...field("codigoBarras")} /></Field><Field label="Nombre"><Input placeholder="Nombre del producto" {...field("nombre")} /></Field><Field label="Categoría">{activeCategories.length === 0 ? <Button size="sm" onClick={onManageCategories}>Crear una categoría</Button> : <Select {...field("categoriaId")}><option value="">Sin categoría</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</Select>}</Field><Field label="Precio de venta (S/)"><Input type="number" min="0" step="0.10" {...field("precio")} /></Field><Field label="Costo (S/)"><Input type="number" min="0" step="0.10" {...field("costo")} /></Field><Field label="Stock inicial"><Input type="number" min="0" {...field("stockInicial")} /></Field><Field label="Stock mínimo"><Input type="number" min="0" {...field("stockMinimo")} /></Field><Field label="Descripción"><Textarea rows={2} {...field("descripcion")} /></Field></div><div className="mt-4 flex gap-2"><Button onClick={onCancel}>Cancelar</Button><Button variant="primary" onClick={submit} disabled={busy || !form.nombre.trim() || !form.precio}>{busy ? "Creando" : "Crear producto"}</Button></div></Section>;
}

function AdminProductDetail({ product, categories, onChanged, onError }: { product: Product; categories: ProductCategory[]; onChanged: () => Promise<void>; onError: (message: string | null) => void }) {
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [stock, setStock] = useState({ cantidad: "", motivo: "" });
  const [edit, setEdit] = useState({ nombre: product.nombre, descripcion: product.descripcion ?? "", categoriaId: product.categoriaId ?? "", precio: (product.precioCentimos / 100).toFixed(2), costo: (product.costoCentimos / 100).toFixed(2), stockMinimo: String(product.stockMinimo), estado: product.estado });
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.productMovements(product.id).then(setMovements); }, [product.id]);
  const saveDetails = async () => {
    setBusy(true); onError(null);
    try { await api.updateProduct(product.id, { nombre: edit.nombre.trim(), descripcion: edit.descripcion.trim() || null, categoriaId: edit.categoriaId || null, precioCentimos: soles(Number(edit.precio) || 0), costoCentimos: soles(Number(edit.costo) || 0), stockMinimo: Number(edit.stockMinimo) || 0, estado: edit.estado }); await onChanged(); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo editar el producto."); }
    finally { setBusy(false); }
  };
  const registerStock = async () => {
    setBusy(true); onError(null);
    try { await api.stockIn(product.id, Number(stock.cantidad) || 0, stock.motivo || "Ingreso de mercadería"); setStock({ cantidad: "", motivo: "" }); setMovements(await api.productMovements(product.id)); await onChanged(); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo registrar el ingreso."); }
    finally { setBusy(false); }
  };
  return <div className="animate-fade border-t border-line bg-surface p-4"><div className="grid gap-5 xl:grid-cols-2"><div><p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-subtle">Ficha del producto</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Nombre"><Input value={edit.nombre} onChange={(event) => setEdit({ ...edit, nombre: event.target.value })} /></Field><Field label="Categoría"><Select value={edit.categoriaId} onChange={(event) => setEdit({ ...edit, categoriaId: event.target.value })}><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</Select></Field><Field label="Precio de venta (S/)"><Input type="number" min="0" value={edit.precio} onChange={(event) => setEdit({ ...edit, precio: event.target.value })} /></Field><Field label="Costo (S/)"><Input type="number" min="0" value={edit.costo} onChange={(event) => setEdit({ ...edit, costo: event.target.value })} /></Field><Field label="Stock mínimo"><Input type="number" min="0" value={edit.stockMinimo} onChange={(event) => setEdit({ ...edit, stockMinimo: event.target.value })} /></Field><Field label="Estado"><Select value={edit.estado} onChange={(event) => setEdit({ ...edit, estado: event.target.value as ProductState })}><option value="ACTIVO">Activo</option><option value="AGOTADO">Agotado</option><option value="DESCONTINUADO">Descontinuado</option></Select></Field><Field label="Descripción"><Textarea rows={2} value={edit.descripcion} onChange={(event) => setEdit({ ...edit, descripcion: event.target.value })} /></Field></div><Button className="mt-3" variant="primary" onClick={saveDetails} disabled={busy || !edit.nombre.trim()}>Guardar ficha</Button></div><ProductImagesEditor product={product} onChanged={onChanged} onError={onError} /></div><div className="my-5 border-t border-line-soft" /><div className="mb-4 flex flex-wrap items-end gap-2"><Input type="number" placeholder="Cantidad" value={stock.cantidad} onChange={(event) => setStock({ ...stock, cantidad: event.target.value })} className="w-28" /><Input placeholder="Motivo del ingreso" value={stock.motivo} onChange={(event) => setStock({ ...stock, motivo: event.target.value })} className="min-w-40 flex-1" /><Button variant="primary" onClick={registerStock} disabled={busy || !stock.cantidad} icon={<IconPlus className="h-3.5 w-3.5" />}>Ingreso</Button></div><p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-subtle">Kardex</p>{movements.length === 0 ? <p className="text-sm text-muted">Sin movimientos registrados.</p> : <div className="max-h-44 overflow-y-auto rounded-xl border border-line-soft">{movements.map((movement) => <div key={movement.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2 text-xs last:border-0"><span className="min-w-0 truncate text-muted"><span className="font-medium text-ink">{MOVEMENT_LABEL[movement.tipo] ?? movement.tipo}</span> <span className={movement.cantidad > 0 ? "text-ok" : "text-danger"}>{movement.cantidad > 0 ? `+${movement.cantidad}` : movement.cantidad}</span>{movement.motivo ? ` · ${movement.motivo}` : ""}</span><span className="shrink-0 text-subtle">{new Date(movement.ocurridoEn).toLocaleString("es-PE")}</span></div>)}</div>}</div>;
}

function ProductImagesEditor({ product, onChanged, onError }: { product: Product; onChanged: () => Promise<void>; onError: (message: string | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); onError(null);
    try { await api.uploadProductImage(product.id, file); await onChanged(); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo subir la imagen."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= product.imagenes.length) return;
    const ids = product.imagenes.map((image) => image.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusy(true);
    try { await api.reorderProductImages(product.id, ids); await onChanged(); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo reordenar la galería."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setBusy(true);
    try { await api.deleteProductImage(product.id, id); setConfirmDelete(null); await onChanged(); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo eliminar la imagen."); }
    finally { setBusy(false); }
  };
  return <div><div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Galería</p><p className="text-xs text-muted">JPG, PNG o WebP · máximo 3 MB · {product.imagenes.length}/4</p></div><Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy || product.imagenes.length >= 4}>Agregar imagen</Button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} /></div>{product.imagenes.length === 0 ? <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-line bg-inset text-center"><div><IconBox className="mx-auto h-8 w-8 text-subtle" /><p className="mt-2 text-sm text-muted">Este producto todavía no tiene imagen</p></div></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">{product.imagenes.map((image, index) => <div key={image.id} className="overflow-hidden rounded-xl border border-line bg-raised"><div className="relative aspect-[4/3]"><img src={image.url} alt={`${product.nombre} ${index + 1}`} className="h-full w-full object-cover" />{index === 0 && <Badge tone="tone-teal" className="absolute left-2 top-2">Principal</Badge>}</div><div className="flex gap-1 p-2"><Button size="sm" onClick={() => void move(index, -1)} disabled={busy || index === 0}>←</Button><Button size="sm" onClick={() => void move(index, 1)} disabled={busy || index === product.imagenes.length - 1}>→</Button><Button size="sm" variant={confirmDelete === image.id ? "danger" : "ghost"} onClick={() => void remove(image.id)} disabled={busy}>{confirmDelete === image.id ? "Confirmar" : "Eliminar"}</Button></div></div>)}</div>}</div>;
}
