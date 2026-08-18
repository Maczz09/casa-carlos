import { and, eq } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Charge, ChargeCode, Modality, ModalityCode, NightScaleEntry, Rate, RateBand, Season } from "@casacarlos/contracts";

type SeasonRow = typeof schema.pricingTemporadas.$inferSelect;
type BandRow = typeof schema.pricingFranjas.$inferSelect;
type ModalityRow = typeof schema.pricingModalidades.$inferSelect;
type RateRow = typeof schema.pricingTarifas.$inferSelect;
type NightScaleRow = typeof schema.pricingEscalaNoches.$inferSelect;
type ChargeRow = typeof schema.pricingCargos.$inferSelect;

const toSeason = (r: SeasonRow): Season => ({ id: r.id, nombre: r.nombre, desde: r.desde, hasta: r.hasta, prioridad: r.prioridad, activa: r.activa });
const toBand = (r: BandRow): RateBand => ({ id: r.id, temporadaId: r.temporadaId, horaInicio: r.horaInicio, orden: r.orden, etiqueta: r.etiqueta });
const toModality = (r: ModalityRow): Modality => ({
  id: r.id,
  codigo: r.codigo,
  nombre: r.nombre,
  duracionHoras: r.duracionHoras,
  checkinFijo: r.checkinFijo,
  checkoutFijo: r.checkoutFijo,
  toleranciaMin: r.toleranciaMin,
  activa: r.activa,
});
const toRate = (r: RateRow): Rate => ({ id: r.id, franjaId: r.franjaId, categoriaId: r.categoriaId, modalidadId: r.modalidadId, precioCentimos: r.precioCentimos });
const toNightScale = (r: NightScaleRow): NightScaleEntry => ({
  id: r.id,
  modalidadId: r.modalidadId,
  categoriaId: r.categoriaId,
  noches: r.noches,
  precioTotalCentimos: r.precioTotalCentimos,
});
const toCharge = (r: ChargeRow): Charge => ({ id: r.id, codigo: r.codigo, nombre: r.nombre, precioCentimos: r.precioCentimos, unidad: r.unidad, activo: r.activo });

export class PricingRepo {
  constructor(private readonly db: Db) {}

  async insertSeason(row: SeasonRow): Promise<Season> {
    await this.db.insert(schema.pricingTemporadas).values(row);
    return toSeason(row);
  }

  async listSeasons(): Promise<Season[]> {
    const rows = await this.db.select().from(schema.pricingTemporadas).all();
    return rows.map(toSeason);
  }

  async insertBand(row: BandRow): Promise<RateBand> {
    await this.db.insert(schema.pricingFranjas).values(row);
    return toBand(row);
  }

  async listBands(temporadaId: string): Promise<RateBand[]> {
    const rows = await this.db.select().from(schema.pricingFranjas).where(eq(schema.pricingFranjas.temporadaId, temporadaId)).all();
    return rows.map(toBand);
  }

  async listModalities(): Promise<Modality[]> {
    const rows = await this.db.select().from(schema.pricingModalidades).where(eq(schema.pricingModalidades.activa, true)).all();
    return rows.map(toModality);
  }

  async getModality(id: string): Promise<Modality | null> {
    const row = await this.db.select().from(schema.pricingModalidades).where(eq(schema.pricingModalidades.id, id)).get();
    return row ? toModality(row) : null;
  }

  async getModalityByCode(codigo: ModalityCode): Promise<Modality | null> {
    const row = await this.db.select().from(schema.pricingModalidades).where(eq(schema.pricingModalidades.codigo, codigo)).get();
    return row ? toModality(row) : null;
  }

  async insertModality(row: ModalityRow): Promise<Modality> {
    await this.db.insert(schema.pricingModalidades).values(row);
    return toModality(row);
  }

  async insertRate(row: RateRow): Promise<Rate> {
    await this.db.insert(schema.pricingTarifas).values(row);
    return toRate(row);
  }

  async findRate(franjaId: string, categoriaId: string, modalidadId: string): Promise<Rate | null> {
    const row = await this.db
      .select()
      .from(schema.pricingTarifas)
      .where(
        and(
          eq(schema.pricingTarifas.franjaId, franjaId),
          eq(schema.pricingTarifas.categoriaId, categoriaId),
          eq(schema.pricingTarifas.modalidadId, modalidadId),
        ),
      )
      .get();
    return row ? toRate(row) : null;
  }

  async insertNightScale(row: NightScaleRow): Promise<NightScaleEntry> {
    await this.db.insert(schema.pricingEscalaNoches).values(row);
    return toNightScale(row);
  }

  async findNightScale(modalidadId: string, categoriaId: string, noches: number): Promise<NightScaleEntry | null> {
    const row = await this.db
      .select()
      .from(schema.pricingEscalaNoches)
      .where(
        and(
          eq(schema.pricingEscalaNoches.modalidadId, modalidadId),
          eq(schema.pricingEscalaNoches.categoriaId, categoriaId),
          eq(schema.pricingEscalaNoches.noches, noches),
        ),
      )
      .get();
    return row ? toNightScale(row) : null;
  }

  async insertCharge(row: ChargeRow): Promise<Charge> {
    await this.db.insert(schema.pricingCargos).values(row);
    return toCharge(row);
  }

  async getCharge(codigo: ChargeCode): Promise<Charge | null> {
    const row = await this.db.select().from(schema.pricingCargos).where(eq(schema.pricingCargos.codigo, codigo)).get();
    return row ? toCharge(row) : null;
  }
}
