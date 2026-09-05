import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { SunatCertificado, SunatConfig, SunatEmisor, SunatMode, SunatTestResult } from "@casacarlos/contracts";
import { RealSunatClient, inspectPfxCertificate } from "@casacarlos/billing";

export const SUNAT_BETA_ENDPOINT = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";
export const SUNAT_PRODUCCION_ENDPOINT = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";

/** Lo que se guarda de verdad, contraseñas incluidas — nunca sale de este proceso. */
export interface SunatSecretConfig {
  modo: SunatMode;
  emisor: SunatEmisor;
  solUser: string;
  solPassword: string;
  certPath: string;
  certPassword: string;
}

export interface UpdateSunatConfigInput {
  modo?: SunatMode;
  ruc?: string;
  razonSocial?: string;
  nombreComercial?: string;
  direccion?: string;
  ubigeo?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  solUser?: string;
  /** Solo si se está cambiando: vacío o ausente deja la que ya estaba. */
  solPassword?: string;
}

const ENV_KEYS = {
  modo: "SUNAT_MODE",
  ruc: "SUNAT_RUC",
  razonSocial: "SUNAT_RAZON_SOCIAL",
  nombreComercial: "SUNAT_NOMBRE_COMERCIAL",
  direccion: "SUNAT_DIRECCION",
  ubigeo: "SUNAT_UBIGEO",
  distrito: "SUNAT_DISTRITO",
  provincia: "SUNAT_PROVINCIA",
  departamento: "SUNAT_DEPARTAMENTO",
  solUser: "SUNAT_SOL_USER",
  solPassword: "SUNAT_SOL_PASSWORD",
  certPath: "SUNAT_CERT_PATH",
  certPassword: "SUNAT_CERT_PASSWORD",
} as const;

/**
 * Configuración de facturación electrónica, editable en caliente desde
 * Ajustes → SUNAT.
 *
 * Vive en el mismo `.env` que ya escribía el instalador y que el servidor lee
 * al arrancar (`process.loadEnvFile`), y no en una tabla aparte, justamente
 * para que no haya dos verdades: quien edite el archivo a mano —está
 * documentado en el manual— sigue viendo lo mismo que muestra la pantalla.
 * Al guardar se reescriben SOLO las claves `SUNAT_*`; el resto del archivo
 * (PORT, comentarios, lo que agregue alguien) queda intacto.
 */
export class SunatConfigStore {
  constructor(
    private readonly envPath: string,
    private readonly dataDir: string,
  ) {}

  /** La configuración completa, para armar el cliente de SUNAT. */
  current(): SunatSecretConfig {
    const env = process.env;
    const modo = ((env[ENV_KEYS.modo] ?? "MOCK").toUpperCase() as SunatMode) ?? "MOCK";
    return {
      modo: modo === "BETA" || modo === "PRODUCCION" ? modo : "MOCK",
      emisor: {
        ruc: env[ENV_KEYS.ruc] ?? "20000000000",
        razonSocial: env[ENV_KEYS.razonSocial] ?? "HOSPEDAJE CARLOS SAC",
        nombreComercial: env[ENV_KEYS.nombreComercial] ?? "HOSPEDAJE CARLOS",
        direccion: env[ENV_KEYS.direccion] ?? "AV PRINCIPAL S/N",
        ubigeo: env[ENV_KEYS.ubigeo] ?? "150101",
        distrito: env[ENV_KEYS.distrito] ?? "LIMA",
        provincia: env[ENV_KEYS.provincia] ?? "LIMA",
        departamento: env[ENV_KEYS.departamento] ?? "LIMA",
      },
      solUser: env[ENV_KEYS.solUser] ?? "",
      solPassword: env[ENV_KEYS.solPassword] ?? "",
      certPath: env[ENV_KEYS.certPath] ?? "",
      certPassword: env[ENV_KEYS.certPassword] ?? "",
    };
  }

