import { useEffect, useMemo, useState } from "react";
import type { Attribute, Category, Floor, FloorBoard, Room } from "@casacarlos/contracts";
import { IconBed, IconPlus, IconX } from "@casacarlos/ui";
import { RoomIllustration } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Select, Skeleton, Tabs, cx } from "../components/ui.js";

type Tab = "cuartos" | "categorias";

interface Props {
  floors: FloorBoard[];
  /** El tablero y el módulo de venta comparten un `categories` cargado una vez en App — hay que avisarles que se quedó viejo. */
  onCatalogChanged: () => void;
}

export function RoomsModule({ floors: floorBoards, onCatalogChanged }: Props) {
  const [tab, setTab] = useState<Tab>("cuartos");
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [error, setError] = useState<string | null>(null);

  const floors = useMemo<Floor[]>(() => floorBoards.map((fb) => fb.floor), [floorBoards]);

  const reload = async () => {
    const [r, c, a] = await Promise.all([api.allRooms(), api.categories(), api.attributes()]);
    setRooms(r);
    setCategories(c);
    setAttributes(a);
  };

  useEffect(() => {
    reload();
  }, []);

  const afterChange = async () => {
    await reload();
    onCatalogChanged();
  };

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const floorsById = useMemo(() => new Map(floors.map((f) => [f.id, f])), [floors]);

  return (
    <>
      <PageHeader
        title="Cuartos"
        subtitle="Altas, bajas y edición de cuartos y sus categorías — camas y ventiladores se reflejan al instante en el plano"
        actions={<Tabs<Tab> tabs={[{ id: "cuartos", label: "Cuartos" }, { id: "categorias", label: "Categorías" }]} active={tab} onChange={setTab} />}
      />

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {tab === "cuartos" ? (
        <RoomsTab rooms={rooms} categories={categories ?? []} floors={floors} categoriesById={categoriesById} floorsById={floorsById} onError={setError} onChanged={afterChange} />
      ) : (
        <CategoriesTab categories={categories} attributes={attributes} onError={setError} onChanged={afterChange} />
      )}
    </>
  );
}

/* ==================== Tab: Cuartos ==================== */

