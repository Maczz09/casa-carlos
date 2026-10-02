import type { CashboxPort, IdentityPort, InventoryPort, PaymentsPort, PricingPort, RoomsPort } from "@casacarlos/contracts";

const HORAS_PRICES = {
  matrimonial: { manana: 4000, tarde: 5000, noche: 6000 },
  doble: { manana: 5000, tarde: 6000, noche: 7000 },
};

const NOCHE_A_SCALE = {
  matrimonial: [9500, 18500, 27000],
  doble: [11000, 21000, 30500],
};

const NOCHE_B_SCALE = {
  matrimonial: [8500, 16500, 24000],
  doble: [10000, 19000, 27500],
};

/** Garantiza que existan las 3 modalidades, temporadas, franjas horarias y cargos en cualquier base de datos (incluso si ya tenía cuartos). */
export async function ensurePricingDefaults(pricing: PricingPort, rooms: RoomsPort): Promise<void> {
  const modalities = await pricing.listModalities();
  const existingCodes = new Set(modalities.map((m) => m.codigo));

  let modalidadHoras = modalities.find((m) => m.codigo === "HORAS_3");
  if (!modalidadHoras) {
    try {
      modalidadHoras = await pricing.getModalityByCode("HORAS_3");
    } catch {
      modalidadHoras = await pricing.createModality({
        codigo: "HORAS_3",
        nombre: "Por horas",
        duracionHoras: 3,
        toleranciaMin: 15,
        precioAdicionalCentimos: 1000,
        tiempoAdicionalMinutos: 60,
      });
    }
  }

  let modalidadNocheA = modalities.find((m) => m.codigo === "NOCHE_A");
  if (!modalidadNocheA) {
    try {
      modalidadNocheA = await pricing.getModalityByCode("NOCHE_A");
    } catch {
      modalidadNocheA = await pricing.createModality({
        codigo: "NOCHE_A",
        nombre: "Día — check-in 14:00",
        duracionHoras: 20,
        checkinFijo: "14:00",
        checkoutFijo: "10:00",
        toleranciaMin: 15,
        precioAdicionalCentimos: 1000,
        tiempoAdicionalMinutos: 60,
      });
    }
  }

  let modalidadNocheB = modalities.find((m) => m.codigo === "NOCHE_B");
  if (!modalidadNocheB) {
    try {
      modalidadNocheB = await pricing.getModalityByCode("NOCHE_B");
    } catch {
      modalidadNocheB = await pricing.createModality({
        codigo: "NOCHE_B",
        nombre: "Noche — check-in 20:00",
        duracionHoras: 12,
        checkinFijo: "20:00",
        checkoutFijo: "08:00",
        toleranciaMin: 15,
        precioAdicionalCentimos: 1000,
        tiempoAdicionalMinutos: 60,
      });
    }
  }

  const seasons = await pricing.listSeasons();
  let temporada = seasons.find((s) => s.activa) ?? seasons[0];
  if (!temporada) {
    temporada = await pricing.createSeason({
      nombre: "Temporada general",
      desde: "2020-01-01",
      hasta: "2099-12-31",
      prioridad: 0,
    });
  }

  let bandas = await pricing.listBands(temporada.id);
  if (bandas.length === 0) {
    const bandaManana = await pricing.createBand({ temporadaId: temporada.id, horaInicio: "10:00", etiqueta: "Mañana" });
    const bandaTarde = await pricing.createBand({ temporadaId: temporada.id, horaInicio: "16:00", etiqueta: "Tarde" });
    const bandaNoche = await pricing.createBand({ temporadaId: temporada.id, horaInicio: "23:00", etiqueta: "Noche" });
    bandas = [bandaManana, bandaTarde, bandaNoche];
  }

  const categories = await rooms.listCategories();
  for (const cat of categories) {
    const existingRates = await pricing.getCategoryRates(cat.id);
    if (!existingRates) {
      for (const banda of bandas) {
        await pricing.setRate({
          franjaId: banda.id,
          categoriaId: cat.id,
          modalidadId: modalidadHoras.id,
          precioCentimos: 4000,
        });
      }
      await pricing.setNightScale({ modalidadId: modalidadNocheA.id, categoriaId: cat.id, noches: 1, precioTotalCentimos: 9500 });
      await pricing.setNightScale({ modalidadId: modalidadNocheA.id, categoriaId: cat.id, noches: 2, precioTotalCentimos: 18500 });
      await pricing.setNightScale({ modalidadId: modalidadNocheA.id, categoriaId: cat.id, noches: 3, precioTotalCentimos: 27000 });

      await pricing.setNightScale({ modalidadId: modalidadNocheB.id, categoriaId: cat.id, noches: 1, precioTotalCentimos: 8500 });
      await pricing.setNightScale({ modalidadId: modalidadNocheB.id, categoriaId: cat.id, noches: 2, precioTotalCentimos: 16500 });
      await pricing.setNightScale({ modalidadId: modalidadNocheB.id, categoriaId: cat.id, noches: 3, precioTotalCentimos: 24000 });
    }
  }

  try {
    await pricing.getCharge("EARLY_CHECKIN");
  } catch {
    await pricing.createCharge({ codigo: "EARLY_CHECKIN", nombre: "Check-in anticipado", precioCentimos: 500, unidad: "HORA" });
  }
  try {
    await pricing.getCharge("EXCESO");
  } catch {
    await pricing.createCharge({ codigo: "EXCESO", nombre: "Exceso de tiempo", precioCentimos: 2000, unidad: "FIJO" });
  }
  try {
    await pricing.getCharge("EXTENSION_3H");
  } catch {
    await pricing.createCharge({ codigo: "EXTENSION_3H", nombre: "Extensión de 3 horas", precioCentimos: 4000, unidad: "BLOQUE" });
  }
}

