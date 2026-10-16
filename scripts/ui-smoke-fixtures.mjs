// Datos sintéticos: el navegador intercepta toda API y reemplaza los WebSockets.
export const now = new Date().toISOString();
export const permissions = ['BOARD_VIEW','SALES_MANAGE','RESERVATIONS_MANAGE','CASHBOX_MANAGE','INVENTORY_MANAGE','CATEGORIES_MANAGE','ROOMS_MANAGE','BILLING_MANAGE','DASHBOARD_VIEW','REPORTS_EXPORT','NOTIFICATIONS_MANAGE','SETTINGS_MANAGE','USERS_MANAGE'];
export const user = { id: 'ui-admin', usuario: 'prueba', nombres: 'Ana', apellidos: 'Recepción', rol: 'ADMIN', activo: true, permisos: permissions, telefonoWhatsapp: null, creadoEn: now };
export const otherUser = { ...user, id: 'ui-recepcion', usuario: 'recepcion', nombres: 'Luis', apellidos: 'Turno', rol: 'RECEPCIONISTA' };
export const brand = { nombre: 'Hospedaje Carlos', lema: 'Recepción y atención al huésped', logoUrl: null };
export const theme = { autoEnabled: false, startTime: '18:00', endTime: '06:00', manualTheme: 'light' };
export const category = { id: 'cat', nombre: 'Matrimonial', descripcion: 'Cama doble y ventilador', camas: 1, ventiladores: 1, atributoIds: [], activo: true };
export const floor = { id: 'floor', numero: 1, nombre: 'Primer piso', orden: 1, activo: true };
export const rooms = [101,102,103].map((number, index) => ({ id: `room-${number}`, numero: String(number), pisoId: floor.id, categoriaId: category.id, descripcion: 'Habitación de prueba', incluye: null, fueraDeServicio: false, motivoFueraServicio: null, limpiezaHasta: null, activo: true, creadoEn: now }));
export const floors = [{ floor, semaforo: 'VERDE', rooms: rooms.map((room, index) => ({ room, estado: ['DISPONIBLE','OCUPADO','EXCEDIDO'][index], clienteNombre: index ? 'Lucía Pérez' : null, stayId: index ? `stay-${room.numero}` : null, desocupaEn: index ? new Date(Date.now() + (index === 1 ? 3600000 : -3600000)).toISOString() : null, limpiezaHasta: null })) }];
export const modality = { id: 'mod', codigo: 'HORAS_3', nombre: 'Tres horas', duracionHoras: 3, checkinFijo: null, checkoutFijo: null, toleranciaMin: 15, precioAdicionalCentimos: 1000, tiempoAdicionalMinutos: 60, bloqueoDiaCompleto: false, activo: true };
export const stay = { id: 'stay-102', cuartoId: 'room-102', clienteId: 'client', modalidadId: modality.id, tipo: 'DIRECTA', estado: 'EN_CURSO', bloques: 1, noches: 1, reservadaPara: null, checkinReal: now, checkoutPrevisto: new Date(Date.now()+3600000).toISOString(), checkoutReal: null, salidaDeclaradaEn: null, bloqueoDesde: now, bloqueoHasta: new Date(Date.now()+3600000).toISOString(), usuarioId: user.id, creadoEn: now, cliente: { id: 'client', nombres: 'Lucía', apellidos: 'Pérez', dni: '12345678', telefono: null } };
export const sale = { id: 'sale', serie: 'V001', correlativo: 42, tipo: 'VENTA', estado: 'PAGADA', estadiaId: stay.id, cuartoId: 'room-102', cuartoNumero: '102', clienteNombres: 'Lucía', clienteApellidos: 'Pérez', clienteDni: '12345678', totalCentimos: 7000, pagadoCentimos: 7000, saldoCentimos: 0, usuarioId: user.id, pagadaEn: now, cerradaEn: null, motivoAnulacion: null, creadoEn: now,
  lineas: [{ id: 'lodging', ventaId: 'sale', tipo: 'HOSPEDAJE', referenciaId: modality.id, descripcion: 'Hospedaje · Tres horas', cantidad: 1, precioUnitarioCentimos: 6000, subtotalCentimos: 6000, fase: 'PRE_PAGO', anulada: false, motivoAnulacion: null, usuarioId: user.id, creadoEn: now }, { id: 'extra', ventaId: 'sale', tipo: 'CARGO_EXTRA', referenciaId: 'HORA_EXTRA_MANUAL', intervaloMinutos: 60, descripcion: 'Hora extra manual', cantidad: 1, precioUnitarioCentimos: 1000, subtotalCentimos: 1000, fase: 'POST_PAGO', anulada: false, motivoAnulacion: null, usuarioId: user.id, creadoEn: now }] };
