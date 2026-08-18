import PDFDocument from "pdfkit";
import type { Comprobante } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import type { EmisorInfo } from "./ubl.js";
import { buildQrPayload, qrPngBuffer } from "./qr.js";

const PAGE_WIDTH = 515;

function drawHeader(doc: PDFKit.PDFDocument, emisor: EmisorInfo, comprobante: Comprobante) {
  doc.fontSize(14).font("Helvetica-Bold").text(emisor.nombreComercial);
  doc.fontSize(9).font("Helvetica").text(emisor.razonSocial);
  doc.text(`RUC ${emisor.ruc}`);
  doc.text(`${emisor.direccion} — ${emisor.distrito}, ${emisor.provincia}, ${emisor.departamento}`);

  const boxTop = 40;
  const boxWidth = 170;
  const boxX = 40 + PAGE_WIDTH - boxWidth;
  doc.rect(boxX, boxTop, boxWidth, 55).stroke();
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(comprobante.tipo === "BOLETA" ? "BOLETA DE VENTA" : "FACTURA", boxX, boxTop + 8, { width: boxWidth, align: "center" })
    .text("ELECTRÓNICA", { width: boxWidth, align: "center" })
    .fontSize(12)
    .text(`${comprobante.serie}-${comprobante.correlativo}`, { width: boxWidth, align: "center" });

  doc.moveDown(1.5);
}

function drawParty(doc: PDFKit.PDFDocument, comprobante: Comprobante, fechaEmision: string) {
  doc.fontSize(9).font("Helvetica-Bold").text("Cliente / Receptor", 40, doc.y + 5);
  doc.font("Helvetica");
  doc.text(`${comprobante.receptorTipoDoc}: ${comprobante.receptorNumeroDoc}`);
  doc.text(comprobante.receptorRazonSocial);
  doc.text(`Fecha de emisión: ${fechaEmision}`);
  doc.moveDown(1);
}

function drawLines(doc: PDFKit.PDFDocument, comprobante: Comprobante) {
  const startX = 40;
  const colDescripcion = startX;
  const colCantidad = startX + 320;
  const colPrecio = startX + 370;
  const colImporte = startX + 445;
  const rowWidth = PAGE_WIDTH;

  let y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9);
  doc.text("Descripción", colDescripcion, y, { width: 270 });
  doc.text("Cant.", colCantidad, y, { width: 45, align: "right" });
  doc.text("P. Unit.", colPrecio, y, { width: 70, align: "right" });
  doc.text("Importe", colImporte, y, { width: 70, align: "right" });
  y += 14;
  doc
    .moveTo(startX, y)
    .lineTo(startX + rowWidth, y)
    .stroke();
  y += 4;

  doc.font("Helvetica").fontSize(9);
  for (const linea of comprobante.lineas) {
    doc.text(linea.descripcion, colDescripcion, y, { width: 270 });
    doc.text(String(linea.cantidad), colCantidad, y, { width: 45, align: "right" });
    doc.text(format(cents(linea.precioUnitarioCentimos)), colPrecio, y, { width: 70, align: "right" });
    doc.text(format(cents(linea.subtotalCentimos)), colImporte, y, { width: 70, align: "right" });
    y += 16;
  }
  doc.y = y + 6;
  doc
    .moveTo(startX, doc.y)
    .lineTo(startX + rowWidth, doc.y)
    .stroke();
  doc.moveDown(0.5);
}

function drawTotals(doc: PDFKit.PDFDocument, comprobante: Comprobante) {
  const labelX = 340;
  const valueX = 445;
  const width = 70;

  doc.fontSize(9).font("Helvetica");
  doc.text("Op. Gravada:", labelX, doc.y, { width: 100 });
  doc.text(format(cents(comprobante.valorVentaCentimos)), valueX, doc.y - 11, { width, align: "right" });
  doc.text("IGV (18%):", labelX, doc.y, { width: 100 });
  doc.text(format(cents(comprobante.igvCentimos)), valueX, doc.y - 11, { width, align: "right" });
  doc.font("Helvetica-Bold");
  doc.text("Importe Total:", labelX, doc.y, { width: 100 });
  doc.text(format(cents(comprobante.totalCentimos)), valueX, doc.y - 11, { width, align: "right" });
  doc.font("Helvetica").fontSize(8).moveDown(0.5);
  doc.text(comprobante.montoLetras, 40, doc.y, { width: PAGE_WIDTH });
  doc.moveDown(1);
}

async function drawFooter(doc: PDFKit.PDFDocument, comprobante: Comprobante, emisor: EmisorInfo, fechaEmision: string) {
  const qrPayload = buildQrPayload(comprobante, emisor.ruc, fechaEmision);
  const qrPng = await qrPngBuffer(qrPayload);
  const y = doc.y;
  doc.image(qrPng, 40, y, { width: 80, height: 80 });
  doc
    .fontSize(8)
    .font("Helvetica")
    .text(
      `Representación impresa de la ${comprobante.tipo === "BOLETA" ? "Boleta de Venta" : "Factura"} Electrónica. Consulte su validez en SUNAT-Consulta de comprobantes.`,
      130,
      y,
      { width: PAGE_WIDTH - 90 },
    );
  doc.text(
    comprobante.estadoSunat === "ACEPTADO" ? `Aceptado por SUNAT — Código ${comprobante.sunatCodigo ?? ""}` : `Estado ante SUNAT: ${comprobante.estadoSunat}`,
    130,
    doc.y + 4,
    { width: PAGE_WIDTH - 90 },
  );
}

/** PDF de cortesía para el huésped — el documento legal es el XML firmado + su CDR (`GET /api/billing/:id/xml`), no este PDF. */
export async function generateComprobantePdf(comprobante: Comprobante, emisor: EmisorInfo): Promise<Buffer> {
  const fechaEmision = comprobante.creadoEn.slice(0, 10);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  drawHeader(doc, emisor, comprobante);
  drawParty(doc, comprobante, fechaEmision);
  drawLines(doc, comprobante);
  drawTotals(doc, comprobante);
  await drawFooter(doc, comprobante, emisor, fechaEmision);

  doc.end();
  return done;
}