  /** La vista que va a la pantalla: sin contraseñas, con el estado del certificado ya resuelto. */
  read(modoActivo: SunatMode): SunatConfig {
    const config = this.current();
    const certificado = this.describeCertificate(config);
    const faltantes = faltantesPara(config, certificado);
    return {
      modo: config.modo,
      modoActivo,
      emisor: config.emisor,
      solUser: config.solUser,
      solPasswordConfigurada: config.solPassword.length > 0,
      certificado,
      endpoint: endpointPara(config.modo),
      listoParaEmitir: faltantes.length === 0,
      faltantes,
    };
  }

  /**
   * `aplicar` corre después de validar y ANTES de escribir el .env: si armar
   * el cliente de SUNAT con la configuración nueva falla, no queda persistida
   * una configuración que el sistema no puede usar.
   */
  save(input: UpdateSunatConfigInput, aplicar: (config: SunatSecretConfig) => void): SunatSecretConfig {
    const actual = this.current();
    const modo = input.modo ?? actual.modo;
    const emisor: SunatEmisor = {
      ruc: limpio(input.ruc, actual.emisor.ruc),
      razonSocial: limpio(input.razonSocial, actual.emisor.razonSocial),
      nombreComercial: limpio(input.nombreComercial, actual.emisor.nombreComercial),
      direccion: limpio(input.direccion, actual.emisor.direccion),
      ubigeo: limpio(input.ubigeo, actual.emisor.ubigeo),
      distrito: limpio(input.distrito, actual.emisor.distrito),
      provincia: limpio(input.provincia, actual.emisor.provincia),
      departamento: limpio(input.departamento, actual.emisor.departamento),
    };
    const candidata: SunatSecretConfig = {
      modo,
      emisor,
      solUser: limpio(input.solUser, actual.solUser),
      // Una contraseña vacía significa "no la estoy cambiando": si no fuera
      // así, cualquier guardado de los datos del emisor borraría la clave SOL,
      // que la pantalla nunca muestra y por lo tanto nunca reenvía.
      solPassword: input.solPassword && input.solPassword.length > 0 ? input.solPassword : actual.solPassword,
      certPath: actual.certPath,
      certPassword: actual.certPassword,
    };

    validar(candidata);
    aplicar(candidata);
    this.persist(candidata);
    return candidata;
  }

  /**
   * Guarda el .pfx que subió el administrador. Se valida ANTES de reemplazar
   * al que ya estaba: si la contraseña no abre el archivo, la instalación
   * sigue con el certificado viejo funcionando.
   */
  saveCertificate(buffer: Buffer, password: string, aplicar: (config: SunatSecretConfig) => void): SunatSecretConfig {
    if (buffer.length === 0) throw new Error("El archivo del certificado está vacío.");
    if (password.length === 0) throw new Error("Escribí la contraseña del certificado.");

    const certDir = resolve(this.dataDir);
    mkdirSync(certDir, { recursive: true });
    const temporal = resolve(certDir, `sunat-cert-${randomUUID()}.tmp`);
    writeFileSync(temporal, buffer);
    try {
      inspectPfxCertificate(temporal, password);
      const destino = resolve(certDir, "sunat-cert.pfx");
      copyFileSync(temporal, destino);
      const candidata: SunatSecretConfig = { ...this.current(), certPath: destino, certPassword: password };
      validar(candidata);
      aplicar(candidata);
      this.persist(candidata);
      return candidata;
    } catch (err) {
      // Los errores de node-forge son técnicos ("Too few bytes to read ASN.1
      // value", "Invalid password"): acá se traducen a las dos causas que la
      // persona del hotel puede efectivamente arreglar.
      const mensaje = (err as Error).message;
      const esContrasena = /contrase|password|mac could not be verified|invalid password/i.test(mensaje);
      throw new Error(
        esContrasena
          ? "No se pudo abrir el certificado con esa contraseña. Revisá que sea la del archivo .pfx y volvé a intentar."
          : `El archivo no parece un certificado .pfx o .p12 válido, o está dañado (${mensaje}).`,
      );
    } finally {
      rmSync(temporal, { force: true });
    }
  }

