import { z } from "zod";

/**
 * Con qué ambiente de SUNAT trabaja el sistema.
 *
 * - `MOCK`: no toca la red. Los comprobantes se arman y se guardan, pero nadie
 *   los recibe — para probar el sistema sin certificado.
 * - `BETA`: el ambiente de pruebas real de SUNAT. Acepta cualquier
 *   certificado, incluso uno autofirmado; lo que se emita ahí no tiene valor
 *   legal.
 * - `PRODUCCION`: facturación de verdad. Exige el certificado digital del
 *   hotel y un usuario SOL secundario.
 */
export const SunatModeSchema = z.enum(["MOCK", "BETA", "PRODUCCION"]);
export type SunatMode = z.infer<typeof SunatModeSchema>;

/** Datos del emisor que van dentro de cada comprobante. */
export const SunatEmisorSchema = z.object({
  ruc: z.string(),
  razonSocial: z.string(),
  nombreComercial: z.string(),
  direccion: z.string(),
  ubigeo: z.string(),
  distrito: z.string(),
  provincia: z.string(),
  departamento: z.string(),
});
export type SunatEmisor = z.infer<typeof SunatEmisorSchema>;

/** Lo que se sabe del certificado digital cargado, leído del archivo .pfx. */
export const SunatCertificadoSchema = z.object({
  presente: z.boolean(),
  /** Ruta del archivo en la máquina del hotel — se muestra para poder ubicarlo. */
  ruta: z.string().nullable(),
  passwordConfigurada: z.boolean(),
  /** A nombre de quién está emitido, si el archivo se pudo abrir. */
  titular: z.string().nullable(),
  emisor: z.string().nullable(),
  validoDesde: z.string().nullable(),
  validoHasta: z.string().nullable(),
  /** `true` cuando la fecha de hoy quedó fuera de la vigencia del certificado. */
  vencido: z.boolean(),
  /** Por qué no se pudo leer el certificado (contraseña equivocada, archivo dañado…). */
  error: z.string().nullable(),
});
export type SunatCertificado = z.infer<typeof SunatCertificadoSchema>;

/**
 * Configuración de facturación electrónica tal como se muestra en pantalla.
 * Nunca incluye la clave SOL ni la contraseña del certificado: de esas solo se
 * informa si están cargadas.
 */
export const SunatConfigSchema = z.object({
  /** El modo guardado en la configuración. */
  modo: SunatModeSchema,
  /**
   * Con qué modo está funcionando el sistema en este momento. Difiere de
   * `modo` cuando la configuración guardada no se pudo usar al arrancar (por
   * ejemplo, el certificado ya no está en su ruta) y el servidor cayó a MOCK
   * para poder seguir levantando la pantalla donde corregirla.
   */
  modoActivo: SunatModeSchema,
  emisor: SunatEmisorSchema,
  solUser: z.string(),
  solPasswordConfigurada: z.boolean(),
  certificado: SunatCertificadoSchema,
  /** A qué servicio de SUNAT se está apuntando con el modo actual (vacío en MOCK). */
  endpoint: z.string().nullable(),
  /** `false` cuando falta algo para poder emitir en el modo elegido. */
  listoParaEmitir: z.boolean(),
  /** Qué falta, en palabras, cuando `listoParaEmitir` es `false`. */
  faltantes: z.array(z.string()),
});
export type SunatConfig = z.infer<typeof SunatConfigSchema>;

/** Resultado de probar las credenciales SOL contra el servicio real de SUNAT. */
export const SunatTestResultSchema = z.object({
  ok: z.boolean(),
  mensaje: z.string(),
});
export type SunatTestResult = z.infer<typeof SunatTestResultSchema>;
