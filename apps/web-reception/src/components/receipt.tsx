import type { ComprobantePago, SaleWithLines } from "@casacarlos/contracts";
import { cents, format, splitIncludedIgv } from "@casacarlos/money";
import { api, getToken } from "../api.js";
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
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Arma el HTML completo del ticket de 80mm como documento propio — se abre en
 * su propia ventana/pestaña (ver `printDraftReceipt`) en vez del truco viejo
 * de un div oculto + window.print() sobre la ventana de la app. Así el
 * navegador imprime un documento real y prolijo, con su tamaño de papel de
 * 80mm ya fijado, en vez de depender de que el CSS esconda el resto del panel
 * a tiempo.
 */
function buildDraftReceiptHtml(draft: DraftReceipt): string {
  const { sale, tipo, receptorRuc, receptorRazonSocial, fecha, cuarto } = draft;
  const brand = getBrand();
  const impuestos = splitIncludedIgv(cents(sale.totalCentimos));
  // La ventana de impresión se escribe sobre about:blank, así que una ruta
  // relativa al logo no resolvería: se arma absoluta contra este mismo servidor.
  const logo = brand.logoUrl ? `<img class="logo" src="${escapeHtml(window.location.origin + brand.logoUrl)}" alt="">` : "";

  const lineas = sale.lineas
    .map(
      (l) => `<tr><td>${l.cantidad > 1 ? `${l.cantidad}× ` : ""}${escapeHtml(l.descripcion)}</td><td>${format(cents(l.subtotalCentimos))}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${tipo === "BOLETA" ? "Boleta" : "Factura"} (borrador)</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 72mm;
    padding: 2mm;
    font-family: "Consolas", "Courier New", monospace;
    font-size: 11px;
    line-height: 1.35;
    font-weight: 700;
    color: #000;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  * {
    font-weight: 700 !important;
    box-sizing: border-box;
  }
  h2 { font-size: 13px; font-weight: 900 !important; text-align: center; margin: 0 0 2mm; }
  .logo { display: block; margin: 0 auto 1.5mm; max-width: 40mm; max-height: 18mm; }
  p { margin: 0 0 1mm; font-weight: 700 !important; }
  hr { border: none; border-top: 1.5px solid #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; font-weight: 700 !important; }
  td { padding: 0; vertical-align: top; font-weight: 700 !important; }
  td:last-child { text-align: right; white-space: nowrap; font-weight: 700 !important; }
  .center { text-align: center; }
  .tax td { padding-top: .8mm; font-weight: 700 !important; }
  .total { text-align: right; font-size: 14px; font-weight: 900 !important; }
</style>
</head>
<body>
  ${logo}
  <h2>${escapeHtml(brand.nombre.toUpperCase())}</h2>
  <p class="center">Comprobante de pago (BORRADOR)</p>
  <p class="center">Control interno — no válido como comprobante SUNAT</p>
  <hr>
  <p>${new Date(fecha).toLocaleString("es-PE")}</p>
  ${cuarto ? `<p>Cuarto: ${escapeHtml(cuarto)}</p>` : ""}
  ${sale.clienteNombres ? `<p>Cliente: ${escapeHtml(sale.clienteNombres)} ${escapeHtml(sale.clienteApellidos ?? "")}</p>` : ""}
  ${sale.clienteDni ? `<p>DNI: ${escapeHtml(sale.clienteDni)}</p>` : ""}
  ${tipo === "FACTURA" ? `<p>RUC: ${escapeHtml(receptorRuc ?? "")}</p><p>Razón social: ${escapeHtml(receptorRazonSocial ?? "")}</p>` : ""}
  <hr>
  <table><tbody>${lineas}</tbody></table>
  <hr>
  <table class="tax"><tbody>
    <tr><td>OP. GRAVADA</td><td>${format(impuestos.valorVenta)}</td></tr>
    <tr><td>IGV (18%)</td><td>${format(impuestos.igv)}</td></tr>
  </tbody></table>
  <p class="total">TOTAL ${format(cents(sale.totalCentimos))}</p>
  <hr>
  <p class="center">${tipo === "BOLETA" ? "BOLETA DE VENTA" : "FACTURA"}</p>
  <script>window.onload = () => setTimeout(() => window.print(), 80);</script>
</body>
</html>`;
}

/** Abre el ticket de 80mm en una ventana nueva y dispara la impresión ahí — nunca en la ventana de la app. */
function printDraftReceipt(draft: DraftReceipt): void {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return; // bloqueado por el navegador -- muy raro en un click directo, pero no revienta si pasa
  win.document.write(buildDraftReceiptHtml(draft));
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

  const [sale, pago] = await Promise.all([api.getSale(ventaId), api.comprobantePagoForSale(ventaId)]);
  printDraftReceipt({
    sale,
    tipo: pago?.tipo ?? "BOLETA",
    receptorRuc: pago?.receptorRuc,
    receptorRazonSocial: pago?.receptorRazonSocial,
    fecha: pago?.creadoEn ?? sale.creadoEn,
    cuarto,
  });
}

/** Igual que `printReceiptForSale`, pero partiendo de un ComprobantePago ya en mano (lista de Comprobantes) en vez de una venta suelta. */
export async function printComprobantePago(item: ComprobantePago): Promise<void> {
  if (item.estado === "EMITIDO" && item.comprobanteId) {
    await openComprobantePdf(item.comprobanteId);
    return;
  }
  const sale = await api.getSale(item.ventaId);
  printDraftReceipt({
    sale,
    tipo: item.tipo,
    receptorRuc: item.receptorRuc,
    receptorRazonSocial: item.receptorRazonSocial,
    fecha: item.creadoEn,
  });
}