  private describeCertificate(config: SunatSecretConfig): SunatCertificado {
    const base: SunatCertificado = {
      presente: false,
      ruta: config.certPath || null,
      passwordConfigurada: config.certPassword.length > 0,
      titular: null,
      emisor: null,
      validoDesde: null,
      validoHasta: null,
      vencido: false,
      error: null,
    };

    if (!config.certPath) return base;
    if (!existsSync(config.certPath)) {
      return { ...base, error: "El archivo del certificado ya no está en esa ruta." };
    }
    if (!config.certPassword) {
      return { ...base, presente: true, error: "Falta la contraseña del certificado." };
    }

    try {
      const info = inspectPfxCertificate(config.certPath, config.certPassword);
      const ahora = Date.now();
      return {
        ...base,
        presente: true,
        titular: info.titular,
        emisor: info.emisor,
        validoDesde: info.validoDesde,
        validoHasta: info.validoHasta,
        vencido: Date.parse(info.validoHasta) < ahora || Date.parse(info.validoDesde) > ahora,
        error: null,
      };
    } catch {
      return { ...base, presente: true, error: "No se pudo abrir el certificado con la contraseña guardada." };
    }
  }

  /** Reescribe solo las claves SUNAT_* del .env, respetando todo lo demás. */
  private persist(config: SunatSecretConfig): void {
    const valores: Record<string, string> = {
      [ENV_KEYS.modo]: config.modo,
      [ENV_KEYS.ruc]: config.emisor.ruc,
      [ENV_KEYS.razonSocial]: config.emisor.razonSocial,
      [ENV_KEYS.nombreComercial]: config.emisor.nombreComercial,
      [ENV_KEYS.direccion]: config.emisor.direccion,
      [ENV_KEYS.ubigeo]: config.emisor.ubigeo,
      [ENV_KEYS.distrito]: config.emisor.distrito,
      [ENV_KEYS.provincia]: config.emisor.provincia,
      [ENV_KEYS.departamento]: config.emisor.departamento,
      [ENV_KEYS.solUser]: config.solUser,
      [ENV_KEYS.solPassword]: config.solPassword,
      [ENV_KEYS.certPath]: config.certPath,
      [ENV_KEYS.certPassword]: config.certPassword,
    };

    const original = existsSync(this.envPath) ? readFileSync(this.envPath, "utf8") : "";
    const lineas = original.length > 0 ? original.split(/\r?\n/) : [];
    // Un archivo que termina en salto de línea deja un último elemento vacío al
    // partirlo: si no se descarta, cada guardado suma una línea en blanco más.
    while (lineas.length > 0 && lineas[lineas.length - 1]?.trim() === "") lineas.pop();
    const pendientes = new Set(Object.keys(valores));

    const reescritas = lineas.map((linea) => {
      const match = /^\s*([A-Z0-9_]+)\s*=/.exec(linea);
      const clave = match?.[1];
      if (!clave || !pendientes.has(clave)) return linea;
      pendientes.delete(clave);
      return `${clave}=${valores[clave] ?? ""}`;
    });

    for (const clave of pendientes) {
      // Una clave que no estaba (ej. el .env viejo no traía SUNAT_CERT_PASSWORD)
      // se agrega al final, no se pierde en silencio.
      if ((valores[clave] ?? "").length > 0) reescritas.push(`${clave}=${valores[clave]}`);
    }

    writeFileSync(this.envPath, reescritas.join("\n") + "\n", "utf8");

    // El proceso ya está corriendo: sin esto, `current()` seguiría leyendo lo
    // viejo hasta el próximo reinicio del servicio.
    for (const [clave, valor] of Object.entries(valores)) process.env[clave] = valor;
  }
}

export function endpointPara(modo: SunatMode): string | null {
  if (modo === "BETA") return SUNAT_BETA_ENDPOINT;
  if (modo === "PRODUCCION") return SUNAT_PRODUCCION_ENDPOINT;
  return null;
}