export const shift = { id: 'shift', plantillaId: null, usuarioId: user.id, usuarioAperturaId: user.id, fecha: now.slice(0,10), estado: 'ABIERTO', aperturaCentimos: 10000, abiertoEn: now, cerradoEn: null, usuarioCierreId: null, efectivoEsperadoCentimos: null, efectivoDeclaradoCentimos: null, diferenciaCentimos: null, justificacion: null };
export const summary = { aperturaCentimos: 10000, ventasBrutasCentimos: 7000, valorVentaCentimos: 5932, igvCentimos: 1068, ingresosManualesCentimos: 0, egresosManualesCentimos: 0, ajustesCentimos: 0, vueltosCentimos: 0, efectivoEsperadoCentimos: 17000, porMetodo: [{ metodo: 'EFECTIVO', totalCentimos: 7000, cantidad: 1 }] };
export const totals = { ventasCentimos: 7000, cantidadVentas: 1, cuartosAlquilados: 1, ticketPromedioCentimos: 7000, ocupacionPct: 33 };
export const report = { rango: { desde: now.slice(0,10), hasta: now.slice(0,10) }, comparativa: { actual: totals, anterior: { ...totals, ventasCentimos: 0 }, variacionVentasPct: null, variacionCuartosPct: 0 }, ocupacionPorPiso: [{ pisoId: floor.id, pisoNombre: floor.nombre, cuartosAlquilados: 1 }], ocupacionPorCategoria: [{ categoriaId: category.id, categoriaNombre: category.nombre, cuartosAlquilados: 1, ingresosCentimos: 7000 }], ingresosPorModalidad: [{ modalidadId: modality.id, modalidadNombre: modality.nombre, cantidad: 1, ingresosCentimos: 7000 }], ventasPorRecepcionista: [{ usuarioId: user.id, nombre: 'Ana Recepción', cantidadVentas: 1, totalCentimos: 7000 }], rankingProductos: [], ingresosPorMetodo: [{ metodo: 'EFECTIVO', cantidad: 1, totalCentimos: 7000 }], cargosExtra: [{ codigo: 'HORA_EXTRA_MANUAL', nombre: 'Horas extra', cantidad: 1, totalCentimos: 1000 }], horasPico: [], serieTemporal: [{ fecha: now.slice(0,10), ventasCentimos: 7000, igvCentimos: 1068, cantidadVentas: 1 }] };
export const productCategory = { id: 'drink', nombre: 'Bebidas', descripcion: 'Bebidas del hospedaje', activo: true };
export const product = { id: 'water', nombre: 'Agua', descripcion: 'Botella de agua', categoriaId: productCategory.id, categoriaNombre: productCategory.nombre, precioCentimos: 300, costoCentimos: 150, stock: 12, stockMinimo: 3, estado: 'ACTIVO', activo: true, imagenes: [], creadoEn: now };
export const session = { id: 'session', estado: 'SELECCION_PISO', modalidadId: modality.id, bloques: 1, noches: 1, pisoId: floor.id, cuartoId: 'room-101', preciosPorCategoria: { cat: 6000 }, totalCentimos: 6000, ventaId: 'sale', lineas: sale.lineas, actorControl: 'CLIENTE', creadoEn: now };
export const preview = { estadiaId: stay.id, ventaId: sale.id, horaSalida: now, revision: 'revision-ui', anularHorasExtra: true, requiereConfirmacion: true, totalAntesCentimos: 7000, totalDespuesCentimos: 6000, saldoAntesCentimos: 0, saldoDespuesCentimos: 0, devolverCentimos: 1000, devoluciones: [{ metodo: 'EFECTIVO', montoCentimos: 1000 }], cambios: [{ lineaId: 'extra', descripcion: 'Hora extra manual', antesCentimos: 1000, despuesCentimos: 0 }] };
export const saleHistory = { venta: { ...sale, estado: 'CERRADA', cerradaEn: now }, estadia: stay, pagos: [], movimientos: [], turnos: [shift], auditoria: [{ id: 'audit', entidad: 'VENTA', entidadId: sale.id, accion: 'CERRAR_CHECKOUT', usuarioId: user.id, usuarioNombre: 'Ana Recepción', ocurridoEn: now, motivo: 'Salida revisada', antesJson: null, despuesJson: null }] };

