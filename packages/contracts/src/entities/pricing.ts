import { z } from "zod";

export const SeasonSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  desde: z.string(), // ISO date
  hasta: z.string(), // ISO date
  prioridad: z.number().int(),
  activa: z.boolean(),
});
export type Season = z.infer<typeof SeasonSchema>;

/** `horaInicio` is "HH:mm". A season can have as many bands as the admin needs. */
export const RateBandSchema = z.object({
  id: z.string(),
  temporadaId: z.string(),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  orden: z.number().int(),
  etiqueta: z.string(),
});
export type RateBand = z.infer<typeof RateBandSchema>;

export const ModalityCodeSchema = z.enum(["HORAS_3", "NOCHE_A", "NOCHE_B"]);
export type ModalityCode = z.infer<typeof ModalityCodeSchema>;

export const ModalitySchema = z.object({
  id: z.string(),
  codigo: ModalityCodeSchema,
  nombre: z.string(),
  duracionHoras: z.number().positive(),
  checkinFijo: z.string().nullable(), // "HH:mm" for night modalities
  checkoutFijo: z.string().nullable(),
  toleranciaMin: z.number().int().nonnegative(),
  activa: z.boolean(),
});
export type Modality = z.infer<typeof ModalitySchema>;

export const RateSchema = z.object({
  id: z.string(),
  franjaId: z.string(),
  categoriaId: z.string(),
  modalidadId: z.string(),
  precioCentimos: z.number().int().positive(),
});
export type Rate = z.infer<typeof RateSchema>;

export const NightScaleEntrySchema = z.object({
  id: z.string(),
  modalidadId: z.string(),
  categoriaId: z.string(),
  noches: z.number().int().positive(),
  precioTotalCentimos: z.number().int().positive(),
});
export type NightScaleEntry = z.infer<typeof NightScaleEntrySchema>;

export const ChargeCodeSchema = z.enum(["EARLY_CHECKIN", "EXCESO", "EXTENSION_3H"]);
export type ChargeCode = z.infer<typeof ChargeCodeSchema>;

export const ChargeSchema = z.object({
  id: z.string(),
  codigo: ChargeCodeSchema,
  nombre: z.string(),
  precioCentimos: z.number().int().nonnegative(),
  unidad: z.enum(["HORA", "BLOQUE", "FIJO"]),
  activo: z.boolean(),
});
export type Charge = z.infer<typeof ChargeSchema>;

export const ResolvedRateSchema = z.object({
  precioCentimos: z.number().int().positive(),
  temporadaId: z.string(),
  franjaId: z.string(),
  modalidadId: z.string(),
  categoriaId: z.string(),
});
export type ResolvedRate = z.infer<typeof ResolvedRateSchema>;