/** Qué falta para poder emitir en el modo elegido, en palabras que sirvan en pantalla. */
function faltantesPara(config: SunatSecretConfig, certificado: SunatCertificado): string[] {
  if (config.modo === "MOCK") return [];
  const faltantes: string[] = [];
  if (!/^\d{11}$/.test(config.emisor.ruc)) faltantes.push("El RUC del hotel (11 dígitos).");
  if (!config.solUser) faltantes.push("El usuario SOL secundario.");
  if (!config.solPassword) faltantes.push("La clave del usuario SOL.");
  if (!certificado.presente) faltantes.push("El archivo del certificado digital (.pfx).");
  else if (certificado.error) faltantes.push(certificado.error);
  else if (certificado.vencido) faltantes.push("El certificado digital está fuera de su fecha de vigencia.");
  return faltantes;
}

function validar(config: SunatSecretConfig): void {
  if (config.modo === "MOCK") return;
  if (!/^\d{11}$/.test(config.emisor.ruc)) {
    throw new Error(`Para trabajar en modo ${config.modo} hace falta el RUC del hotel: 11 dígitos, sin espacios.`);
  }
  if (!config.solUser || !config.solPassword) {
    throw new Error(`Para trabajar en modo ${config.modo} hacen falta el usuario SOL secundario y su clave.`);
  }
  if (!config.certPath || !existsSync(config.certPath)) {
    throw new Error(`Para trabajar en modo ${config.modo} hace falta cargar el certificado digital (.pfx).`);
  }
  if (!config.certPassword) {
    throw new Error("Falta la contraseña del certificado digital.");
  }
}

const limpio = (nuevo: string | undefined, anterior: string): string => (nuevo === undefined ? anterior : nuevo.trim());

/**
 * Prueba de conexión con SUNAT desde la PC del hotel, sin emitir nada.
 *
 * Comprobado contra el servicio real: el ambiente BETA responde igual con la
 * clave correcta que con una equivocada, así que ahí esto confirma que hay
 * conexión y nada más. En PRODUCCION sí delata una clave SOL mal cargada. El
 * mensaje que devuelve dice cuál de las dos cosas se probó, para no dar un
 * visto bueno que no corresponde.
 */
export async function probeSunatCredentials(config: SunatSecretConfig): Promise<SunatTestResult> {
  if (config.modo === "MOCK") {
    return { ok: false, mensaje: "Estás en modo prueba (MOCK): no se envía nada a SUNAT, así que no hay credenciales que probar." };
  }
  const endpoint = endpointPara(config.modo);
  if (!endpoint) return { ok: false, mensaje: "No hay un servicio de SUNAT configurado para este modo." };
  if (!config.solUser || !config.solPassword) {
    return { ok: false, mensaje: "Faltan el usuario SOL y su clave." };
  }

  const client = new RealSunatClient({ endpoint, ruc: config.emisor.ruc, solUser: config.solUser, solPassword: config.solPassword });
  let resultado: { credencialesRechazadas: boolean; detalle: string };
  try {
    resultado = await client.checkConnectivity();
  } catch (err) {
    return {
      ok: false,
      mensaje: `No se pudo conectar con SUNAT (${(err as Error).message}). Revisá la conexión a internet de la PC.`,
    };
  }

  if (resultado.credencialesRechazadas) {
    return {
      ok: false,
      mensaje: `SUNAT rechazó las credenciales: ${resultado.detalle}. Recordá que el usuario es el SOL secundario, no el RUC ni la clave SOL principal.`,
    };
  }

  return {
    ok: true,
    mensaje:
      config.modo === "PRODUCCION"
        ? "SUNAT respondió desde el ambiente de producción y no rechazó las credenciales del hotel."
        : "Hay conexión con el ambiente de pruebas de SUNAT. Ojo: ese ambiente no valida usuario ni clave, así que esto confirma la conexión, no las credenciales — eso recién se comprueba en producción o emitiendo una boleta de prueba.",
  };
}
