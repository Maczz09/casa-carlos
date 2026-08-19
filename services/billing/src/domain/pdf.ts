import PDFDocument from "pdfkit";
import type { Comprobante } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import type { EmisorInfo } from "./ubl.js";
import { buildQrPayload, qrPngBuffer } from "./qr.js";

/**
 * Representación impresa en formato térmico de 80mm — el mismo rollo que usa
 * el comprobante interno (ver apps/web-reception/src/components/receipt.tsx),
 * para que el hotel imprima todo en la misma impresora y no tenga que tener
 * hojas A4 al lado de la caja.
 *
 * 1 mm = 2.8346 pt. El papel es de 80mm pero el área imprimible real ronda los
 * 72mm: los cabezales dejan un margen muerto a cada lado, así que el contenido
 * se limita a eso aunque la página se declare de 80.
 */
const MM = 2.8346;
const PAGE_WIDTH = 80 * MM;
const MARGIN = 4 * MM;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Tipografía chica: en 72mm de ancho, cualquier cosa por encima de 8pt parte las descripciones en demasiadas líneas. */
const FONT_BASE = 7.5;
const FONT_TITULO = 10;

const LINE_GAP = 2;

function separador(doc: PDFKit.PDFDocument): void {
  doc.moveDown(0.3);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
    .dash(1.5, { space: 1.5 })
    .stroke()
    .undash();
  doc.moveDown(0.3);
}

/** Etiqueta a la izquierda y monto a la derecha en la misma línea — el patrón que se repite en todos los totales. */
function filaMonto(doc: PDFKit.PDFDocument, etiqueta: string, monto: string, negrita = false): void {
  const y = doc.y;
  doc.font(negrita ? "Helvetica-Bold" : "Helvetica");
  doc.text(etiqueta, MARGIN, y, { width: CONTENT_WIDTH * 0.55 });
  doc.text(monto, MARGIN + CONTENT_WIDTH * 0.55, y, { width: CONTENT_WIDTH * 0.45, align: "right" });
}

/** Alto de sobra para la pasada de medición — nunca se imprime, solo sirve para que nada se corte antes de saber el alto real. */
const ALTO_MEDICION = 2000 * MM;

function drawHeader(doc: PDFKit.PDFDocument, emisor: EmisorInfo, comprobante: Comprobante): void {
  const centrado = { width: CONTENT_WIDTH, align: "center" as const };
  doc.fontSize(FONT_TITULO).font("Helvetica-Bold").text(emisor.nombreComercial, MARGIN, MARGIN, centrado);
  doc.fontSize(FONT_BASE).font("Helvetica");
  if (emisor.razonSocial !== emisor.nombreComercial) doc.text(emisor.razonSocial, MARGIN, doc.y, centrado);
  doc.text(`RUC ${emisor.ruc}`, MARGIN, doc.y, centrado);
  doc.text(`${emisor.direccion}`, MARGIN, doc.y, centrado);
  doc.text(`${emisor.distrito}, ${emisor.provincia}, ${emisor.departamento}`, MARGIN, doc.y, centrado);

  separador(doc);

  doc.fontSize(FONT_BASE + 1).font("Helvetica-Bold");
  doc.text(comprobante.tipo === "BOLETA" ? "BOLETA DE VENTA ELECTRÓNICA" : "FACTURA ELECTRÓNICA", MARGIN, doc.y, centrado);
  doc.fontSize(FONT_TITULO).text(`${comprobante.serie}-${comprobante.correlativo}`, MARGIN, doc.y, centrado);
  doc.font("Helvetica").fontSize(FONT_BASE);

  separador(doc);
}

