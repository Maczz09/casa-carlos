import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Comprobante, ComprobanteLine, ComunicacionBaja } from "@casacarlos/contracts";
import { SERIE_BAJA, SERIE_BOLETA, SERIE_FACTURA, SERIE_NOTA_CREDITO_BOLETA, SERIE_NOTA_CREDITO_FACTURA, SERIE_NOTA_DEBITO_BOLETA, SERIE_NOTA_DEBITO_FACTURA } from "./domain/series.js";

type ComprobanteRow = typeof schema.billingComprobantes.$inferSelect;
type BajaRow = typeof schema.billingBajas.$inferSelect;

const toComprobante = (r: ComprobanteRow): Comprobante => ({
  id: r.id,
  ventaId: r.ventaId,
  tipo: r.tipo,
  serie: r.serie,
  correlativo: r.correlativo,
  receptorTipoDoc: r.receptorTipoDoc,
  receptorNumeroDoc: r.receptorNumeroDoc,
  receptorRazonSocial: r.receptorRazonSocial,
  lineas: JSON.parse(r.lineasJson) as ComprobanteLine[],
  valorVentaCentimos: r.valorVentaCentimos,
  igvCentimos: r.igvCentimos,
  totalCentimos: r.totalCentimos,
  montoLetras: r.montoLetras,
  estadoSunat: r.estadoSunat,
  sunatCodigo: r.sunatCodigo,
  sunatDescripcion: r.sunatDescripcion,
  usuarioId: r.usuarioId,
  creadoEn: r.creadoEn,
  enviadoEn: r.enviadoEn,
  comprobanteAfectadoId: r.comprobanteAfectadoId,
  motivoCodigo: r.motivoCodigo,
  motivoDescripcion: r.motivoDescripcion,
});

const toBaja = (r: BajaRow): ComunicacionBaja => ({
  id: r.id,
  comprobanteId: r.comprobanteId,
  correlativo: r.correlativo,
  motivo: r.motivo,
  ticket: r.ticket,
  estadoSunat: r.estadoSunat,
  sunatCodigo: r.sunatCodigo,
  sunatDescripcion: r.sunatDescripcion,
  usuarioId: r.usuarioId,
  creadoEn: r.creadoEn,
  resueltoEn: r.resueltoEn,
});

export class BillingRepo {
  constructor(private readonly db: Db) {}

  /**
   * Incremento atómico vía `UPDATE ... RETURNING` — una sola sentencia, sin
   * lectura-luego-escritura. Requiere que `ensureCorrelativoSeeded` ya haya
   * corrido para esta serie (lanza si no hay fila — evitar arrancar en 1
   * silenciosamente si el seed no corrió es preferible a un correlativo
   * incorrecto ante SUNAT).
   */
  async nextCorrelativo(serie: string): Promise<number> {
    const [row] = await this.db
      .update(schema.billingCorrelativos)
      .set({ valor: sql`${schema.billingCorrelativos.valor} + 1` })
      .where(eq(schema.billingCorrelativos.serie, serie))
      .returning({ valor: schema.billingCorrelativos.valor });
    if (!row) throw new Error(`La serie "${serie}" no tiene un contador de correlativo inicializado (falta ensureCorrelativoSeeded).`);
    return row.valor;
  }

  /** Crea el contador de una serie si todavía no existe, sembrado desde `seedValue` (típicamente el MAX() de filas ya emitidas, nunca 0 si ya hay historial). No pisa un contador existente. */
  async ensureCorrelativoSeeded(serie: string, seedValue: number): Promise<void> {
    const existing = await this.db.select().from(schema.billingCorrelativos).where(eq(schema.billingCorrelativos.serie, serie)).get();
    if (existing) return;
    await this.db.insert(schema.billingCorrelativos).values({ serie, valor: seedValue });
  }

  /** Máximo correlativo ya emitido para una serie de comprobante — usado solo para sembrar el contador, no en el camino caliente. */
  async maxComprobanteCorrelativo(serie: string): Promise<number> {
    const rows = await this.db.select({ correlativo: schema.billingComprobantes.correlativo }).from(schema.billingComprobantes).where(eq(schema.billingComprobantes.serie, serie)).all();
    return rows.reduce((max, r) => Math.max(max, r.correlativo), 0);
  }

  /** Máximo correlativo ya usado por una Comunicación de Baja — usado solo para sembrar el contador `SERIE_BAJA`. */
  async maxBajaCorrelativo(): Promise<number> {
    const rows = await this.db.select({ correlativo: schema.billingBajas.correlativo }).from(schema.billingBajas).all();
    return rows.reduce((max, r) => Math.max(max, r.correlativo), 0);
  }

  /**
   * Corre una vez al arrancar el servidor. Idempotente: no pisa un contador
   * que ya exista, así que es seguro llamarla en cada arranque. Sobre una
   * base con historial (comprobantes ya emitidos, incluso ya ACEPTADOs por
   * SUNAT en beta), siembra desde el MAX() real — nunca desde 0 — para que
   * SUNAT nunca vea un correlativo repetido tras este cambio.
   */
  async ensureAllCorrelativosSeeded(): Promise<void> {
    await this.ensureCorrelativoSeeded(SERIE_BOLETA, await this.maxComprobanteCorrelativo(SERIE_BOLETA));
    await this.ensureCorrelativoSeeded(SERIE_FACTURA, await this.maxComprobanteCorrelativo(SERIE_FACTURA));
    await this.ensureCorrelativoSeeded(SERIE_BAJA, await this.maxBajaCorrelativo());
    // Las 4 series de notas son nuevas — nunca hay historial previo que respetar, siempre arrancan en 0.
    for (const serieNota of [SERIE_NOTA_CREDITO_FACTURA, SERIE_NOTA_CREDITO_BOLETA, SERIE_NOTA_DEBITO_FACTURA, SERIE_NOTA_DEBITO_BOLETA]) {
      await this.ensureCorrelativoSeeded(serieNota, 0);
    }
  }

