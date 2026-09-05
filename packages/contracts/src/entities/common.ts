/** Fechas ISO (`YYYY-MM-DD`), límites inclusive. Usado por cashbox y reporting para filtrar por rango. */
export interface DateRange {
  desde: string;
  hasta: string;
}

/**
 * Formatos de imagen que el sistema acepta subir (fotos de producto, QR de
 * billetera, logo del hotel). Se validan por bytes reales al guardarlas, no por
 * la extensión — ver apps/server/src/image-storage.ts.
 */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];
