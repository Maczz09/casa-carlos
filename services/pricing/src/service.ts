import type { Db } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  Charge,
  ChargeCode,
  CreateBandInput,
  CreateChargeInput,
  CreateModalityInput,
  CreateSeasonInput,
  Modality,
  ModalityCode,
  NightScaleEntry,
  PricingPort,
  Rate,
  RateBand,
  ResolvedRate,
  ResolveRateInput,
  Season,
  SetNightScaleInput,
  SetRateInput,
} from "@casacarlos/contracts";
import { PricingRepo } from "./repo.js";
import { resolveBand, resolveSeason } from "./domain/resolve.js";

export class PricingService implements PricingPort {
  private readonly repo: PricingRepo;

  constructor(db: Db) {
    this.repo = new PricingRepo(db);
  }

  async createSeason(input: CreateSeasonInput): Promise<Season> {
    return this.repo.insertSeason({
      id: newId(),
      nombre: input.nombre,
      desde: input.desde,
      hasta: input.hasta,
      prioridad: input.prioridad ?? 0,
      activa: true,
    });
  }

  async listSeasons(): Promise<Season[]> {
    return this.repo.listSeasons();
  }

  async createBand(input: CreateBandInput): Promise<RateBand> {
    const existing = await this.repo.listBands(input.temporadaId);
    return this.repo.insertBand({
      id: newId(),
      temporadaId: input.temporadaId,
      horaInicio: input.horaInicio,
      orden: existing.length,
      etiqueta: input.etiqueta,
    });
  }

  async listBands(temporadaId: string): Promise<RateBand[]> {
    return this.repo.listBands(temporadaId);
  }

  async createModality(input: CreateModalityInput): Promise<Modality> {
    return this.repo.insertModality({
      id: newId(),
      codigo: input.codigo,
      nombre: input.nombre,
      duracionHoras: input.duracionHoras,
      checkinFijo: input.checkinFijo ?? null,
      checkoutFijo: input.checkoutFijo ?? null,
      toleranciaMin: input.toleranciaMin ?? 15,
      activa: true,
    });
  }

  async listModalities(): Promise<Modality[]> {
    return this.repo.listModalities();
  }

  async getModality(id: string): Promise<Modality> {
    const modality = await this.repo.getModality(id);
    if (!modality) throw new Error(`Modalidad ${id} no encontrada.`);
    return modality;
  }

  async getModalityByCode(codigo: ModalityCode): Promise<Modality> {
    const modality = await this.repo.getModalityByCode(codigo);
    if (!modality) throw new Error(`Modalidad ${codigo} no encontrada.`);
    return modality;
  }

  async setRate(input: SetRateInput): Promise<Rate> {
    return this.repo.insertRate({
      id: newId(),
      franjaId: input.franjaId,
      categoriaId: input.categoriaId,
      modalidadId: input.modalidadId,
      precioCentimos: input.precioCentimos,
    });
  }

  async setNightScale(input: SetNightScaleInput): Promise<NightScaleEntry> {
    return this.repo.insertNightScale({
      id: newId(),
      modalidadId: input.modalidadId,
      categoriaId: input.categoriaId,
      noches: input.noches,
      precioTotalCentimos: input.precioTotalCentimos,
    });
  }

  async createCharge(input: CreateChargeInput): Promise<Charge> {
    return this.repo.insertCharge({
      id: newId(),
      codigo: input.codigo,
      nombre: input.nombre,
      precioCentimos: input.precioCentimos,
      unidad: input.unidad,
      activo: true,
    });
  }

  async getCharge(codigo: ChargeCode): Promise<Charge> {
    const charge = await this.repo.getCharge(codigo);
    if (!charge) throw new Error(`Cargo ${codigo} no configurado.`);
    return charge;
  }

  async resolveRate(input: ResolveRateInput): Promise<ResolvedRate> {
    const seasons = await this.repo.listSeasons();
    const season = resolveSeason(seasons, input.at);
    const bands = await this.repo.listBands(season.id);
    const band = resolveBand(bands, input.at);
    const rate = await this.repo.findRate(band.id, input.categoriaId, input.modalidadId);
    if (!rate) {
      throw new Error(
        `No hay tarifa configurada para la franja "${band.etiqueta}" (${band.horaInicio}), categoría ${input.categoriaId} y modalidad ${input.modalidadId}.`,
      );
    }
    return {
      precioCentimos: rate.precioCentimos,
      temporadaId: season.id,
      franjaId: band.id,
      modalidadId: input.modalidadId,
      categoriaId: input.categoriaId,
    };
  }

  async resolveNightScalePrice(input: { modalidadId: string; categoriaId: string; noches: number }): Promise<number> {
    const entry = await this.repo.findNightScale(input.modalidadId, input.categoriaId, input.noches);
    if (!entry) {
      throw new Error(`No hay escala de precio para ${input.noches} noche(s) en esta modalidad y categoría.`);
    }
    return entry.precioTotalCentimos;
  }
}
