import type { Db } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  CategoryRatesDto,
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
  UpdateModalityInput,
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

  async updateModality(id: string, input: UpdateModalityInput): Promise<Modality> {
    return this.repo.updateModality(id, {
      ...(input.nombre !== undefined && { nombre: input.nombre }),
      ...(input.duracionHoras !== undefined && { duracionHoras: input.duracionHoras }),
      ...(input.checkinFijo !== undefined && { checkinFijo: input.checkinFijo }),
      ...(input.checkoutFijo !== undefined && { checkoutFijo: input.checkoutFijo }),
      ...(input.toleranciaMin !== undefined && { toleranciaMin: input.toleranciaMin }),
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
    let rate = await this.repo.findRate(band.id, input.categoriaId, input.modalidadId);
    if (!rate) {
      const anyRate = (await this.repo.listAllRates()).find((r) => r.categoriaId === input.categoriaId);
      const fallbackPrice = anyRate ? anyRate.precioCentimos : 4000;
      rate = await this.repo.insertRate({
        id: newId(),
        franjaId: band.id,
        categoriaId: input.categoriaId,
        modalidadId: input.modalidadId,
        precioCentimos: fallbackPrice,
      });
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
    let entry = await this.repo.findNightScale(input.modalidadId, input.categoriaId, input.noches);
    if (!entry) {
      const oneNight = await this.repo.findNightScale(input.modalidadId, input.categoriaId, 1);
      const basePerNight = oneNight ? oneNight.precioTotalCentimos : 6000;
      entry = await this.repo.insertNightScale({
        id: newId(),
        modalidadId: input.modalidadId,
        categoriaId: input.categoriaId,
        noches: input.noches,
        precioTotalCentimos: basePerNight * input.noches,
      });
    }
    return entry.precioTotalCentimos;
  }

  async getCategoryRates(categoriaId: string): Promise<CategoryRatesDto | null> {
    const allRates = await this.repo.listAllRates();
    const allScales = await this.repo.listAllNightScales();
    const modalities = await this.repo.listModalities();

    const horasMod = modalities.find((m) => m.codigo === "HORAS_3");
    const nocheAMod = modalities.find((m) => m.codigo === "NOCHE_A");
    const nocheBMod = modalities.find((m) => m.codigo === "NOCHE_B");

    const horasRate = allRates.find((r) => r.categoriaId === categoriaId && (!horasMod || r.modalidadId === horasMod.id));
    const nocheAScale = allScales.find((s) => s.categoriaId === categoriaId && (!nocheAMod || s.modalidadId === nocheAMod.id) && s.noches === 1);
    const nocheBScale = allScales.find((s) => s.categoriaId === categoriaId && nocheBMod && s.modalidadId === nocheBMod.id && s.noches === 1);

    if (!horasRate && !nocheAScale) return null;

    return {
      categoriaId,
      precioHorasCentimos: horasRate?.precioCentimos ?? 4000,
      precioNocheCentimos: nocheAScale?.precioTotalCentimos ?? 6000,
      precioNocheBCentimos: nocheBScale?.precioTotalCentimos ?? (nocheAScale ? Math.max(1000, nocheAScale.precioTotalCentimos - 1000) : 5000),
    };
  }

  async listAllCategoryRates(): Promise<Record<string, CategoryRatesDto>> {
    const allRates = await this.repo.listAllRates();
    const allScales = await this.repo.listAllNightScales();
    const modalities = await this.repo.listModalities();

    const horasMod = modalities.find((m) => m.codigo === "HORAS_3");
    const nocheAMod = modalities.find((m) => m.codigo === "NOCHE_A");
    const nocheBMod = modalities.find((m) => m.codigo === "NOCHE_B");

    const categoryIds = new Set<string>();
    allRates.forEach((r) => categoryIds.add(r.categoriaId));
    allScales.forEach((s) => categoryIds.add(s.categoriaId));

    const result: Record<string, CategoryRatesDto> = {};
    for (const catId of categoryIds) {
      const horasRate = allRates.find((r) => r.categoriaId === catId && (!horasMod || r.modalidadId === horasMod.id));
      const nocheAScale = allScales.find((s) => s.categoriaId === catId && (!nocheAMod || s.modalidadId === nocheAMod.id) && s.noches === 1);
      const nocheBScale = allScales.find((s) => s.categoriaId === catId && nocheBMod && s.modalidadId === nocheBMod.id && s.noches === 1);

      result[catId] = {
        categoriaId: catId,
        precioHorasCentimos: horasRate?.precioCentimos ?? 4000,
        precioNocheCentimos: nocheAScale?.precioTotalCentimos ?? 6000,
        precioNocheBCentimos: nocheBScale?.precioTotalCentimos ?? (nocheAScale ? Math.max(1000, nocheAScale.precioTotalCentimos - 1000) : 5000),
      };
    }
    return result;
  }

  async setCategoryRates(input: CategoryRatesDto): Promise<void> {
    const seasons = await this.repo.listSeasons();
    let season = seasons.find((s) => s.activa) ?? seasons[0];
    if (!season) {
      season = await this.createSeason({ nombre: "Temporada general", desde: "2020-01-01", hasta: "2099-12-31", prioridad: 0 });
    }

    let bands = await this.repo.listBands(season.id);
    if (bands.length === 0) {
      const b1 = await this.createBand({ temporadaId: season.id, horaInicio: "10:00", etiqueta: "Mañana" });
      const b2 = await this.createBand({ temporadaId: season.id, horaInicio: "16:00", etiqueta: "Tarde" });
      const b3 = await this.createBand({ temporadaId: season.id, horaInicio: "23:00", etiqueta: "Noche" });
      bands = [b1, b2, b3];
    }

    let modalities = await this.repo.listModalities();
    let horasMod = modalities.find((m) => m.codigo === "HORAS_3");
    if (!horasMod) {
      horasMod = await this.createModality({ codigo: "HORAS_3", nombre: "Por horas", duracionHoras: 3, toleranciaMin: 15 });
    }
    let nocheAMod = modalities.find((m) => m.codigo === "NOCHE_A");
    if (!nocheAMod) {
      nocheAMod = await this.createModality({ codigo: "NOCHE_A", nombre: "Noche (check-in 19:00)", duracionHoras: 17, checkinFijo: "19:00", checkoutFijo: "12:00", toleranciaMin: 15 });
    }
    let nocheBMod = modalities.find((m) => m.codigo === "NOCHE_B");
    if (!nocheBMod) {
      nocheBMod = await this.createModality({ codigo: "NOCHE_B", nombre: "Noche (check-in 22:00)", duracionHoras: 14, checkinFijo: "22:00", checkoutFijo: "12:00", toleranciaMin: 15 });
    }

    // 1. Tarifa por horas en todas las franjas
    for (const b of bands) {
      await this.setRate({
        franjaId: b.id,
        categoriaId: input.categoriaId,
        modalidadId: horasMod.id,
        precioCentimos: input.precioHorasCentimos,
      });
    }

    // 2. Escala de noches para Noche A (1 a 30 noches)
    for (let n = 1; n <= 30; n++) {
      await this.setNightScale({
        modalidadId: nocheAMod.id,
        categoriaId: input.categoriaId,
        noches: n,
        precioTotalCentimos: input.precioNocheCentimos * n,
      });
    }

    // 3. Escala de noches para Noche B (1 a 30 noches)
    const precioB = input.precioNocheBCentimos ?? input.precioNocheCentimos;
    for (let n = 1; n <= 30; n++) {
      await this.setNightScale({
        modalidadId: nocheBMod.id,
        categoriaId: input.categoriaId,
        noches: n,
        precioTotalCentimos: precioB * n,
      });
    }
  }
}
