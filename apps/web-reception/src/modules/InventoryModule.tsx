import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Product, ProductCategory, ProductMovement, ProductState, Role } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { IconBox, IconChevronDown, IconPlus, IconSearch } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, EmptyState, Field, Input, Notice, PageHeader, Section, Select, Skeleton, StatCard, Textarea, cx } from "../components/ui.js";

const MOVEMENT_LABEL: Record<string, string> = { INGRESO: "Ingreso", SALIDA: "Salida", AJUSTE: "Ajuste", ANULACION: "Anulación" };
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
  return <span className={cx(className, "grid shrink-0 place-items-center rounded-xl bg-inset text-subtle ring-1 ring-line")} aria-label="Producto sin imagen"><IconBox className="h-5 w-5" /></span>;
}

export function InventoryModule({ role, onManageCategories }: Props) {
  const isAdmin = role === "ADMIN";
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
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

  if (!isAdmin) return <ReceptionPriceCatalog products={filtered} loading={products === null} query={query} onQuery={setQuery} onReload={reload} />;

  const lowStock = products?.filter((product) => product.stock <= product.stockMinimo).length ?? 0;
  const withoutImage = products?.filter((product) => product.imagenes.length === 0).length ?? 0;

  return (
    <>
      {feedback && <div role="status" aria-live="polite" className="fixed right-5 top-20 z-[100] w-[min(26rem,calc(100vw-2.5rem))] drop-shadow-xl"><Notice kind={feedback.kind}><div className="flex items-start justify-between gap-3"><span>{feedback.message}</span><button type="button" onClick={() => setFeedback(null)} className="shrink-0 rounded px-1 font-semibold opacity-70 hover:opacity-100" aria-label="Cerrar notificación">×</button></div></Notice></div>}
      <PageHeader title="Bodega" subtitle="Administración de productos, imágenes, stock y kardex" actions={<><Button size="lg" onClick={onManageCategories}>Categorías</Button>{!creating && <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>Nuevo producto</Button>}</>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Productos" value={products?.length ?? "—"} icon={<IconBox className="h-4 w-4" />} />
        <StatCard label="Bajo stock" value={lowStock} hint="En o debajo del mínimo" tone={lowStock > 0 ? "tone-amber" : "tone-teal"} delay={60} />
        <StatCard label="Sin imagen" value={withoutImage} hint="Pendientes de completar" tone={withoutImage > 0 ? "tone-amber" : "tone-sky"} delay={120} />
      </div>
      {creating && <div className="mb-5"><NewProductForm categories={categories} onManageCategories={onManageCategories} onCancel={() => setCreating(false)} onCreated={async (id) => { setCreating(false); setExpandedId(id); await reload(); }} onSuccess={(message) => notify("ok", message)} onError={(message) => notify("error", message)} /></div>}
      <Section title="Catálogo" subtitle="La primera imagen será la portada del kiosco. Recomendado: foto horizontal 4:3 o 16:9." actions={<SearchBox value={query} onChange={setQuery} />}>
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
              {open && <AdminProductDetail product={product} categories={categories} onChanged={reload} onSuccess={(message) => notify("ok", message)} onError={(message) => notify("error", message)} />}
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

function NewProductForm({ categories, onManageCategories, onCancel, onCreated, onSuccess, onError }: { categories: ProductCategory[]; onManageCategories: () => void; onCancel: () => void; onCreated: (id: string) => Promise<void>; onSuccess: (message: string) => void; onError: (message: string) => void }) {
  const [form, setForm] = useState({ codigoBarras: "", nombre: "", descripcion: "", categoriaId: "", precio: "", costo: "", stockInicial: "", stockMinimo: "" });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const activeCategories = categories.filter((category) => category.activo);
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value })) });

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
      const product = await api.createProduct({ codigoBarras: form.codigoBarras || null, nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, categoriaId: form.categoriaId || null, precioCentimos: soles(Number(form.precio) || 0), costoCentimos: soles(Number(form.costo) || 0), stockInicial: Number(form.stockInicial) || 0, stockMinimo: Number(form.stockMinimo) || 0 });
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
    } catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo crear el producto."); }
    finally { setBusy(false); }
  };
  return <Section title="Nuevo producto" subtitle="Completa la ficha y, si deseas, guarda de una vez su imagen principal"><div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><div className="grid gap-4 sm:grid-cols-3"><Field label="Código de barras"><Input autoFocus placeholder="Escanear o dejar vacío" {...field("codigoBarras")} /></Field><Field label="Nombre"><Input placeholder="Nombre del producto" {...field("nombre")} /></Field><Field label="Categoría">{activeCategories.length === 0 ? <Button size="sm" onClick={onManageCategories}>Crear una categoría</Button> : <Select {...field("categoriaId")}><option value="">Sin categoría</option>{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</Select>}</Field><Field label="Precio de venta (S/)"><Input type="number" min="0" step="0.10" {...field("precio")} /></Field><Field label="Costo (S/)"><Input type="number" min="0" step="0.10" {...field("costo")} /></Field><Field label="Stock inicial"><Input type="number" min="0" {...field("stockInicial")} /></Field><Field label="Stock mínimo"><Input type="number" min="0" {...field("stockMinimo")} /></Field><Field label="Descripción"><Textarea rows={2} {...field("descripcion")} /></Field></div><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-subtle">Imagen principal (opcional)</p><button type="button" onClick={() => imageInputRef.current?.click()} className="group relative grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-inset text-center transition-colors hover:border-brand"><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])} />{imagePreview ? <img src={imagePreview} alt="Vista previa de la imagen" className="h-full w-full bg-white object-contain p-2" /> : <span className="px-5 text-sm text-muted"><IconBox className="mx-auto mb-2 h-8 w-8 text-subtle" />Seleccionar imagen</span>}</button><p className="mt-2 text-xs leading-relaxed text-muted"><strong className="text-ink">Recomendado:</strong> imagen horizontal 4:3 o 16:9. JPG, PNG o WebP, máximo 3 MB.</p>{image && <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted"><span className="min-w-0 truncate">{image.name}</span><Button size="sm" variant="ghost" onClick={() => { setImage(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}>Quitar</Button></div>}</div></div><div className="mt-4 flex gap-2"><Button onClick={onCancel}>Cancelar</Button><Button variant="primary" onClick={submit} disabled={busy || !form.nombre.trim() || !form.precio}>{busy ? "Guardando…" : image ? "Crear con imagen" : "Crear producto"}</Button></div></Section>;
}

function AdminProductDetail({ product, categories, onChanged, onSuccess, onError }: { product: Product; categories: ProductCategory[]; onChanged: () => Promise<void>; onSuccess: (message: string) => void; onError: (message: string) => void }) {
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [stock, setStock] = useState({ cantidad: "", motivo: "" });
  const [edit, setEdit] = useState({ nombre: product.nombre, descripcion: product.descripcion ?? "", categoriaId: product.categoriaId ?? "", precio: (product.precioCentimos / 100).toFixed(2), costo: (product.costoCentimos / 100).toFixed(2), stockMinimo: String(product.stockMinimo), estado: product.estado });
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.productMovements(product.id).then(setMovements); }, [product.id]);
  const saveDetails = async () => {
    setBusy(true);
    try { await api.updateProduct(product.id, { nombre: edit.nombre.trim(), descripcion: edit.descripcion.trim() || null, categoriaId: edit.categoriaId || null, precioCentimos: soles(Number(edit.precio) || 0), costoCentimos: soles(Number(edit.costo) || 0), stockMinimo: Number(edit.stockMinimo) || 0, estado: edit.estado }); await onChanged(); onSuccess("Ficha del producto guardada correctamente."); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo editar el producto."); }
    finally { setBusy(false); }
  };
  const registerStock = async () => {
    setBusy(true);
    try { await api.stockIn(product.id, Number(stock.cantidad) || 0, stock.motivo || "Ingreso de mercadería"); setStock({ cantidad: "", motivo: "" }); setMovements(await api.productMovements(product.id)); await onChanged(); onSuccess("Ingreso de stock registrado correctamente."); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo registrar el ingreso."); }
    finally { setBusy(false); }
  };
  return <div className="animate-fade border-t border-line bg-surface p-4"><div className="grid gap-5 xl:grid-cols-2"><div><p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-subtle">Ficha del producto</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Nombre"><Input value={edit.nombre} onChange={(event) => setEdit({ ...edit, nombre: event.target.value })} /></Field><Field label="Categoría"><Select value={edit.categoriaId} onChange={(event) => setEdit({ ...edit, categoriaId: event.target.value })}><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}</Select></Field><Field label="Precio de venta (S/)"><Input type="number" min="0" value={edit.precio} onChange={(event) => setEdit({ ...edit, precio: event.target.value })} /></Field><Field label="Costo (S/)"><Input type="number" min="0" value={edit.costo} onChange={(event) => setEdit({ ...edit, costo: event.target.value })} /></Field><Field label="Stock mínimo"><Input type="number" min="0" value={edit.stockMinimo} onChange={(event) => setEdit({ ...edit, stockMinimo: event.target.value })} /></Field><Field label="Estado"><Select value={edit.estado} onChange={(event) => setEdit({ ...edit, estado: event.target.value as ProductState })}><option value="ACTIVO">Activo</option><option value="AGOTADO">Agotado</option><option value="DESCONTINUADO">Descontinuado</option></Select></Field><Field label="Descripción"><Textarea rows={2} value={edit.descripcion} onChange={(event) => setEdit({ ...edit, descripcion: event.target.value })} /></Field></div><Button className="mt-3" variant="primary" onClick={saveDetails} disabled={busy || !edit.nombre.trim()}>Guardar ficha</Button></div><ProductImagesEditor product={product} onChanged={onChanged} onSuccess={onSuccess} onError={onError} /></div><div className="my-5 border-t border-line-soft" /><div className="mb-4 flex flex-wrap items-end gap-2"><Input type="number" placeholder="Cantidad" value={stock.cantidad} onChange={(event) => setStock({ ...stock, cantidad: event.target.value })} className="w-28" /><Input placeholder="Motivo del ingreso" value={stock.motivo} onChange={(event) => setStock({ ...stock, motivo: event.target.value })} className="min-w-40 flex-1" /><Button variant="primary" onClick={registerStock} disabled={busy || !stock.cantidad} icon={<IconPlus className="h-3.5 w-3.5" />}>Ingreso</Button></div><p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-subtle">Kardex</p>{movements.length === 0 ? <p className="text-sm text-muted">Sin movimientos registrados.</p> : <div className="max-h-44 overflow-y-auto rounded-xl border border-line-soft">{movements.map((movement) => <div key={movement.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-3 py-2 text-xs last:border-0"><span className="min-w-0 truncate text-muted"><span className="font-medium text-ink">{MOVEMENT_LABEL[movement.tipo] ?? movement.tipo}</span> <span className={movement.cantidad > 0 ? "text-ok" : "text-danger"}>{movement.cantidad > 0 ? `+${movement.cantidad}` : movement.cantidad}</span>{movement.motivo ? ` · ${movement.motivo}` : ""}</span><span className="shrink-0 text-subtle">{new Date(movement.ocurridoEn).toLocaleString("es-PE")}</span></div>)}</div>}</div>;
}

