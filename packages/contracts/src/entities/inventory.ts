import { z } from "zod";

export const ProductStateSchema = z.enum(["ACTIVO", "AGOTADO", "DESCONTINUADO"]);
export type ProductState = z.infer<typeof ProductStateSchema>;

/** Categoría de producto de bodega. Se llama `ProductCategory` y no `Category` porque ese nombre ya lo usa la categoría de CUARTO (entities/rooms.ts). */
export const ProductCategorySchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  descripcion: z.string().nullable(),
  activo: z.boolean(),
  creadoEn: z.string(),
});
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const ProductSchema = z.object({
  id: z.string(),
  codigoBarras: z.string().nullable(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  categoriaId: z.string().nullable(),
  /** Nombre de la categoría ya resuelto — se sirve por join, no se guarda en el producto. */
  categoria: z.string().nullable(),
  precioCentimos: z.number().int().nonnegative(),
  costoCentimos: z.number().int().nonnegative(),
  stock: z.number().int(),
  stockMinimo: z.number().int().nonnegative(),
  estado: ProductStateSchema,
  activo: z.boolean(),
  creadoEn: z.string(),
});
export type Product = z.infer<typeof ProductSchema>;

/** Vista pública de un producto para el kiosco — sin `costoCentimos`/stock exacto (dato de negocio, no del cliente; solo se expone si hay stock o no), mismo criterio que `rooms.getBoard(true)` no serializa datos de huésped. */
export const KioskProductSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  categoria: z.string().nullable(),
  precioCentimos: z.number().int().nonnegative(),
  enStock: z.boolean(),
});
export type KioskProduct = z.infer<typeof KioskProductSchema>;

export const MovementTypeSchema = z.enum(["INGRESO", "SALIDA", "AJUSTE", "ANULACION"]);
export type MovementType = z.infer<typeof MovementTypeSchema>;

export const ProductMovementSchema = z.object({
  id: z.string(),
  productoId: z.string(),
  tipo: MovementTypeSchema,
  cantidad: z.number().int(),
  stockResultante: z.number().int(),
  cuartoId: z.string().nullable(),
  ventaId: z.string().nullable(),
  lineaVentaId: z.string().nullable(),
  motivo: z.string().nullable(),
  usuarioId: z.string(),
  ocurridoEn: z.string(),
});
export type ProductMovement = z.infer<typeof ProductMovementSchema>;