export function responseFor(url, method = 'GET', payload = {}) {
  const p = url.pathname;
  if (p === '/api/me') return user;
  if (p === '/api/auth/login') return { user, token: 'ui-test' };
  if (p === '/api/brand') return brand;
  if (p === '/api/brand/theme') return theme;
  if (p === '/api/users') return [user, otherUser];
  if (p === '/api/rooms/board') return floors;
  if (p === '/api/rooms/categories') return [category];
  if (p === '/api/rooms/floors') return [floor];
  if (p === '/api/rooms' || p === '/api/rooms/all') return rooms;
  if (p === '/api/pricing/modalities') return [modality];
  if (p === '/api/pricing/category-rates') return { cat: { categoriaId: 'cat', precioHorasCentimos: 6000, precioNocheCentimos: 10000, precioNocheBCentimos: 12000 } };
  if (p === '/api/pricing/resolve') return { precioCentimos: 6000, precioAdicionalCentimos: 1000, origen: 'CATEGORIA' };
  if (p === '/api/inventory/categories') return [productCategory];
  if (p === '/api/inventory/products') return [product];
  if (p === '/api/cashbox/shifts/mine' || p === '/api/cashbox/shifts/current') return shift;
  if (p === '/api/cashbox/shifts/legacy') return [];
  if (p === '/api/cashbox/automation') return { habilitado: true, zonaHoraria: 'America/Lima', horarioValido: true, problema: null, proximoCambio: null };
  if (p === '/api/cashbox/shifts') return [shift];
  if (p === '/api/cashbox/summary' || p.endsWith('/summary')) return summary;
  if (p.endsWith('/cuadre')) return { shift, plantilla: null, summary, abiertoPor: { id: user.id, nombre: 'Ana Recepción' }, cerradoPor: null, intervinientes: [], movimientos: [], ventasDetalle: [], emisor: { razonSocial: brand.nombre, ruc: '20100000000' } };
  if (p === '/api/reporting/dashboard') return report;
  if (p === '/api/notifications/whatsapp/status') return { status: 'DESCONECTADO', qr: null };
  if (p === '/api/sales' || p === '/api/sales/by-range') return [sale];
  if (p.includes('/sales/for-stay/')) return sale;
  if (p.endsWith('/history')) return saleHistory;
  if (p === '/api/sales/sale') return sale;
  if (p === '/api/stays' || p === '/api/stays/active') return [stay];
  if (p.startsWith('/api/stays/stay-')) return stay;
  if (p.includes('/check-out-preview/')) return { ...preview, horaSalida: payload.horaSalida, anularHorasExtra: payload.anularHorasExtra };
  if (p.includes('/check-out-confirm/')) return { finalizada: true, estadia: { ...stay, estado: 'FINALIZADA' }, venta: { ...sale, estado: 'CERRADA' } };
  if (p.startsWith('/api/billing/for-sale/') || p.startsWith('/api/billing/comprobante-pago/for-sale/')) return null;
  if (p === '/api/sunat/emisor') return { razonSocial: brand.nombre, ruc: '20100000000', direccion: 'Dirección de prueba' };
  if (p === '/api/sunat/config') return {
    modo: 'MOCK', modoActivo: 'MOCK', endpoint: null, listoParaEmitir: true, faltantes: [],
    emisor: { razonSocial: brand.nombre, ruc: '20100000000', nombreComercial: brand.nombre, direccion: 'Dirección de prueba', ubigeo: '150101', distrito: 'Lima', provincia: 'Lima', departamento: 'Lima' },
    certificado: { presente: false, ruta: null, passwordConfigurada: false, titular: null, emisor: null, validoDesde: null, validoHasta: null, vencido: false, error: null },
    solUser: '', solPasswordConfigurada: false,
  };
  return method === 'GET' ? [] : { ok: true };
}