/** Garantiza que existan las 3 plantillas de turnos solicitadas por Carlos en cualquier base de datos. */
export async function ensureCashboxDefaults(cashbox: CashboxPort): Promise<void> {
  const templates = await cashbox.listShiftTemplates();
  if (templates.length === 0) {
    await cashbox.createShiftTemplate({ nombre: "Turno Mañana", horaInicio: "09:00", horaFin: "17:00" });
    await cashbox.createShiftTemplate({ nombre: "Turno Tarde", horaInicio: "17:00", horaFin: "01:00" });
    await cashbox.createShiftTemplate({ nombre: "Turno Noche", horaInicio: "01:00", horaFin: "09:00" });
  }
}

/** Populates a fresh database with enough real data to run the reception screen end to end. */
export async function seedIfEmpty(
  rooms: RoomsPort,
  pricing: PricingPort,
  identity: IdentityPort,
  payments: PaymentsPort,
  inventory: InventoryPort,
  cashbox: CashboxPort,
): Promise<void> {
  const existingFloors = await rooms.listFloors();
  if (existingFloors.length > 0) {
    // Si ya existían cuartos/pisos, de todas formas nos aseguramos de que existan modalidades y turnos
    await ensurePricingDefaults(pricing, rooms);
    await ensureCashboxDefaults(cashbox);
    return;
  }

  console.log("[seed] base de datos vacía — cargando datos iniciales…");

  const ventilador = await rooms.createAttribute("Ventilador");

  const matrimonial = await rooms.createCategory({
    nombre: "Matrimonial con ventilador",
    descripcion: "Cama matrimonial, baño privado, agua caliente, TV cable, ventilador de techo.",
    camas: 1,
    atributoIds: [ventilador.id],
  });
  const doble = await rooms.createCategory({
    nombre: "Doble sin ventilador",
    descripcion: "Dos camas personales, baño privado, agua caliente, TV cable.",
    camas: 2,
  });

  const piso2 = await rooms.createFloor({ numero: 2, nombre: "Segundo piso", orden: 1 });
  const piso3 = await rooms.createFloor({ numero: 3, nombre: "Tercer piso", orden: 2 });

  const layout: Array<{ numero: string; pisoId: string; categoriaId: string }> = [
    { numero: "201", pisoId: piso2.id, categoriaId: matrimonial.id },
    { numero: "202", pisoId: piso2.id, categoriaId: matrimonial.id },
    { numero: "203", pisoId: piso2.id, categoriaId: doble.id },
    { numero: "204", pisoId: piso2.id, categoriaId: doble.id },
    { numero: "301", pisoId: piso3.id, categoriaId: matrimonial.id },
    { numero: "302", pisoId: piso3.id, categoriaId: matrimonial.id },
    { numero: "303", pisoId: piso3.id, categoriaId: matrimonial.id },
    { numero: "304", pisoId: piso3.id, categoriaId: doble.id },
    { numero: "305", pisoId: piso3.id, categoriaId: doble.id },
  ];
  for (const room of layout) {
    await rooms.createRoom({ ...room, incluye: "Toallas, jabón, papel higiénico, control remoto de TV y ventilador (si aplica)." });
  }

  const modalidadHoras = await pricing.createModality({
    codigo: "HORAS_3",
    nombre: "Por horas",
    duracionHoras: 3,
    toleranciaMin: 15,
    precioAdicionalCentimos: 1000,
    tiempoAdicionalMinutos: 60,
  });
  const modalidadNocheA = await pricing.createModality({
    codigo: "NOCHE_A",
    nombre: "Día — check-in 14:00",
    duracionHoras: 20,
    checkinFijo: "14:00",
    checkoutFijo: "10:00",
    toleranciaMin: 15,
    precioAdicionalCentimos: 1000,
    tiempoAdicionalMinutos: 60,
  });
  const modalidadNocheB = await pricing.createModality({
    codigo: "NOCHE_B",
    nombre: "Noche — check-in 20:00",
    duracionHoras: 12,
    checkinFijo: "20:00",
    checkoutFijo: "08:00",
    toleranciaMin: 15,
    precioAdicionalCentimos: 1000,
    tiempoAdicionalMinutos: 60,
  });

  const temporada = await pricing.createSeason({ nombre: "Temporada general", desde: "2020-01-01", hasta: "2099-12-31", prioridad: 0 });
  const bandaManana = await pricing.createBand({ temporadaId: temporada.id, horaInicio: "10:00", etiqueta: "Mañana" });
  const bandaTarde = await pricing.createBand({ temporadaId: temporada.id, horaInicio: "16:00", etiqueta: "Tarde" });
  const bandaNoche = await pricing.createBand({ temporadaId: temporada.id, horaInicio: "23:00", etiqueta: "Noche" });

  const bandas = [bandaManana, bandaTarde, bandaNoche];
  const bandaKeys = ["manana", "tarde", "noche"] as const;
  for (const categoria of [
    { id: matrimonial.id, prices: HORAS_PRICES.matrimonial },
    { id: doble.id, prices: HORAS_PRICES.doble },
  ]) {
    for (let i = 0; i < bandas.length; i++) {
      await pricing.setRate({
        franjaId: bandas[i]!.id,
        categoriaId: categoria.id,
        modalidadId: modalidadHoras.id,
        precioCentimos: categoria.prices[bandaKeys[i]!],
      });
    }
  }

  for (const [categoriaId, scale] of [
    [matrimonial.id, NOCHE_A_SCALE.matrimonial],
    [doble.id, NOCHE_A_SCALE.doble],
  ] as const) {
    for (let idx = 0; idx < scale.length; idx++) {
      await pricing.setNightScale({ modalidadId: modalidadNocheA.id, categoriaId, noches: idx + 1, precioTotalCentimos: scale[idx]! });
    }
  }
  for (const [categoriaId, scale] of [
    [matrimonial.id, NOCHE_B_SCALE.matrimonial],
    [doble.id, NOCHE_B_SCALE.doble],
  ] as const) {
    for (let idx = 0; idx < scale.length; idx++) {
      await pricing.setNightScale({ modalidadId: modalidadNocheB.id, categoriaId, noches: idx + 1, precioTotalCentimos: scale[idx]! });
    }
  }

  await pricing.createCharge({ codigo: "EARLY_CHECKIN", nombre: "Check-in anticipado", precioCentimos: 500, unidad: "HORA" });
  await pricing.createCharge({ codigo: "EXCESO", nombre: "Exceso de tiempo", precioCentimos: 2000, unidad: "FIJO" });
  await pricing.createCharge({ codigo: "EXTENSION_3H", nombre: "Extensión de 3 horas", precioCentimos: 4000, unidad: "BLOQUE" });

  const admin = await identity.createUser({ usuario: "admin", password: "admin123", pin: "0000", nombres: "Administrador", apellidos: "Hospedaje Carlos", rol: "ADMIN" });
  await identity.createUser({
    usuario: "recepcion",
    password: "recepcion123",
    pin: "1234",
    nombres: "Recepción",
    apellidos: "Turno 1",
    rol: "RECEPCIONISTA",
  });

  await payments.createCollectionAccount({
    tipo: "BANCO",
    proveedor: "BCP",
    titular: "Hospedaje Carlos S.A.C.",
    numeroCuenta: "194-1234567-0-89",
    cci: "00219400123456789012",
    orden: 0,
  }, admin.id);
  await payments.createCollectionAccount({ tipo: "BILLETERA", proveedor: "YAPE", titular: "Hospedaje Carlos", telefono: "999 888 777", orden: 1 }, admin.id);
  await payments.createCollectionAccount({ tipo: "BILLETERA", proveedor: "PLIN", titular: "Hospedaje Carlos", telefono: "999 888 777", orden: 2 }, admin.id);

  const catBebidas = await inventory.createCategory({ nombre: "Bebidas" });
  const catSnacks = await inventory.createCategory({ nombre: "Snacks" });
  const catHigiene = await inventory.createCategory({ nombre: "Higiene" });

  await inventory.createProduct({ codigoBarras: "7750182001019", nombre: "Agua San Luis 625ml", categoriaId: catBebidas.id, precioCentimos: 300, costoCentimos: 150, stockInicial: 30, stockMinimo: 8, usuarioId: admin.id });
  await inventory.createProduct({ codigoBarras: "7750182002016", nombre: "Inca Kola 500ml", categoriaId: catBebidas.id, precioCentimos: 500, costoCentimos: 250, stockInicial: 24, stockMinimo: 6, usuarioId: admin.id });
  await inventory.createProduct({ codigoBarras: "7750182003013", nombre: "Cerveza Pilsen 650ml", categoriaId: catBebidas.id, precioCentimos: 1200, costoCentimos: 700, stockInicial: 18, stockMinimo: 6, usuarioId: admin.id });
  await inventory.createProduct({ codigoBarras: "7750182004010", nombre: "Papas Lays", categoriaId: catSnacks.id, precioCentimos: 600, costoCentimos: 300, stockInicial: 20, stockMinimo: 5, usuarioId: admin.id });
  await inventory.createProduct({ codigoBarras: "7750182005017", nombre: "Preservativos (unidad)", categoriaId: catHigiene.id, precioCentimos: 500, costoCentimos: 200, stockInicial: 40, stockMinimo: 10, usuarioId: admin.id });

  await ensureCashboxDefaults(cashbox);

  console.log(
    "[seed] listo: 2 pisos, 9 cuartos, 3 modalidades, tarifas, cuentas de cobro, 5 productos, plantillas de turno y usuarios.",
  );
}
