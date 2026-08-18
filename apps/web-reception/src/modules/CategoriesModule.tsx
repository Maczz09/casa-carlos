import { useEffect, useMemo, useState } from "react";
import type { Product, ProductCategory } from "@casacarlos/contracts";
import { IconBox, IconPlus, IconX } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Skeleton, StatCard, cx } from "../components/ui.js";

export function CategoriesModule() {
  const [categories, setCategories] = useState<ProductCategory[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [cats, prods] = await Promise.all([api.productCategories(), api.products()]);
    setCategories(cats);
    setProducts(prods);
  };

  useEffect(() => {
    reload();
  }, []);

  /** Cuántos productos usa cada categoría — es lo que decide si se puede borrar. */
  const usage = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) if (p.categoriaId) map.set(p.categoriaId, (map.get(p.categoriaId) ?? 0) + 1);
    return map;
  }, [products]);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const crear = () =>
    run(async () => {
      await api.createProductCategory({ nombre, descripcion: descripcion || null });
      setNombre("");
      setDescripcion("");
    }, "No se pudo crear la categoría.");

  const guardarNombre = (id: string) =>
    run(async () => {
      await api.updateProductCategory(id, { nombre: editNombre });
      setEditingId(null);
    }, "No se pudo renombrar la categoría.");

  const sinCategoria = products.filter((p) => !p.categoriaId).length;

  return (
    <>
      <PageHeader title="Categorías" subtitle="Definí una sola vez cada categoría y elegila al crear productos — así no se duplican por tipeo" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Categorías" value={categories?.length ?? "—"} icon={<IconBox className="h-4 w-4" />} />
        <StatCard label="Activas" value={categories?.filter((c) => c.activo).length ?? "—"} tone="tone-teal" delay={60} />
        <StatCard label="Productos sin categoría" value={sinCategoria} tone={sinCategoria > 0 ? "tone-amber" : "tone-teal"} delay={120} />
      </div>

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Categorías registradas">
          {categories === null ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState icon={<IconBox className="h-6 w-6" />} title="Todavía no hay categorías" hint="Creá la primera para poder clasificar los productos de bodega." />
          ) : (
            <div className="flex flex-col gap-2">
              {categories.map((c, i) => {
                const enUso = usage.get(c.id) ?? 0;
                const editing = editingId === c.id;
                const confirming = confirmDeleteId === c.id;
                return (
                  <div key={c.id} className={cx("stagger rounded-xl border border-line p-3 transition-opacity", !c.activo && "opacity-55")} style={{ ["--i" as string]: i }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {editing ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <Input autoFocus value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="min-w-40 flex-1" />
                          <Button size="sm" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                          <Button size="sm" variant="primary" disabled={busy || !editNombre.trim()} onClick={() => guardarNombre(c.id)}>
                            Guardar
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">{c.nombre}</p>
                            <p className="text-xs text-muted">
                              {enUso} producto{enUso === 1 ? "" : "s"}
                              {c.descripcion ? ` · ${c.descripcion}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {!c.activo && <Badge tone="tone-stone">Inactiva</Badge>}
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingId(c.id);
                                setEditNombre(c.nombre);
                                setConfirmDeleteId(null);
                              }}
                            >
                              Renombrar
                            </Button>
                            <Button size="sm" disabled={busy} onClick={() => run(() => api.updateProductCategory(c.id, { activo: !c.activo }), "No se pudo cambiar el estado.")}>
                              {c.activo ? "Desactivar" : "Activar"}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy || enUso > 0}
                              title={enUso > 0 ? "Tiene productos asignados" : "Borrar categoría"}
                              onClick={() => setConfirmDeleteId(confirming ? null : c.id)}
                            >
                              <IconX className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {confirming && (
                      <div className="animate-fade mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-inset p-2.5">
                        <span className="text-xs text-muted">¿Borrar "{c.nombre}"? No se puede deshacer.</span>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => setConfirmDeleteId(null)}>
                            Cancelar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api.deleteProductCategory(c.id);
                                setConfirmDeleteId(null);
                              }, "No se pudo borrar la categoría.")
                            }
                          >
                            Sí, borrar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Nueva categoría" delay={80}>
          <div className="flex flex-col gap-4">
            <Field label="Nombre">
              <Input placeholder="Bebidas, snacks, higiene…" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label="Descripción (opcional)">
              <Input placeholder="Para qué sirve esta categoría" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </Field>
            <Button variant="primary" icon={<IconPlus className="h-4 w-4" />} disabled={busy || !nombre.trim()} onClick={crear}>
              Crear categoría
            </Button>
            <Card className="bg-inset p-3 shadow-none">
              <p className="text-xs text-muted">
                Una categoría con productos asignados no se puede borrar. Si ya no la usás pero querés conservar el historial, desactivala: deja de aparecer al crear
                productos nuevos pero los viejos la siguen mostrando.
              </p>
            </Card>
          </div>
        </Section>
      </div>
    </>
  );
}
