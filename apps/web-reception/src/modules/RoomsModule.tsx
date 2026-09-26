import { useEffect, useMemo, useState } from "react";
import type { Attribute, Category, CategoryRatesDto, Floor, FloorBoard, Modality, Room } from "@casacarlos/contracts";
import { formatTime12h } from "@casacarlos/contracts";
import { cents, format, soles } from "@casacarlos/money";
import { IconBed, IconPlus, IconX } from "@casacarlos/ui";
import { RoomIllustration } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Select, Skeleton, Tabs, cx } from "../components/ui.js";

type Tab = "cuartos" | "categorias" | "tarifas";

interface Props {
  floors: FloorBoard[];
  /** El tablero y el módulo de venta comparten un `categories` cargado una vez en App — hay que avisarles que se quedó viejo. */
  onCatalogChanged: () => void;
}

export function RoomsModule({ floors: floorBoards, onCatalogChanged }: Props) {
  const [tab, setTab] = useState<Tab>("cuartos");
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [rates, setRates] = useState<Record<string, CategoryRatesDto>>({});
  const [modalities, setModalities] = useState<Modality[] | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const floors = useMemo<Floor[]>(() => floorBoards.map((fb) => fb.floor), [floorBoards]);

  const reload = async () => {
    const [r, c, a, rt, m] = await Promise.all([
      api.allRooms(),
      api.categories(),
      api.attributes(),
      api.categoryRates().catch(() => ({} as Record<string, CategoryRatesDto>)),
      api.modalities().catch(() => [] as Modality[]),
    ]);
    setRooms(r);
    setCategories(c);
    setAttributes(a);
    setRates(rt);
    setModalities(m);
  };

  useEffect(() => {
    void reload();
  }, []);

  const afterChange = async () => {
    await reload();
    onCatalogChanged();
  };

  const handleSaveRates = async (
    categoriaId: string,
    input: { precioHorasCentimos: number; precioNocheCentimos: number; precioNocheBCentimos?: number }
  ) => {
    setError(null);
    setSuccess(null);
    try {
      await api.setCategoryRates(categoriaId, input);
      await reload();
      onCatalogChanged();
      setSuccess("Tarifas actualizadas correctamente. El kiosco y mostrador ya reflejan los nuevos precios.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron guardar las tarifas.");
    }
  };

  const handleSaveModality = async (
    id: string,
    patch: { nombre?: string; checkinFijo?: string | null; checkoutFijo?: string | null; duracionHoras?: number; toleranciaMin?: number }
  ) => {
    setError(null);
    setSuccess(null);
    try {
      await api.updateModality(id, patch);
      await reload();
      onCatalogChanged();
      setSuccess("Horarios del tipo de alquiler actualizados correctamente.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el tipo de alquiler.");
    }
  };

  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const floorsById = useMemo(() => new Map(floors.map((f) => [f.id, f])), [floors]);

  return (
    <>
      <PageHeader
        title="Cuartos y Tarifas"
        subtitle="Gestión de habitaciones, categorías y tarifas por horas, noche o día para el kiosco y mostrador"
        actions={
          <Tabs<Tab>
            tabs={[
              { id: "cuartos", label: "Cuartos" },
              { id: "categorias", label: "Categorías" },
              { id: "tarifas", label: "Tarifas y Precios (Horas / Noche / Día)" },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      {success && (
        <div className="mb-4">
          <Notice kind="ok">{success}</Notice>
        </div>
      )}

      {tab === "cuartos" ? (
        <RoomsTab
          rooms={rooms}
          categories={categories ?? []}
          floors={floors}
          rates={rates}
          categoriesById={categoriesById}
          floorsById={floorsById}
          onGoToTarifas={() => setTab("tarifas")}
          onError={setError}
          onChanged={afterChange}
        />
      ) : tab === "categorias" ? (
        <CategoriesTab
          categories={categories}
          rates={rates}
          attributes={attributes}
          onSaveRates={handleSaveRates}
          onGoToTarifas={() => setTab("tarifas")}
          onError={setError}
          onChanged={afterChange}
        />
      ) : (
        <TarifasTab
          categories={categories}
          rates={rates}
          modalities={modalities}
          onSaveRates={handleSaveRates}
          onSaveModality={handleSaveModality}
          onError={setError}
        />
      )}
    </>
  );
}

/* ==================== Tab: Cuartos ==================== */

function RoomsTab({
  rooms,
  categories,
  floors,
  rates,
  categoriesById,
  floorsById,
  onGoToTarifas,
  onError,
  onChanged,
}: {
  rooms: Room[] | null;
  categories: Category[];
  floors: Floor[];
  rates: Record<string, CategoryRatesDto>;
  categoriesById: Map<string, Category>;
  floorsById: Map<string, Floor>;
  onGoToTarifas: () => void;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!creating && (
          <Button
            variant="primary"
            size="lg"
            icon={<IconPlus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
            disabled={activasParaElegir.length === 0}
          >
            Nuevo cuarto
          </Button>
        )}
        <Button size="lg" onClick={onGoToTarifas}>
          Ver y ajustar tarifas (Horas / Noche / Día)
        </Button>
      </div>

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

      <Section title="Cuartos registrados" subtitle="Piso, categoría asignada y tarifas activas">
        {rooms === null ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <EmptyState icon={<IconBed className="h-6 w-6" />} title="Todavía no hay cuartos" hint="Creá el primer cuarto arriba." />
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((room, i) => {
              const categoria = categoriesById.get(room.categoriaId);
              const piso = floorsById.get(room.pisoId);
              const editing = editingId === room.id;
              const confirming = confirmDeleteId === room.id;
              const roomRate = categoria ? rates[categoria.id] : null;

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
                          <p className="truncate text-sm font-bold text-ink">Cuarto {room.numero}</p>
                          <p className="truncate text-xs text-muted">
                            {piso?.nombre ?? "Sin piso"} · {categoria?.nombre ?? "Sin categoría"}
                          </p>
                          {roomRate ? (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                              <span className="rounded-md bg-brand/10 px-2 py-0.5 font-semibold text-brand">
                                3h: {format(cents(roomRate.precioHorasCentimos))}
                              </span>
                              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                                Noche: {format(cents(roomRate.precioNocheCentimos))}
                              </span>
                              {roomRate.precioNocheBCentimos && (
                                <span className="rounded-md bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-600 dark:text-sky-400">
                                  Día / Noche B: {format(cents(roomRate.precioNocheBCentimos))}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-500 mt-1 font-medium">⚠️ Sin tarifa asignada</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {room.fueraDeServicio && <Badge tone="tone-stone">Fuera de servicio</Badge>}
                        {!room.activo && <Badge tone="tone-red">Dado de baja</Badge>}
                        <Button size="sm" onClick={onGoToTarifas} title="Ajustar precios">
                          💵 Precios
                        </Button>
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
  rates,
  attributes,
  onSaveRates,
  onGoToTarifas,
  onError,
  onChanged,
}: {
  categories: Category[] | null;
  rates: Record<string, CategoryRatesDto>;
  attributes: Attribute[];
  onSaveRates: (catId: string, r: { precioHorasCentimos: number; precioNocheCentimos: number; precioNocheBCentimos?: number }) => Promise<void>;
  onGoToTarifas: () => void;
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!creating && (
          <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Nueva categoría
          </Button>
        )}
        <Button size="lg" onClick={onGoToTarifas}>
          Ver y ajustar tarifas (Horas / Noche / Día)
        </Button>
      </div>

      {creating && (
        <CategoryForm
          attributes={attributes}
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={(input) =>
            run(async () => {
              const created = await api.createRoomCategory({
                nombre: input.nombre,
                descripcion: input.descripcion,
                camas: input.camas,
                ventiladores: input.ventiladores,
                atributoIds: input.atributoIds,
              });
              // Guarda de inmediato las tarifas ingresadas para esta categoría
              await onSaveRates(created.id, {
                precioHorasCentimos: soles(input.precioHoras),
                precioNocheCentimos: soles(input.precioNoche),
                precioNocheBCentimos: soles(input.precioNocheB || input.precioNoche),
              });
              setCreating(false);
            }, "No se pudo crear la categoría.")
          }
        />
      )}

      <Section title="Categorías registradas" subtitle="Camas, ventiladores y tarifas asociadas por cada modalidad">
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
              const catRate = rates[c.id];

              return (
                <div key={c.id} className={cx("stagger overflow-hidden rounded-xl border border-line", !c.activo && "opacity-55")} style={{ ["--i" as string]: i }}>
                  {editing ? (
                    <div className="p-3">
                      <CategoryForm
                        attributes={attributes}
                        initial={c}
                        initialRates={catRate}
                        busy={busy}
                        onCancel={() => setEditingId(null)}
                        onSubmit={(input) =>
                          run(async () => {
                            await api.updateRoomCategory(c.id, {
                              nombre: input.nombre,
                              descripcion: input.descripcion,
                              camas: input.camas,
                              ventiladores: input.ventiladores,
                              atributoIds: input.atributoIds,
                            });
                            await onSaveRates(c.id, {
                              precioHorasCentimos: soles(input.precioHoras),
                              precioNocheCentimos: soles(input.precioNoche),
                              precioNocheBCentimos: soles(input.precioNocheB || input.precioNoche),
                            });
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
                          <p className="truncate text-sm font-bold text-ink">{c.nombre}</p>
                          <p className="truncate text-xs text-muted">
                            {c.camas} cama{c.camas > 1 ? "s" : ""}
                            {c.ventiladores > 0 ? ` · ${c.ventiladores} ventilador${c.ventiladores > 1 ? "es" : ""}` : " · sin ventilador"}
                          </p>
                          {catRate ? (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                              <span className="rounded-md bg-brand/10 px-2 py-0.5 font-semibold text-brand">
                                Por horas (3h): {format(cents(catRate.precioHorasCentimos))}
                              </span>
                              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-600 dark:text-amber-400">
                                Por noche: {format(cents(catRate.precioNocheCentimos))}
                              </span>
                              {catRate.precioNocheBCentimos && (
                                <span className="rounded-md bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-600 dark:text-sky-400">
                                  Día / Noche B: {format(cents(catRate.precioNocheBCentimos))}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-amber-500 mt-1 font-medium">⚠️ Sin tarifas configuradas</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!c.activo && <Badge tone="tone-stone">Inactiva</Badge>}
                        <Button size="sm" onClick={onGoToTarifas}>
                          💵 Modificar precios
                        </Button>
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
  initialRates,
  busy,
  onCancel,
  onSubmit,
}: {
  attributes: Attribute[];
  initial?: Category;
  initialRates?: CategoryRatesDto;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    nombre: string;
    descripcion?: string | null;
    camas: number;
    ventiladores: number;
    atributoIds: string[];
    precioHoras: number;
    precioNoche: number;
    precioNocheB?: number;
  }) => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [camas, setCamas] = useState(initial?.camas ?? 1);
  const [ventiladores, setVentiladores] = useState(initial?.ventiladores ?? 0);
  const [atributoIds, setAtributoIds] = useState<string[]>(initial?.atributoIds ?? []);
  const [nuevoAtributo, setNuevoAtributo] = useState("");
  const [localAttributes, setLocalAttributes] = useState(attributes);

  // Precios configurables directamente en la creación y edición
  const [precioHoras, setPrecioHoras] = useState(
    initialRates ? (initialRates.precioHorasCentimos / 100).toFixed(2) : "40.00"
  );
  const [precioNoche, setPrecioNoche] = useState(
    initialRates ? (initialRates.precioNocheCentimos / 100).toFixed(2) : "60.00"
  );
  const [precioNocheB, setPrecioNocheB] = useState(
    initialRates?.precioNocheBCentimos ? (initialRates.precioNocheBCentimos / 100).toFixed(2) : "50.00"
  );

  const toggleAtributo = (id: string) => setAtributoIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const crearAtributo = async () => {
    if (!nuevoAtributo.trim()) return;
    const created = await api.createAttribute(nuevoAtributo.trim());
    setLocalAttributes((prev) => [...prev, created]);
    setAtributoIds((prev) => [...prev, created.id]);
    setNuevoAtributo("");
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la categoría">
              <Input placeholder="Ej: Matrimonial VIP" value={nombre} onChange={(e) => setNombre(e.target.value)} />
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

          {/* Configuración de precios de la categoría */}
          <div className="rounded-xl border border-line bg-raised/50 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink">Tarifas y Precios de Venta (S/)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Precio por Horas (3h)">
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="40.00"
                  value={precioHoras}
                  onChange={(e) => setPrecioHoras(e.target.value)}
                />
              </Field>
              <Field label="Precio Noche (Check-in 19:00)">
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="60.00"
                  value={precioNoche}
                  onChange={(e) => setPrecioNoche(e.target.value)}
                />
              </Field>
              <Field label="Precio Día / Noche tardía">
                <Input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="50.00"
                  value={precioNocheB}
                  onChange={(e) => setPrecioNocheB(e.target.value)}
                />
              </Field>
            </div>
            <p className="text-[11px] text-muted">
              Estos precios se aplican al crear cuartos de este tipo y se muestran de inmediato en la pantalla del cliente (kiosco).
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted">Otros atributos (opcional)</p>
            <div className="flex flex-wrap gap-1.5">
              {localAttributes.map((a) => (
                <button
                  key={a.id}
                  type="button"
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

      <div className="mt-4 flex gap-2 border-t border-line-soft pt-3">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={busy || !nombre.trim()}
          onClick={() =>
            onSubmit({
              nombre: nombre.trim(),
              descripcion: descripcion || null,
              camas,
              ventiladores,
              atributoIds,
              precioHoras: Number(precioHoras) || 40,
              precioNoche: Number(precioNoche) || 60,
              precioNocheB: Number(precioNocheB) || 50,
            })
          }
        >
          {initial ? "Guardar cambios y tarifas" : "Crear categoría con tarifas"}
        </Button>
      </div>
    </Card>
  );
}

/* ==================== Tab: Tarifas y Precios ==================== */

function TarifasTab({
  categories,
  rates,
  modalities,
  onSaveRates,
  onSaveModality,
  onError,
}: {
  categories: Category[] | null;
  rates: Record<string, CategoryRatesDto>;
  modalities: Modality[] | null;
  onSaveRates: (catId: string, r: { precioHorasCentimos: number; precioNocheCentimos: number; precioNocheBCentimos?: number }) => Promise<void>;
  onSaveModality: (id: string, patch: { nombre?: string; checkinFijo?: string | null; checkoutFijo?: string | null; duracionHoras?: number; toleranciaMin?: number }) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Sección 1: Horarios por tipo de alquiler (Por Día, Por Noche, Por Horas) */}
      <Section
        title="Horarios por Tipo de Alquiler (Por Día, Por Noche, Por Horas)"
        subtitle="Modifica desde qué hora empieza (check-in) y a qué hora termina (check-out) cada modalidad. Los horarios se muestran en formato de 12 horas con AM/PM para mayor claridad."
      >
        <div className="mb-4 rounded-xl bg-brand/5 p-3.5 border border-brand/20 text-xs text-brand leading-relaxed flex items-start gap-2">
          <span className="text-base select-none">🕒</span>
          <div>
            <strong>Horarios de Check-in y Check-out:</strong> Define a qué hora empieza y a qué hora termina el alquiler por día o noche, y cuántas horas dura el alquiler por horas. Estos horarios rigen para las estadías en recepción y en el kiosco.
          </div>
        </div>

        {modalities === null ? (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : modalities.length === 0 ? (
          <EmptyState icon={<IconBed className="h-6 w-6" />} title="No hay modalidades registradas" hint="Las modalidades se cargan por defecto en el sistema." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {modalities.map((m) => (
              <ModalityScheduleCard
                key={m.id}
                modality={m}
                onSave={(patch) => onSaveModality(m.id, patch)}
                onError={onError}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Sección 2: Tarifas y precios por categoría */}
      <Section
        title="Tarifas por Tipo de Habitación"
        subtitle="Configura y modifica los precios por horas, por noche y por día para cada categoría. Los precios se sincronizan en vivo con la pantalla de recepción y con el kiosco."
      >
        <div className="mb-4 rounded-xl bg-brand/5 p-3 border border-brand/20 text-xs text-brand leading-relaxed">
          <strong>💡 Regla de cobro:</strong> Los cuartos obtienen su precio automáticamente según la categoría asignada. Modificar el precio aquí actualiza de inmediato todas las habitaciones de ese tipo.
        </div>

        {categories === null ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState icon={<IconBed className="h-6 w-6" />} title="No hay categorías" hint="Crea primero una categoría para asignarle tarifas." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {categories.map((c) => (
              <CategoryRateEditor
                key={c.id}
                category={c}
                modalities={modalities}
                initialRate={rates[c.id]}
                onSave={(r) => onSaveRates(c.id, r)}
                onError={onError}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function ModalityScheduleCard({
  modality,
  onSave,
  onError,
}: {
  modality: Modality;
  onSave: (patch: { nombre?: string; checkinFijo?: string | null; checkoutFijo?: string | null; duracionHoras?: number; toleranciaMin?: number }) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [nombre, setNombre] = useState(modality.nombre);
  const [checkinFijo, setCheckinFijo] = useState(modality.checkinFijo ?? "");
  const [checkoutFijo, setCheckoutFijo] = useState(modality.checkoutFijo ?? "");
  const [duracionHoras, setDuracionHoras] = useState(String(modality.duracionHoras));
  const [toleranciaMin, setToleranciaMin] = useState(String(modality.toleranciaMin));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNombre(modality.nombre);
    setCheckinFijo(modality.checkinFijo ?? "");
    setCheckoutFijo(modality.checkoutFijo ?? "");
    setDuracionHoras(String(modality.duracionHoras));
    setToleranciaMin(String(modality.toleranciaMin));
  }, [modality]);

  const handleSave = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await onSave({
        nombre: nombre.trim() || modality.nombre,
        checkinFijo: checkinFijo.trim() ? checkinFijo.trim() : null,
        checkoutFijo: checkoutFijo.trim() ? checkoutFijo.trim() : null,
        duracionHoras: Number(duracionHoras) || modality.duracionHoras,
        toleranciaMin: Number(toleranciaMin) || modality.toleranciaMin,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      onError("No se pudo guardar el horario de la modalidad.");
    } finally {
      setBusy(false);
    }
  };

  const isHours = modality.codigo === "HORAS_3";
  const isDia = modality.codigo === "NOCHE_A";
  const isNoche = modality.codigo === "NOCHE_B";

  const badgeTone = isDia ? "tone-sky" : isNoche ? "tone-amber" : "tone-teal";
  const typeLabel = isDia ? "Por Día / Noche A" : isNoche ? "Por Noche / Noche B" : "Por Horas";

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between gap-4 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge tone={badgeTone} className="font-semibold text-xs px-2.5 py-0.5">
            {typeLabel}
          </Badge>
          <span className="text-[11px] font-mono text-muted">{modality.codigo}</span>
        </div>

        <Field label="Nombre descriptivo">
          <Input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="text-sm font-medium"
            placeholder="Ej. Por Día (check-in 14:00 - 10:00)"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line-soft">
        {!isHours ? (
          <>
            <div>
              <Field label="Empieza a las (Check-in)">
                <Input
                  type="time"
                  value={checkinFijo}
                  onChange={(e) => setCheckinFijo(e.target.value)}
                  className="font-mono text-sm font-semibold"
                />
              </Field>
              {checkinFijo && (
                <div className="mt-1 text-[11px] font-bold text-brand">
                  {formatTime12h(checkinFijo)}
                </div>
              )}
            </div>

            <div>
              <Field label="Termina a las (Check-out)">
                <Input
                  type="time"
                  value={checkoutFijo}
                  onChange={(e) => setCheckoutFijo(e.target.value)}
                  className="font-mono text-sm font-semibold"
                />
              </Field>
              {checkoutFijo && (
                <div className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  {formatTime12h(checkoutFijo)}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="col-span-2">
            <p className="text-xs text-muted mb-2">
              El alquiler por horas inicia en el momento exacto del check-in del huésped y dura las horas configuradas abajo.
            </p>
          </div>
        )}

        <div>
          <Field label="Duración (Horas)">
            <Input
              type="number"
              min="1"
              max="72"
              value={duracionHoras}
              onChange={(e) => setDuracionHoras(e.target.value)}
              className="tabular-nums font-semibold"
            />
          </Field>
        </div>

        <div>
          <Field label="Tolerancia (Min)">
            <Input
              type="number"
              min="0"
              max="120"
              value={toleranciaMin}
              onChange={(e) => setToleranciaMin(e.target.value)}
              className="tabular-nums font-semibold"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-line-soft">
        {saved ? (
          <span className="text-xs text-ok font-semibold animate-fade">✓ Horario guardado</span>
        ) : (
          <span className="text-[11px] text-subtle">Aplica a recepción y kiosco</span>
        )}
        <Button variant="primary" size="sm" onClick={handleSave} disabled={busy}>
          {busy ? "Guardando…" : "Guardar Horario"}
        </Button>
      </div>
    </div>
  );
}

function CategoryRateEditor({
  category,
  modalities,
  initialRate,
  onSave,
  onError,
}: {
  category: Category;
  modalities: Modality[] | null;
  initialRate?: CategoryRatesDto;
  onSave: (r: { precioHorasCentimos: number; precioNocheCentimos: number; precioNocheBCentimos?: number }) => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [precioHoras, setPrecioHoras] = useState(
    initialRate ? (initialRate.precioHorasCentimos / 100).toFixed(2) : "40.00"
  );
  const [precioNoche, setPrecioNoche] = useState(
    initialRate ? (initialRate.precioNocheCentimos / 100).toFixed(2) : "60.00"
  );
  const [precioNocheB, setPrecioNocheB] = useState(
    initialRate?.precioNocheBCentimos ? (initialRate.precioNocheBCentimos / 100).toFixed(2) : "50.00"
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const horasMod = modalities?.find((m) => m.codigo === "HORAS_3");
  const nocheAMod = modalities?.find((m) => m.codigo === "NOCHE_A");
  const nocheBMod = modalities?.find((m) => m.codigo === "NOCHE_B");

  const horasLabel = `Por Horas (${horasMod?.duracionHoras ?? 3}h)`;
  const nocheLabel = nocheBMod?.checkinFijo
    ? `Por Noche (${formatTime12h(nocheBMod.checkinFijo)})`
    : "Por Noche (7:00 PM)";
  const diaLabel = nocheAMod?.checkinFijo
    ? `Por Día / Noche B (${formatTime12h(nocheAMod.checkinFijo)})`
    : "Por Día / Noche B";

  useEffect(() => {
    if (initialRate) {
      setPrecioHoras((initialRate.precioHorasCentimos / 100).toFixed(2));
      setPrecioNoche((initialRate.precioNocheCentimos / 100).toFixed(2));
      if (initialRate.precioNocheBCentimos) {
        setPrecioNocheB((initialRate.precioNocheBCentimos / 100).toFixed(2));
      }
    }
  }, [initialRate]);

  const handleSave = async () => {
    setBusy(true);
    setSaved(false);
    try {
      await onSave({
        precioHorasCentimos: soles(Number(precioHoras) || 0),
        precioNocheCentimos: soles(Number(precioNoche) || 0),
        precioNocheBCentimos: soles(Number(precioNocheB) || Number(precioNoche) || 0),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      onError("No se pudieron guardar las tarifas.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 flex flex-col justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-inset p-1">
          <RoomIllustration beds={category.camas} fans={category.ventiladores} floorFill="var(--room-floor-teal, #F5F1E8)" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-ink truncate text-base">{category.nombre}</h4>
            <Badge tone={category.activo ? "tone-teal" : "tone-stone"}>
              {category.activo ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <p className="text-xs text-muted">
            {category.camas} cama{category.camas > 1 ? "s" : ""}
            {category.ventiladores > 0 ? ` · ${category.ventiladores} ventilador${category.ventiladores > 1 ? "es" : ""}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-line-soft">
        <Field label={horasLabel}>
          <Input
            type="number"
            min="0"
            step="0.50"
            value={precioHoras}
            onChange={(e) => setPrecioHoras(e.target.value)}
            className="font-bold tabular-nums text-brand"
          />
        </Field>
        <Field label={nocheLabel}>
          <Input
            type="number"
            min="0"
            step="0.50"
            value={precioNoche}
            onChange={(e) => setPrecioNoche(e.target.value)}
            className="font-bold tabular-nums text-amber-600 dark:text-amber-400"
          />
        </Field>
        <Field label={diaLabel}>
          <Input
            type="number"
            min="0"
            step="0.50"
            value={precioNocheB}
            onChange={(e) => setPrecioNocheB(e.target.value)}
            className="font-bold tabular-nums text-sky-600 dark:text-sky-400"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between pt-1">
        {saved ? (
          <span className="text-xs text-ok font-semibold animate-fade">✓ Tarifas guardadas</span>
        ) : (
          <span className="text-[11px] text-subtle">Afecta cuartos de este tipo</span>
        )}
        <Button variant="primary" size="sm" onClick={handleSave} disabled={busy}>
          {busy ? "Guardando…" : "Guardar Tarifas"}
        </Button>
      </div>
    </div>
  );
}