  async insertComprobante(row: ComprobanteRow): Promise<Comprobante> {
    await this.db.insert(schema.billingComprobantes).values(row);
    return toComprobante(row);
  }

  async getComprobante(id: string): Promise<Comprobante | null> {
    const row = await this.db.select().from(schema.billingComprobantes).where(eq(schema.billingComprobantes.id, id)).get();
    return row ? toComprobante(row) : null;
  }

  async getForSale(ventaId: string): Promise<Comprobante | null> {
    const row = await this.db.select().from(schema.billingComprobantes).where(eq(schema.billingComprobantes.ventaId, ventaId)).get();
    return row ? toComprobante(row) : null;
  }

  async listComprobantes(range?: { desde: string; hasta: string }): Promise<Comprobante[]> {
    const rows = range
      ? await this.db
          .select()
          .from(schema.billingComprobantes)
          .where(and(gte(schema.billingComprobantes.creadoEn, `${range.desde}T00:00:00.000Z`), lte(schema.billingComprobantes.creadoEn, `${range.hasta}T23:59:59.999Z`)))
          .all()
      : await this.db.select().from(schema.billingComprobantes).all();
    return rows.map(toComprobante).sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  /** Notas ya emitidas contra un comprobante — no incluye el propio comprobante afectado. */
  async listNotasForComprobante(comprobanteAfectadoId: string): Promise<Comprobante[]> {
    const rows = await this.db.select().from(schema.billingComprobantes).where(eq(schema.billingComprobantes.comprobanteAfectadoId, comprobanteAfectadoId)).all();
    return rows.map(toComprobante).sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  async updateComprobante(id: string, patch: Partial<ComprobanteRow>): Promise<Comprobante> {
    await this.db.update(schema.billingComprobantes).set(patch).where(eq(schema.billingComprobantes.id, id));
    const updated = await this.getComprobante(id);
    if (!updated) throw new Error(`Comprobante ${id} no encontrado tras actualizar.`);
    return updated;
  }

  /** Guarda el XML firmado y el CDR aparte — no viajan en el objeto `Comprobante` del contrato (solo para auditoría/reimpresión). */
  async saveArtifacts(id: string, xmlBase64: string, cdrBase64: string | null): Promise<void> {
    await this.db.update(schema.billingComprobantes).set({ xmlBase64, cdrBase64 }).where(eq(schema.billingComprobantes.id, id));
  }

  async getXml(id: string): Promise<string | null> {
    const row = await this.db.select({ xmlBase64: schema.billingComprobantes.xmlBase64 }).from(schema.billingComprobantes).where(eq(schema.billingComprobantes.id, id)).get();
    if (!row?.xmlBase64) return null;
    return Buffer.from(row.xmlBase64, "base64").toString("utf-8");
  }

  /** Mismo contador atómico que `nextCorrelativo`, bajo la clave `SERIE_BAJA` ("RA") — antes era `MAX(correlativo)+1` sin `WHERE`, ni atómico ni realmente necesitaba filtrar por serie (una Comunicación de Baja no tiene una), pero sí necesitaba ser una sola sentencia. */
  async nextBajaCorrelativo(): Promise<number> {
    return this.nextCorrelativo(SERIE_BAJA);
  }

  async insertBaja(row: BajaRow): Promise<ComunicacionBaja> {
    await this.db.insert(schema.billingBajas).values(row);
    return toBaja(row);
  }

  async getBajaForComprobante(comprobanteId: string): Promise<ComunicacionBaja | null> {
    const row = await this.db.select().from(schema.billingBajas).where(eq(schema.billingBajas.comprobanteId, comprobanteId)).get();
    return row ? toBaja(row) : null;
  }

  async updateBaja(id: string, patch: Partial<BajaRow>): Promise<ComunicacionBaja> {
    await this.db.update(schema.billingBajas).set(patch).where(eq(schema.billingBajas.id, id));
    const row = await this.db.select().from(schema.billingBajas).where(eq(schema.billingBajas.id, id)).get();
    if (!row) throw new Error(`Comunicación de baja ${id} no encontrada tras actualizar.`);
    return toBaja(row);
  }

  async saveBajaCdr(id: string, cdrBase64: string): Promise<void> {
    await this.db.update(schema.billingBajas).set({ cdrBase64 }).where(eq(schema.billingBajas.id, id));
  }

  async getBajaXml(id: string): Promise<string | null> {
    const row = await this.db.select({ xmlBase64: schema.billingBajas.xmlBase64 }).from(schema.billingBajas).where(eq(schema.billingBajas.id, id)).get();
    if (!row?.xmlBase64) return null;
    return Buffer.from(row.xmlBase64, "base64").toString("utf-8");
  }
}
