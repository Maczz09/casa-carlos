import type {
  Charge,
  ChargeCode,
  Modality,
  ModalityCode,
  NightScaleEntry,
  Rate,
  RateBand,
  ResolvedRate,
  Season,
} from "../entities/pricing.js";

export interface CreateSeasonInput {
  nombre: string;
  desde: string;
  hasta: string;
  prioridad?: number;
}

export interface CreateBandInput {
  temporadaId: string;
  horaInicio: string;
  etiqueta: string;
}

export interface CreateModalityInput {
  codigo: ModalityCode;
  nombre: string;
  duracionHoras: number;
  checkinFijo?: string | null;
  checkoutFijo?: string | null;
  toleranciaMin?: number;
}

export interface SetRateInput {
  franjaId: string;
  categoriaId: string;
  modalidadId: string;
  precioCentimos: number;
}

export interface SetNightScaleInput {
  modalidadId: string;
  categoriaId: string;
  noches: number;
  precioTotalCentimos: number;
}

export interface CreateChargeInput {
  codigo: ChargeCode;
  nombre: string;
  precioCentimos: number;
  unidad: "HORA" | "BLOQUE" | "FIJO";
}

export interface ResolveRateInput {
  categoriaId: string;
  modalidadId: string;
  at: Date;
}

/**
 * Public surface of `pricing`. Resolves what something costs right now;
 * never exposes raw rate rows to callers outside admin screens.
 */
export interface PricingPort {
  createSeason(input: CreateSeasonInput): Promise<Season>;
  listSeasons(): Promise<Season[]>;

  createBand(input: CreateBandInput): Promise<RateBand>;
  listBands(temporadaId: string): Promise<RateBand[]>;

  createModality(input: CreateModalityInput): Promise<Modality>;
  listModalities(): Promise<Modality[]>;
  getModality(id: string): Promise<Modality>;
  getModalityByCode(codigo: ModalityCode): Promise<Modality>;

  setRate(input: SetRateInput): Promise<Rate>;
  setNightScale(input: SetNightScaleInput): Promise<NightScaleEntry>;

  createCharge(input: CreateChargeInput): Promise<Charge>;
  getCharge(codigo: ChargeCode): Promise<Charge>;

  /** Resolves the band with midnight wraparound, then the rate for category × modality. */
  resolveRate(input: ResolveRateInput): Promise<ResolvedRate>;

  /** Total for `nights` nights (a lookup table, not `precio × n`). */
  resolveNightScalePrice(input: { modalidadId: string; categoriaId: string; noches: number }): Promise<number>;
}