function ProductImagesEditor({ product, onChanged, onSuccess, onError }: { product: Product; onChanged: () => Promise<void>; onSuccess: (message: string) => void; onError: (message: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const validationError = validateProductImage(file);
    if (validationError) { onError(validationError); if (inputRef.current) inputRef.current.value = ""; return; }
    setBusy(true);
    try { await api.uploadProductImage(product.id, file); await onChanged(); onSuccess("Imagen guardada correctamente. Ya está visible en el kiosco."); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo subir la imagen."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= product.imagenes.length) return;
    const ids = product.imagenes.map((image) => image.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBusy(true);
    try { await api.reorderProductImages(product.id, ids); await onChanged(); onSuccess("Orden de imágenes actualizado correctamente."); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo reordenar la galería."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setBusy(true);
    try { await api.deleteProductImage(product.id, id); setConfirmDelete(null); await onChanged(); onSuccess("Imagen eliminada correctamente."); }
    catch (error) { onError(error instanceof ApiError ? error.message : "No se pudo eliminar la imagen."); }
    finally { setBusy(false); }
  };
  return <div><div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-subtle">Galería</p><p className="text-xs text-muted"><strong className="text-ink">Usa imágenes horizontales 4:3 o 16:9.</strong> JPG, PNG o WebP · máximo 3 MB · {product.imagenes.length}/4</p></div><Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy || product.imagenes.length >= 4}>Agregar imagen</Button><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} /></div>{product.imagenes.length === 0 ? <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-line bg-inset text-center"><div><IconBox className="mx-auto h-8 w-8 text-subtle" /><p className="mt-2 text-sm text-muted">Este producto todavía no tiene imagen</p></div></div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">{product.imagenes.map((image, index) => <div key={image.id} className="overflow-hidden rounded-xl border border-line bg-raised"><div className="relative aspect-[4/3] bg-white"><img src={image.url} alt={`${product.nombre} ${index + 1}`} className="h-full w-full object-contain p-2" />{index === 0 && <Badge tone="tone-teal" className="absolute left-2 top-2">Principal</Badge>}</div><div className="flex gap-1 p-2"><Button size="sm" onClick={() => void move(index, -1)} disabled={busy || index === 0}>←</Button><Button size="sm" onClick={() => void move(index, 1)} disabled={busy || index === product.imagenes.length - 1}>→</Button><Button size="sm" variant={confirmDelete === image.id ? "danger" : "ghost"} onClick={() => void remove(image.id)} disabled={busy}>{confirmDelete === image.id ? "Confirmar" : "Eliminar"}</Button></div></div>)}</div>}</div>;
}
