import { z } from "zod";

/**
 * Identidad visible del hotel: el nombre y el logo que se muestran en
 * recepción, en el kiosco y en los comprobantes impresos. Se carga por primera
 * vez en el asistente de instalación y después se edita desde Ajustes.
 */
export const BrandSchema = z.object({
  nombre: z.string().min(1),
  /** Bajada corta debajo del nombre en la barra lateral. */
  lema: z.string(),
  /** Ruta servida por el propio servidor (`/brand-images/…`), o null si el hotel no cargó logo. */
  logoUrl: z.string().nullable(),
});
export type Brand = z.infer<typeof BrandSchema>;
