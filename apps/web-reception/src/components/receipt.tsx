import type { SaleWithLines } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api, getToken } from "../api.js";

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

/**
 * Ticket térmico de 80mm del comprobante de pago (borrador interno).
 * Se monta oculto y solo se ve al imprimir — el CSS de `.print-only-receipt`
 * en index.css esconde todo lo demás de la página.
 */
export function DraftReceiptMarkup({ draft }: { draft: DraftReceipt }) {
  const { sale, tipo, receptorRuc, receptorRazonSocial, fecha, cuarto } = draft;
  return (
    <div className="print-only-receipt hidden">
      <h2>CASA CARLOS</h2>
      <p className="receipt-center">Comprobante de pago (BORRADOR)</p>
      <p className="receipt-center">Control interno — no válido como comprobante SUNAT</p>
      <hr />
      <p>{new Date(fecha).toLocaleString("es-PE")}</p>
      {cuarto && <p>Cuarto: {cuarto}</p>}
      {sale.clienteNombres && (
        <p>
          Cliente: {sale.clienteNombres} {sale.clienteApellidos}
        </p>
      )}
      {sale.clienteDni && <p>DNI: {sale.clienteDni}</p>}
      {tipo === "FACTURA" && (
        <>
          <p>RUC: {receptorRuc}</p>
          <p>Razón social: {receptorRazonSocial}</p>
        </>
      )}
      <hr />
      <table>
        <tbody>
          {sale.lineas.map((l) => (
            <tr key={l.id}>
              <td>
                {l.cantidad > 1 ? `${l.cantidad}× ` : ""}
                {l.descripcion}
              </td>
              <td>{format(cents(l.subtotalCentimos))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <p className="receipt-total">TOTAL {format(cents(sale.totalCentimos))}</p>
      <hr />
      <p className="receipt-center">{tipo === "BOLETA" ? "BOLETA DE VENTA" : "FACTURA"}</p>
    </div>
  );
}

/**
 * Imprime lo que corresponda para una venta: si ya tiene comprobante SUNAT
 * aceptado abre su PDF; si solo hay comprobante de pago (o ninguno) prepara el
 * borrador de 80mm. Devuelve el borrador a montar, o `null` si abrió un PDF.
 */
export async function resolvePrintable(ventaId: string, cuarto?: string | null): Promise<DraftReceipt | null> {
  const comprobante = await api.comprobanteForSale(ventaId);
  if (comprobante && comprobante.estadoSunat === "ACEPTADO") {
    await openComprobantePdf(comprobante.id);
    return null;
  }

  const [sale, pago] = await Promise.all([api.getSale(ventaId), api.comprobantePagoForSale(ventaId)]);
  return {
    sale,
    tipo: pago?.tipo ?? "BOLETA",
    receptorRuc: pago?.receptorRuc,
    receptorRazonSocial: pago?.receptorRazonSocial,
    fecha: pago?.creadoEn ?? sale.creadoEn,
    cuarto,
  };
}
