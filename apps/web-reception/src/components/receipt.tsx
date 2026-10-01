import type { ComprobantePago, SaleWithLines, SunatEmisor } from "@casacarlos/contracts";
import { formatDateTime12h } from "@casacarlos/contracts";
import { api, getToken, type ShiftCuadreDto } from "../api.js";
import { getBrand } from "../hooks/useBrand.js";

/** Abre el PDF real que ya emitió SUNAT, en una pestaña nueva. */
export async function openComprobantePdf(comprobanteId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(api.comprobantePdfUrl(comprobanteId), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  window.open(URL.createObjectURL(await res.blob()), "_blank");
}

export interface DraftReceipt {
  sale: SaleWithLines;
  tipo: "BOLETA" | "FACTURA";
  receptorRuc?: string | null;
  receptorRazonSocial?: string | null;
  fecha: string;
  cuarto?: string | null;
  recepcionistaNombre?: string | null;
  emisor?: SunatEmisor | null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let cachedEmisor: SunatEmisor | null = null;
export async function getEmisorData(): Promise<SunatEmisor> {
  if (cachedEmisor) return cachedEmisor;
  try {
    cachedEmisor = await api.sunatEmisor();
    return cachedEmisor;
  } catch {
    return {
      ruc: "20600000000",
      razonSocial: "HOSPEDAJE CARLOS S.A.C.",
      nombreComercial: "HOSPEDAJE CARLOS",
      direccion: "Av. Principal 123",
      ubigeo: "150101",
      distrito: "Lima",
      provincia: "Lima",
      departamento: "Lima",
    };
  }
}

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  LEMON: "Lemon",
  AGORA: "Agora",
  TRANSFERENCIA: "Transferencia",
  POS_CREDITO: "POS crédito",
  POS_DEBITO: "POS débito",
};

/**
 * Arma el HTML completo del ticket de 80mm de comprobante/pre-cuenta:
 * - Logo centrado arriba y adaptado a 80mm
 * - Razón Social, Nombre Comercial, Dirección, RUC
 * - PRE-CUENTA y NO FISCAL / NO FISCAL
 * - Recepcionista, Habitación, Operación
 * - Para Boleta: SOLO DNI (sin nombre para máxima discreción)
 * - Para Factura: RUC y Razón Social
 * - Tabla de artículos, totales en S/
 * - Líneas de firma/completado manual
 * - Crédito al sistema base: Sistema base HotelFast
 */
function buildDraftReceiptHtml(draft: DraftReceipt): string {
  const { sale, tipo, receptorRuc, receptorRazonSocial, fecha, cuarto, recepcionistaNombre, emisor } = draft;
  const brand = getBrand();
  const razonSocial = emisor?.razonSocial || "HOSPEDAJE CARLOS";
  const nombreComercial = emisor?.nombreComercial || brand.nombre;
  const direccion = emisor?.direccion || "";
  const ruc = emisor?.ruc || "20600000000";

  const logo = brand.logoUrl ? `<img class="logo" src="${escapeHtml(window.location.origin + brand.logoUrl)}" alt="">` : "";
  const operacion = `${sale.serie}-${String(sale.correlativo).padStart(8, "0")}`;
  const recepcionista = recepcionistaNombre ? escapeHtml(recepcionistaNombre) : "Recepción";

  const lineas = sale.lineas
    .map(
      (l) => `
      <tr>
        <td colspan="4" class="desc">${escapeHtml(l.descripcion)}</td>
      </tr>
      <tr class="item-vals">
        <td></td>
        <td class="center">${l.cantidad}</td>
        <td class="right">${(l.precioUnitarioCentimos / 100).toFixed(2)}</td>
        <td class="right">${(l.subtotalCentimos / 100).toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const totalFormatted = (sale.totalCentimos / 100).toFixed(2);

  let docLine = "";
  if (tipo === "BOLETA") {
    // Por requerimiento expreso del cliente: para las boletas solo DNI (sin nombre) por discreción
    if (sale.clienteDni) {
      docLine = `<p>DOC: ${escapeHtml(sale.clienteDni)}</p>`;
    } else {
      docLine = `<p>DOC: -</p>`;
    }
  } else {
    if (receptorRuc) docLine += `<p>RUC: ${escapeHtml(receptorRuc)}</p>`;
    if (receptorRazonSocial) docLine += `<p>RAZON SOCIAL: ${escapeHtml(receptorRazonSocial)}</p>`;
  }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Pre-cuenta ${operacion}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 72mm;
    margin: 0 auto;
    padding: 3mm 2mm 5mm 2mm;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  * { box-sizing: border-box; font-weight: 700 !important; }
  .logo-wrap { text-align: center; margin-bottom: 2mm; }
  .logo { display: block; margin: 0 auto; max-width: 45mm; max-height: 20mm; object-fit: contain; }
  .company-info { text-align: center; margin-bottom: 2mm; }
  .company-title { font-size: 13px; font-weight: 900 !important; }
  .company-sub { font-size: 10px; margin-top: 1px; }
  .divider { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  .title-block { text-align: center; margin: 2mm 0; }
  .title-block .operacion { font-size: 11px; margin-bottom: 1px; }
  .title-block .pre-cuenta { font-size: 13px; font-weight: 900 !important; letter-spacing: 0.5px; }
  .title-block .no-fiscal { font-size: 10px; }
  .meta-info p { margin: 1px 0; font-size: 10px; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 1.5mm; font-size: 10.5px; }
  table.items th { border-bottom: 1px dashed #000; padding: 1mm 0; font-size: 10px; text-transform: uppercase; }
  table.items td { padding: 0.5mm 0; vertical-align: top; }
  .desc { font-weight: 700 !important; padding-top: 1mm !important; }
  .item-vals td { padding-bottom: 1mm !important; }
  .center { text-align: center; }
  .right { text-align: right; }
  .totals-block { margin-top: 2mm; font-size: 11px; }
  .totals-row { display: flex; justify-content: space-between; margin-bottom: 1mm; }
  .grand-total { font-size: 13px; font-weight: 900 !important; border-top: 1px dashed #000; padding-top: 1.5mm; margin-top: 1.5mm; }
  .blank-lines { margin-top: 4mm; font-size: 10.5px; line-height: 2.2; }
  .footer-credit { text-align: center; margin-top: 4mm; padding-top: 2mm; border-top: 1px dashed #000; font-size: 9.5px; }
</style>
</head>
<body>
  ${logo ? `<div class="logo-wrap">${logo}</div>` : ""}
  <div class="company-info">
    <div class="company-title">${escapeHtml(nombreComercial.toUpperCase())}</div>
    ${razonSocial && razonSocial !== nombreComercial ? `<div class="company-sub">${escapeHtml(razonSocial)}</div>` : ""}
    ${direccion ? `<div class="company-sub">${escapeHtml(direccion)}</div>` : ""}
    <div class="company-sub">RUC: ${escapeHtml(ruc)}</div>
  </div>
  <hr class="divider">
  <div class="title-block">
    <div class="operacion">Operación: ${escapeHtml(operacion)}</div>
    <div class="pre-cuenta">PRE-CUENTA</div>
    <div class="no-fiscal">NO FISCAL / NO FISCAL</div>
  </div>
  <div class="meta-info">
    <p>RECEPCIONISTA: ${recepcionista}</p>
    ${cuarto ? `<p>CUARTO: ${escapeHtml(cuarto)}</p>` : ""}
    ${docLine}
    <hr class="divider">
    <p>${formatDateTime12h(fecha)}</p>
    <hr class="divider">
  </div>
  <table class="items">
    <thead>
      <tr>
        <th style="text-align: left;">Artículo</th>
        <th class="center" style="width: 12mm;">Cant</th>
        <th class="right" style="width: 16mm;">P.U</th>
        <th class="right" style="width: 18mm;">Importe</th>
      </tr>
    </thead>
    <tbody>
      ${lineas}
    </tbody>
  </table>
  <hr class="divider">
  <div class="totals-block">
    <div class="totals-row">
      <span>Total Consumo:</span>
      <span>S/ ${totalFormatted}</span>
    </div>
    <div class="totals-row grand-total">
      <span>Total a pagar:</span>
      <span>S/ ${totalFormatted}</span>
    </div>
  </div>
  <div class="blank-lines">
    <div>RUC: _ _ _ _ _ _ _ _ _ _ _ _ _ _ _</div>
    <div>RAZON SOCIAL: _ _ _ _ _ _ _ _ _ _ _</div>
  </div>
  <div class="footer-credit">
    Sistema base HotelFast
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 80);</script>
</body>
</html>`;
}

/**
 * Genera el HTML del ticket térmico de 80mm para el Cuadre de Cierre de Caja
 * con auditoría completa (quién abrió, quién cerró, personal interviniente, etc.)
 */
export function buildShiftClosureReceiptHtml(cuadre: ShiftCuadreDto, impresoPorNombre: string): string {
  const { shift, plantilla, summary, abiertoPor, cerradoPor, intervinientes, emisor } = cuadre;
  const brand = getBrand();
  const logo = brand.logoUrl ? `<img class="logo" src="${escapeHtml(window.location.origin + brand.logoUrl)}" alt="">` : "";

  const nombreComercial = emisor.nombreComercial || brand.nombre;
  const razonSocial = emisor.razonSocial || "HOSPEDAJE CARLOS";
  const direccion = emisor.direccion || "";
  const ruc = emisor.ruc || "20600000000";

  const turnoNombre = plantilla ? `${plantilla.nombre} (${plantilla.horaInicio} - ${plantilla.horaFin})` : "Turno General";
  const fechaTurno = shift.fecha;
  const estadoTurno = shift.estado === "CERRADO" ? "CERRADO" : "ABIERTO";

  const aperturaMonto = (shift.aperturaCentimos / 100).toFixed(2);
  const ventasBrutas = (summary.ventasBrutasCentimos / 100).toFixed(2);
  const ingresos = (summary.ingresosManualesCentimos / 100).toFixed(2);
  const egresos = (summary.egresosManualesCentimos / 100).toFixed(2);
  const vueltos = (summary.vueltosCentimos / 100).toFixed(2);

  const esperado = (shift.efectivoEsperadoCentimos !== null ? shift.efectivoEsperadoCentimos / 100 : summary.efectivoEsperadoCentimos / 100).toFixed(2);
  const declarado = shift.efectivoDeclaradoCentimos !== null ? (shift.efectivoDeclaradoCentimos / 100).toFixed(2) : "—";
  const difCentimos = shift.diferenciaCentimos ?? 0;
  const difFormatted = (Math.abs(difCentimos) / 100).toFixed(2);
  const estadoCuadre = difCentimos === 0 ? "CUADRADO (S/ 0.00)" : difCentimos < 0 ? `FALTANTE (-S/ ${difFormatted})` : `SOBRANTE (+S/ ${difFormatted})`;

  const intervinientesHtml =
    intervinientes.length > 0
      ? intervinientes.map((u) => `<div class="row"><span>${escapeHtml(u.nombre)}</span><span>${u.operaciones} mov(s)</span></div>`).join("")
      : `<div class="sub-text">Solo usuario de apertura</div>`;

  const metodosHtml = summary.porMetodo
    .map((m) => {
      const label = METHOD_LABEL[m.metodo] ?? m.metodo;
      const total = (m.totalCentimos / 100).toFixed(2);
      return `<div class="row"><span>${escapeHtml(label)} (${m.cantidad}):</span><span>S/ ${total}</span></div>`;
    })
    .join("");

  let denominacionesHtml = "";
  if (shift.denominacionesCierre && Object.keys(shift.denominacionesCierre).length > 0) {
    const orden = ["20000", "10000", "5000", "2000", "1000", "500", "200", "100", "50", "20", "10"];
    const labels: Record<string, string> = {
      "20000": "Billete S/ 200",
      "10000": "Billete S/ 100",
      "5000": "Billete S/ 50",
      "2000": "Billete S/ 20",
      "1000": "Billete S/ 10",
      "500": "Moneda S/ 5",
      "200": "Moneda S/ 2",
      "100": "Moneda S/ 1",
      "50": "Moneda S/ 0.50",
      "20": "Moneda S/ 0.20",
      "10": "Moneda S/ 0.10",
    };
    const rows = orden
      .filter((k) => (shift.denominacionesCierre![k] ?? 0) > 0)
      .map((k) => {
        const cant = shift.denominacionesCierre![k]!;
        const sub = ((Number(k) * cant) / 100).toFixed(2);
        return `<div class="row"><span>${labels[k] || `S/ ${Number(k) / 100}`} x ${cant}</span><span>S/ ${sub}</span></div>`;
      });
    if (rows.length > 0) {
      denominacionesHtml = `
      <hr class="divider">
      <div class="section-heading">DESGLOSE DE ARQUEO EN CAJA:</div>
      ${rows.join("")}
      `;
    }
  }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Cuadre de Turno - ${fechaTurno}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 72mm;
    margin: 0 auto;
    padding: 3mm 2mm 5mm 2mm;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  * { box-sizing: border-box; font-weight: 700 !important; }
  .logo-wrap { text-align: center; margin-bottom: 2mm; }
  .logo { display: block; margin: 0 auto; max-width: 45mm; max-height: 20mm; object-fit: contain; }
  .company-info { text-align: center; margin-bottom: 2mm; }
  .company-title { font-size: 13px; font-weight: 900 !important; }
  .company-sub { font-size: 10px; margin-top: 1px; }
  .divider { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  .title-block { text-align: center; margin: 2mm 0; }
  .title-block .pre-cuenta { font-size: 13px; font-weight: 900 !important; }
  .title-block .no-fiscal { font-size: 10px; }
  .section-heading { font-size: 10.5px; font-weight: 900 !important; margin: 2mm 0 1mm 0; text-transform: uppercase; }
  .row { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 0.8mm; }
  .row.highlight { font-size: 11.5px; font-weight: 900 !important; border-top: 1px dashed #000; padding-top: 1mm; margin-top: 1mm; }
  .sub-text { font-size: 9.5px; margin: 0.8mm 0; }
  .signatures { margin-top: 8mm; text-align: center; font-size: 9.5px; }
  .sig-line { border-top: 1px solid #000; width: 85%; margin: 8mm auto 1mm auto; }
  .footer-credit { text-align: center; margin-top: 4mm; padding-top: 2mm; border-top: 1px dashed #000; font-size: 9.5px; }
</style>
</head>
<body>
  ${logo ? `<div class="logo-wrap">${logo}</div>` : ""}
  <div class="company-info">
    <div class="company-title">${escapeHtml(nombreComercial.toUpperCase())}</div>
    ${razonSocial && razonSocial !== nombreComercial ? `<div class="company-sub">${escapeHtml(razonSocial)}</div>` : ""}
    ${direccion ? `<div class="company-sub">${escapeHtml(direccion)}</div>` : ""}
    <div class="company-sub">RUC: ${escapeHtml(ruc)}</div>
  </div>
  <hr class="divider">
  <div class="title-block">
    <div class="pre-cuenta">CUADRE DE CIERRE DE CAJA</div>
    <div class="no-fiscal">DOCUMENTO DE CONTROL INTERNO (NO FISCAL)</div>
  </div>
  <hr class="divider">
  <div class="section-heading">DATOS DEL TURNO Y AUDITORIA:</div>
  <div class="row"><span>Turno:</span><span>${escapeHtml(turnoNombre)}</span></div>
  <div class="row"><span>Fecha:</span><span>${escapeHtml(fechaTurno)}</span></div>
  <div class="row"><span>Estado:</span><span>${escapeHtml(estadoTurno)}</span></div>
  <div class="sub-text"><b>Apertura:</b> ${formatDateTime12h(shift.abiertoEn)}</div>
  <div class="sub-text"><b>Abierto por:</b> ${escapeHtml(abiertoPor.nombre)}</div>
  ${
    shift.cerradoEn
      ? `
    <div class="sub-text"><b>Cierre:</b> ${formatDateTime12h(shift.cerradoEn)}</div>
    <div class="sub-text"><b>Cerrado por:</b> ${escapeHtml(cerradoPor?.nombre || "—")}</div>
  `
      : ""
  }
  <div class="sub-text"><b>Impreso por:</b> ${escapeHtml(impresoPorNombre)}</div>
  <div class="sub-text"><b>Fecha impresion:</b> ${formatDateTime12h(new Date().toISOString())}</div>

  <hr class="divider">
  <div class="section-heading">PERSONAL INTERVINIENTE EN CAJA:</div>
  ${intervinientesHtml}

  <hr class="divider">
  <div class="section-heading">RESUMEN DEL MOVIMIENTO:</div>
  <div class="row"><span>Fondo de apertura:</span><span>S/ ${aperturaMonto}</span></div>
  <div class="row"><span>Ventas brutas:</span><span>S/ ${ventasBrutas}</span></div>
  <div class="row"><span>Ingresos manuales:</span><span>+S/ ${ingresos}</span></div>
  <div class="row"><span>Egresos manuales:</span><span>-S/ ${egresos}</span></div>
  <div class="row"><span>Vueltos entregados:</span><span>-S/ ${vueltos}</span></div>

  <hr class="divider">
  <div class="section-heading">COBROS POR METODO DE PAGO:</div>
  ${metodosHtml}

  <hr class="divider">
  <div class="section-heading">CONCILIACION EN EFECTIVO:</div>
  <div class="row"><span>Efectivo esperado:</span><span>S/ ${esperado}</span></div>
  <div class="row"><span>Efectivo declarado:</span><span>${declarado !== "—" ? `S/ ${declarado}` : "—"}</span></div>
  <div class="row highlight">
    <span>Resultado cuadre:</span>
    <span>${estadoCuadre}</span>
  </div>
  ${shift.justificacion ? `<div class="sub-text" style="margin-top: 1.5mm;"><b>Justificación:</b> ${escapeHtml(shift.justificacion)}</div>` : ""}

  ${denominacionesHtml}

  <div class="signatures">
    <div class="sig-line"></div>
    <div>ENTREGUÉ CONFORME</div>
    <div>(Recepcionista Saliente)</div>

    <div class="sig-line" style="margin-top: 8mm;"></div>
    <div>RECIBÍ CONFORME</div>
    <div>(Recepcionista Entrante / Administración)</div>
  </div>

  <div class="footer-credit">
    Sistema base HotelFast
  </div>
  <script>window.onload = () => setTimeout(() => window.print(), 80);</script>
</body>
</html>`;
}

/** Abre el ticket de 80mm en una ventana nueva y dispara la impresión ahí. */
function printDraftReceipt(draft: DraftReceipt): void {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(buildDraftReceiptHtml(draft));
  win.document.close();
}

/**
 * Imprime el ticket de auditoría completa de cuadre de cierre de turno en 80mm.
 */
export async function printShiftClosureReceipt(shiftId: string, currentUser?: { nombres: string; apellidos: string } | null): Promise<void> {
  const cuadre = await api.shiftCuadre(shiftId);
  let impresoPor = currentUser ? `${currentUser.nombres} ${currentUser.apellidos}`.trim() : "";
  if (!impresoPor) {
    try {
      const u = await api.me();
      impresoPor = `${u.nombres} ${u.apellidos}`.trim();
    } catch {
      impresoPor = "Recepción";
    }
  }

  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(buildShiftClosureReceiptHtml(cuadre, impresoPor));
  win.document.close();
}

/**
 * Imprime lo que corresponda para una venta: si ya tiene comprobante SUNAT
 * aceptado abre su PDF real; si solo hay comprobante de pago (o ninguno)
 * imprime el borrador de 80mm en su propia ventana.
 */
export async function printReceiptForSale(ventaId: string, cuarto?: string | null): Promise<void> {
  const comprobante = await api.comprobanteForSale(ventaId);
  if (comprobante && comprobante.estadoSunat === "ACEPTADO") {
    await openComprobantePdf(comprobante.id);
    return;
  }

  const [sale, pago, emisor] = await Promise.all([api.getSale(ventaId), api.comprobantePagoForSale(ventaId), getEmisorData()]);

  let recepcionistaNombre: string | null = null;
  try {
    const me = await api.me();
    recepcionistaNombre = `${me.nombres} ${me.apellidos}`.trim();
  } catch {
    // ignore
  }

  printDraftReceipt({
    sale,
    tipo: pago?.tipo ?? "BOLETA",
    receptorRuc: pago?.receptorRuc,
    receptorRazonSocial: pago?.receptorRazonSocial,
    fecha: pago?.creadoEn ?? sale.creadoEn,
    cuarto,
    recepcionistaNombre,
    emisor,
  });
}

/** Igual que `printReceiptForSale`, pero partiendo de un ComprobantePago ya en mano. */
export async function printComprobantePago(item: ComprobantePago): Promise<void> {
  if (item.estado === "EMITIDO" && item.comprobanteId) {
    await openComprobantePdf(item.comprobanteId);
    return;
  }
  const [sale, emisor] = await Promise.all([api.getSale(item.ventaId), getEmisorData()]);

  let recepcionistaNombre: string | null = null;
  try {
    const me = await api.me();
    recepcionistaNombre = `${me.nombres} ${me.apellidos}`.trim();
  } catch {
    // ignore
  }

  printDraftReceipt({
    sale,
    tipo: item.tipo,
    receptorRuc: item.receptorRuc,
    receptorRazonSocial: item.receptorRazonSocial,
    fecha: item.creadoEn,
    recepcionistaNombre,
    emisor,
  });
}