function drawParty(doc: PDFKit.PDFDocument, comprobante: Comprobante, fechaEmision: string): void {
  doc.fontSize(FONT_BASE).font("Helvetica");
  doc.text(`Fecha: ${fechaEmision}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.text(`${comprobante.receptorTipoDoc}: ${comprobante.receptorNumeroDoc}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.text(`Cliente: ${comprobante.receptorRazonSocial}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
  separador(doc);
}

/**
 * En 72mm no entran cuatro columnas legibles: cada ítem va en dos renglones
 * (descripción arriba; cantidad × precio a la izquierda e importe a la derecha
 * abajo), que es como imprimen los tickets de cualquier bodega.
 */
function drawLines(doc: PDFKit.PDFDocument, comprobante: Comprobante): void {
  doc.fontSize(FONT_BASE);
  for (const linea of comprobante.lineas) {
    doc.font("Helvetica").text(linea.descripcion, MARGIN, doc.y, { width: CONTENT_WIDTH });
    filaMonto(doc, `${linea.cantidad} x ${format(cents(linea.precioUnitarioCentimos))}`, format(cents(linea.subtotalCentimos)));
    doc.moveDown(0.2);
  }
  separador(doc);
}

function drawTotals(doc: PDFKit.PDFDocument, comprobante: Comprobante): void {
  doc.fontSize(FONT_BASE);
  filaMonto(doc, "Op. Gravada:", format(cents(comprobante.valorVentaCentimos)));
  filaMonto(doc, "IGV (18%):", format(cents(comprobante.igvCentimos)));
  doc.fontSize(FONT_BASE + 1.5);
  filaMonto(doc, "TOTAL:", format(cents(comprobante.totalCentimos)), true);
  doc.fontSize(FONT_BASE).font("Helvetica").moveDown(0.3);
  doc.text(comprobante.montoLetras, MARGIN, doc.y, { width: CONTENT_WIDTH });
  separador(doc);
}

function drawFooter(doc: PDFKit.PDFDocument, comprobante: Comprobante, qrPng: Buffer): void {
  const centrado = { width: CONTENT_WIDTH, align: "center" as const };
  // El QR es obligatorio en la representación impresa — centrado porque a lo
  // ancho de 72mm no hay lugar para ponerlo al lado del texto como en A4.
  const qrLado = 22 * MM;
  doc.image(qrPng, MARGIN + (CONTENT_WIDTH - qrLado) / 2, doc.y, { width: qrLado, height: qrLado });
  doc.y += qrLado + 4;

  doc.fontSize(FONT_BASE - 0.5).font("Helvetica");
  doc.text(
    `Representación impresa de la ${comprobante.tipo === "BOLETA" ? "Boleta de Venta" : "Factura"} Electrónica. Consulte su validez en SUNAT — Consulta de comprobantes.`,
    MARGIN,
    doc.y,
    centrado,
  );
  doc.moveDown(0.3);
  doc.text(
    comprobante.estadoSunat === "ACEPTADO" ? `Aceptado por SUNAT — Código ${comprobante.sunatCodigo ?? ""}` : `Estado ante SUNAT: ${comprobante.estadoSunat}`,
    MARGIN,
    doc.y,
    centrado,
  );
}

/** Dibuja el ticket entero. Se corre dos veces: una para medir, otra de verdad — ver `generateComprobantePdf`. */
function render(doc: PDFKit.PDFDocument, comprobante: Comprobante, emisor: EmisorInfo, fechaEmision: string, qrPng: Buffer): void {
  doc.lineGap(LINE_GAP);
  drawHeader(doc, emisor, comprobante);
  drawParty(doc, comprobante, fechaEmision);
  drawLines(doc, comprobante);
  drawTotals(doc, comprobante);
  drawFooter(doc, comprobante, qrPng);
}

function nuevoDoc(alto: number): PDFKit.PDFDocument {
  return new PDFDocument({ size: [PAGE_WIDTH, alto], margin: MARGIN });
}

/** PDF de cortesía para el huésped — el documento legal es el XML firmado + su CDR (`GET /api/billing/:id/xml`), no este PDF. */
export async function generateComprobantePdf(comprobante: Comprobante, emisor: EmisorInfo): Promise<Buffer> {
  const fechaEmision = comprobante.creadoEn.slice(0, 10);
  const qrPng = await qrPngBuffer(buildQrPayload(comprobante, emisor.ruc, fechaEmision));

  // El papel térmico es un rollo continuo: la "página" tiene que declararse
  // con el alto exacto del contenido. Si sobra, la impresora escupe papel en
  // blanco en cada comprobante; si falta, pdfkit abre una segunda página y el
  // ticket sale cortado al medio. Estimarlo por cantidad de líneas no alcanza
  // (una descripción larga envuelve y corre todo hacia abajo — pasó, salían 2
  // páginas), así que se dibuja una vez en una hoja larguísima solo para leer
  // dónde terminó, y recién ahí se dibuja el definitivo con ese alto.
  const medicion = nuevoDoc(ALTO_MEDICION);
  render(medicion, comprobante, emisor, fechaEmision, qrPng);
  const alto = medicion.y + MARGIN;
  medicion.end();

  const doc = nuevoDoc(alto);
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  render(doc, comprobante, emisor, fechaEmision, qrPng);

  doc.end();
  return done;
}