function RoomsTab({
  rooms,
  categories,
  floors,
  categoriesById,
  floorsById,
  onError,
  onChanged,
}: {
  rooms: Room[] | null;
  categories: Category[];
  floors: Floor[];
  categoriesById: Map<string, Category>;
  floorsById: Map<string, Floor>;
  onError: (e: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activasParaElegir = categories.filter((c) => c.activo);
  const pisosOrdenados = [...floors].sort((a, b) => a.orden - b.orden);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {!creating && (
        <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} className="self-start" onClick={() => setCreating(true)} disabled={activasParaElegir.length === 0}>
          Nuevo cuarto
        </Button>
      )}
      {activasParaElegir.length === 0 && !creating && (
        <p className="text-xs text-muted">Necesitás al menos una categoría activa para poder crear un cuarto — creá una en la pestaña Categorías.</p>
      )}

      {creating && (
        <RoomForm
          floors={pisosOrdenados}
          categories={activasParaElegir}
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={(input) =>
            run(async () => {
              await api.createRoom(input);
              setCreating(false);
            }, "No se pudo crear el cuarto.")
          }
        />
      )}

      <Section title="Cuartos registrados">
        {rooms === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <EmptyState icon={<IconBed className="h-6 w-6" />} title="Todavía no hay cuartos" hint="Creá el primero arriba." />
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((room, i) => {
              const categoria = categoriesById.get(room.categoriaId);
              const piso = floorsById.get(room.pisoId);
              const editing = editingId === room.id;
              const confirming = confirmDeleteId === room.id;
              return (
                <div key={room.id} className={cx("stagger overflow-hidden rounded-xl border border-line", !room.activo && "opacity-55")} style={{ ["--i" as string]: i }}>
                  {editing ? (
                    <div className="p-3">
                      <RoomForm
                        floors={pisosOrdenados}
                        categories={activasParaElegir}
                        initial={room}
                        busy={busy}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(input) =>
                          run(async () => {
                            await api.updateRoom(room.id, input);
                            setEditingId(null);
                          }, "No se pudo editar el cuarto.")
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-inset p-1">
                          <RoomIllustration beds={categoria?.camas ?? 1} fans={categoria?.ventiladores ?? 0} floorFill="var(--room-floor-teal, #F5F1E8)" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">Cuarto {room.numero}</p>
                          <p className="truncate text-xs text-muted">
                            {piso?.nombre ?? "Sin piso"} · {categoria?.nombre ?? "Sin categoría"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {room.fueraDeServicio && <Badge tone="tone-stone">Fuera de servicio</Badge>}
                        {!room.activo && <Badge tone="tone-red">Dado de baja</Badge>}
                        <Button size="sm" onClick={() => setEditingId(room.id)}>
                          Editar
                        </Button>
                        {room.activo ? (
                          <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirmDeleteId(confirming ? null : room.id)}>
                            <IconX className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button size="sm" disabled={busy} onClick={() => run(() => api.updateRoom(room.id, { activo: true }), "No se pudo reactivar el cuarto.")}>
                            Reactivar
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {confirming && (
                    <div className="animate-fade flex flex-wrap items-center justify-between gap-2 border-t border-line-soft bg-inset p-2.5 px-4">
                      <span className="text-xs text-muted">¿Dar de baja el cuarto {room.numero}? Se puede reactivar después.</span>
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
                              await api.deleteRoom(room.id);
                              setConfirmDeleteId(null);
                            }, "No se pudo dar de baja el cuarto.")
                          }
                        >
                          Sí, dar de baja
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
    </div>
  );
}

function RoomForm({
  floors,
  categories,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  floors: Floor[];
  categories: Category[];
  initial?: Room;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { numero: string; pisoId: string; categoriaId: string; descripcion?: string | null; incluye?: string | null }) => void;
}) {
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [pisoId, setPisoId] = useState(initial?.pisoId ?? floors[0]?.id ?? "");
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId ?? categories[0]?.id ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [incluye, setIncluye] = useState(initial?.incluye ?? "");

  const categoria = categories.find((c) => c.id === categoriaId);
  const completo = numero.trim() && pisoId && categoriaId;

  return (
    <Card className="p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número">
            <Input placeholder="201" value={numero} onChange={(e) => setNumero(e.target.value)} />
          </Field>
          <Field label="Piso">
            <Select value={pisoId} onChange={(e) => setPisoId(e.target.value)}>
              {floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoría">
            <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.camas} cama{c.camas > 1 ? "s" : ""}
                  {c.ventiladores > 0 ? ` · ${c.ventiladores} ventilador${c.ventiladores > 1 ? "es" : ""}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Incluye (opcional)">
            <Input placeholder="Toallas, TV…" value={incluye ?? ""} onChange={(e) => setIncluye(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descripción (opcional)">
              <Input placeholder="Notas internas sobre este cuarto" value={descripcion ?? ""} onChange={(e) => setDescripcion(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-1 lg:w-32">
          <div className="h-20 w-full overflow-hidden rounded-lg bg-inset p-1.5">
            <RoomIllustration beds={categoria?.camas ?? 1} fans={categoria?.ventiladores ?? 0} floorFill="var(--room-floor-teal, #F5F1E8)" />
          </div>
          <p className="text-center text-[11px] text-subtle">Vista previa</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={busy || !completo}
          onClick={() => onSubmit({ numero: numero.trim(), pisoId, categoriaId, descripcion: descripcion || null, incluye: incluye || null })}
        >
          {initial ? "Guardar cambios" : "Crear cuarto"}
        </Button>
      </div>
    </Card>
  );
}

/* ==================== Tab: Categorías ==================== */

function CategoriesTab({
  categories,
  attributes,
  onError,
  onChanged,
}: {
  categories: Category[] | null;
  attributes: Attribute[];
  onError: (e: string | null) => void;
  onChanged: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    onError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {!creating && (
        <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} className="self-start" onClick={() => setCreating(true)}>
          Nueva categoría
        </Button>
      )}

      {creating && (
        <CategoryForm
          attributes={attributes}
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={(input) =>
            run(async () => {
              await api.createRoomCategory(input);
              setCreating(false);
            }, "No se pudo crear la categoría.")
          }
        />
      )}

      <Section title="Categorías registradas" subtitle="Camas y ventiladores acá son lo que decide qué se dibuja en cada cuarto">
        {categories === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState icon={<IconBed className="h-6 w-6" />} title="Todavía no hay categorías" hint="Creá la primera arriba." />
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((c, i) => {
              const editing = editingId === c.id;
              const confirming = confirmDeleteId === c.id;
              return (
                <div key={c.id} className={cx("stagger overflow-hidden rounded-xl border border-line", !c.activo && "opacity-55")} style={{ ["--i" as string]: i }}>
                  {editing ? (
                    <div className="p-3">
                      <CategoryForm
                        attributes={attributes}
                        initial={c}
                        busy={busy}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(input) =>
                          run(async () => {
                            await api.updateRoomCategory(c.id, input);
                            setEditingId(null);
                          }, "No se pudo editar la categoría.")
                        }
                      />
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-inset p-1">
                          <RoomIllustration beds={c.camas} fans={c.ventiladores} floorFill="var(--room-floor-teal, #F5F1E8)" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{c.nombre}</p>
                          <p className="truncate text-xs text-muted">
                            {c.camas} cama{c.camas > 1 ? "s" : ""}
                            {c.ventiladores > 0 ? ` · ${c.ventiladores} ventilador${c.ventiladores > 1 ? "es" : ""}` : " · sin ventilador"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!c.activo && <Badge tone="tone-stone">Inactiva</Badge>}
                        <Button size="sm" onClick={() => setEditingId(c.id)}>
                          Editar
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => run(() => api.updateRoomCategory(c.id, { activo: !c.activo }), "No se pudo cambiar el estado.")}>
                          {c.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirmDeleteId(confirming ? null : c.id)}>
                          <IconX className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {confirming && (
                    <div className="animate-fade flex flex-wrap items-center justify-between gap-2 border-t border-line-soft bg-inset p-2.5 px-4">
                      <span className="text-xs text-muted">¿Borrar "{c.nombre}"? Falla si algún cuarto todavía la usa.</span>
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
                              await api.deleteRoomCategory(c.id);
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
    </div>
  );
}

function CategoryForm({
  attributes,
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  attributes: Attribute[];
  initial?: Category;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { nombre: string; descripcion?: string | null; camas: number; ventiladores: number; atributoIds: string[] }) => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [camas, setCamas] = useState(initial?.camas ?? 1);
  const [ventiladores, setVentiladores] = useState(initial?.ventiladores ?? 0);
  const [atributoIds, setAtributoIds] = useState<string[]>(initial?.atributoIds ?? []);
  const [nuevoAtributo, setNuevoAtributo] = useState("");
  const [localAttributes, setLocalAttributes] = useState(attributes);

  const toggleAtributo = (id: string) => setAtributoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const crearAtributo = async () => {
    if (!nuevoAtributo.trim()) return;
    const created = await api.createAttribute(nuevoAtributo.trim());
    setLocalAttributes((prev) => [...prev, created]);
    setAtributoIds((prev) => [...prev, created.id]);
    setNuevoAtributo("");
  };

  return (
    <Card className="p-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <Input placeholder="Matrimonial con ventilador" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
            <Field label="Descripción (opcional)">
              <Input placeholder="Detalle para el huésped" value={descripcion ?? ""} onChange={(e) => setDescripcion(e.target.value)} />
            </Field>
            <Field label="Camas">
              <Input type="number" min={1} value={camas} onChange={(e) => setCamas(Math.max(1, Number(e.target.value) || 1))} />
            </Field>
            <Field label="Ventiladores">
              <Input type="number" min={0} value={ventiladores} onChange={(e) => setVentiladores(Math.max(0, Number(e.target.value) || 0))} />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted">Otros atributos (opcional)</p>
            <div className="flex flex-wrap gap-1.5">
              {localAttributes.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAtributo(a.id)}
                  className={cx(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-95",
                    atributoIds.includes(a.id) ? "tone-teal" : "bg-inset text-subtle hover:text-muted",
                  )}
                >
                  {a.nombre}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Nuevo atributo (TV, balcón…)" value={nuevoAtributo} onChange={(e) => setNuevoAtributo(e.target.value)} className="max-w-56" />
              <Button size="sm" onClick={crearAtributo} disabled={!nuevoAtributo.trim()}>
                Agregar
              </Button>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-1 lg:w-32">
          <div className="h-20 w-full overflow-hidden rounded-lg bg-inset p-1.5">
            <RoomIllustration beds={camas} fans={ventiladores} floorFill="var(--room-floor-teal, #F5F1E8)" />
          </div>
          <p className="text-center text-[11px] text-subtle">Vista previa</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" disabled={busy || !nombre.trim()} onClick={() => onSubmit({ nombre: nombre.trim(), descripcion: descripcion || null, camas, ventiladores, atributoIds })}>
          {initial ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </div>
    </Card>
  );
}
