import { z } from "zod";

export const FloorSchema = z.object({
  id: z.string(),
  numero: z.number().int().positive(),
  nombre: z.string(),
  orden: z.number().int(),
  activo: z.boolean(),
});
export type Floor = z.infer<typeof FloorSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  /** Camas reales de la categoría — nunca se infiere del nombre. */
  camas: z.number().int().positive(),
  atributoIds: z.array(z.string()),
  activo: z.boolean(),
});
export type Category = z.infer<typeof CategorySchema>;

export const AttributeSchema = z.object({
  id: z.string(),
  nombre: z.string(),
});
export type Attribute = z.infer<typeof AttributeSchema>;

export const RoomSchema = z.object({
  id: z.string(),
  numero: z.string(),
  pisoId: z.string(),
  categoriaId: z.string(),
  descripcion: z.string().nullable(),
  incluye: z.string().nullable(),
  fueraDeServicio: z.boolean(),
  motivoFueraServicio: z.string().nullable(),
  limpiezaHasta: z.string().nullable(),
  activo: z.boolean(),
  creadoEn: z.string(),
});
export type Room = z.infer<typeof RoomSchema>;

/**
 * Derived, never stored. OCUPADO subsumes EN_TOLERANCIA and EXCEDIDA — those
 * are the same physical state with a different alert color, computed from the
 * active stay's timing at read time.
 */
export const RoomStatusSchema = z.enum([
  "DISPONIBLE",
  "RESERVADO",
  "OCUPADO",
  "EN_TOLERANCIA",
  "EXCEDIDO",
  "LIMPIEZA",
  "FUERA_DE_SERVICIO",
]);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

export const RoomBoardEntrySchema = z.object({
  room: RoomSchema,
  estado: RoomStatusSchema,
  /** Only populated for staff (admin/reception) views — never sent to the kiosk. */
  clienteNombre: z.string().nullable(),
  stayId: z.string().nullable(),
  desocupaEn: z.string().nullable(),
  limpiezaHasta: z.string().nullable(),
});
export type RoomBoardEntry = z.infer<typeof RoomBoardEntrySchema>;

export const FloorBoardSchema = z.object({
  floor: FloorSchema,
  semaforo: z.enum(["VERDE", "ROJO"]),
  rooms: z.array(RoomBoardEntrySchema),
});
export type FloorBoard = z.infer<typeof FloorBoardSchema>;
