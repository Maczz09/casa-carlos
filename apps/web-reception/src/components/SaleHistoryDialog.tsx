import { ModalFrame } from "@casacarlos/ui/components/modal-frame";
import { useEffect, useState } from "react";
import type { SaleHistory } from "@casacarlos/contracts";
import { formatDateTime12h } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api } from "../api.js";
import { Badge, Button, Notice, Row, Section, Skeleton } from "./ui.js";

const money = (value: number) => format(cents(value));
const auditSummary = (json: string | null): string => {
  if (!json) return "";
  try {
    const value = JSON.parse(json);
    return [value.descripcion, value.estado, value.cantidad != null ? `Cantidad: ${value.cantidad}` : null,
      ...["totalCentimos", "pagadoCentimos", "saldoCentimos", "subtotalCentimos"].filter((key) => typeof value[key] === "number").map((key) => `${({ totalCentimos: "Total", pagadoCentimos: "Cobrado", saldoCentimos: "Saldo", subtotalCentimos: "Importe" } as Record<string, string>)[key]}: ${money(value[key])}`),
      value.anulada != null ? (value.anulada ? "Cargo anulado" : "Cargo vigente") : null,
      value.horaSalida ? `Salida declarada: ${formatDateTime12h(value.horaSalida)}` : null,
      value.salidaDeclaradaEn ? `Salida declarada: ${formatDateTime12h(value.salidaDeclaradaEn)}` : null,
      value.checkoutPrevisto ? `Salida prevista: ${formatDateTime12h(value.checkoutPrevisto)}` : null,
      ...(Array.isArray(value.cambios) ? value.cambios.map((c: { descripcion: string; antesCentimos: number; despuesCentimos: number }) => `${c.descripcion}: ${money(c.antesCentimos)} → ${money(c.despuesCentimos)}`) : []),
      ...(Array.isArray(value.devoluciones) ? value.devoluciones.map((d: { metodo: string; montoCentimos: number }) => `Devuelto por ${d.metodo}: ${money(d.montoCentimos)}`) : []),
      value.checkoutReal ? `Salida: ${formatDateTime12h(value.checkoutReal)}` : null,
    ].filter(Boolean).join(" · ");
  } catch { return ""; }
};

export function SaleHistoryDialog({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [history, setHistory] = useState<SaleHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.saleHistory(saleId).then((result) => { if (!cancelled) setHistory(result); }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [saleId]);
  const sale = history?.venta;
  return <ModalFrame title="Detalle e historial de venta" onClose={onClose} busy={false}>
    <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Detalle de venta {sale ? `${sale.serie}-${sale.correlativo}` : ""}</h2>
        <Button autoFocus onClick={onClose}>Cerrar</Button>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      {!history && !error && <Skeleton className="h-60" />}
      {history && sale && <div className="space-y-4">
        <Section title={`${sale.cuartoNumero ? "Hab. " + sale.cuartoNumero + " · " : ""}${[sale.clienteNombres, sale.clienteApellidos].filter(Boolean).join(" ")}`}>
          <Badge tone={sale.estado === "ANULADA" ? "tone-red" : "tone-teal"}>{sale.estado}</Badge>
          <Row label="Total de la venta" value={money(sale.totalCentimos)} strong />
          <Row label="Cobros aceptados originales" value={money(history.pagos.filter((p) => p.estado === "ACEPTADO").reduce((sum, p) => sum + p.totalCentimos, 0))} />
          <Row label="Devoluciones registradas" value={money(history.movimientos.filter((m) => m.tipo === "DEVOLUCION").reduce((sum, m) => sum + m.montoCentimos, 0))} />
          <Row label="Anulaciones registradas" value={money(history.movimientos.filter((m) => m.tipo === "ANULACION").reduce((sum, m) => sum + m.montoCentimos, 0))} />
          <Row label="Neto de cobros en caja" value={money(history.movimientos.reduce((sum, m) => sum + (m.tipo === "VENTA" ? m.montoCentimos : ["ANULACION", "DEVOLUCION"].includes(m.tipo) ? -m.montoCentimos : 0), 0))} />
          <Row label="Saldo registrado" value={money(sale.saldoCentimos)} />
          {sale.cerradaEn && <Row label="Venta cerrada" value={formatDateTime12h(sale.cerradaEn)} />}
          {sale.motivoAnulacion && <Notice kind="warn">Anulada: {sale.motivoAnulacion}. La resta figura en los movimientos.</Notice>}
          {history.estadia && <>
            <Row label="Entrada" value={formatDateTime12h(history.estadia.checkinReal ?? history.estadia.checkinPrevisto)} />
            <Row label="Salida prevista" value={formatDateTime12h(history.estadia.checkoutPrevisto)} />
            <Row label="Tolerancia" value={`${history.estadia.toleranciaMin} min`} />
            {history.estadia.checkoutReal && <Row label="Salida real" value={formatDateTime12h(history.estadia.checkoutReal)} />}
          </>}
        </Section>
        <Section title="Hospedaje, adicionales y horas extra">
          {sale.lineas.map((line) => <div key={line.id} className="border-b border-line-soft py-2 text-sm">
            <Row label={`${line.descripcion}${line.anulada ? " (anulada)" : ""}`} value={money(line.subtotalCentimos)} />
            <p className="text-xs text-muted">{line.cantidad} × {money(line.precioUnitarioCentimos)} · {line.fase === "POST_PAGO" ? "Después del primer pago" : "Antes del primer pago"}{line.intervaloMinutos ? ` · Intervalo ${line.intervaloMinutos} min` : ""}</p>
            {line.motivoAnulacion && <p className="text-xs text-danger">Motivo: {line.motivoAnulacion}</p>}
          </div>)}
        </Section>
        <Section title="Historial de pagos">
          {!history.pagos.length && <p className="text-sm text-muted">Sin pagos registrados.</p>}
          {history.pagos.map((payment) => <div key={payment.id} className="mb-3 rounded-xl border border-line p-3 text-sm">
            <p className="font-semibold text-ink">{payment.estado} · {money(payment.totalCentimos)} · {payment.usuarioNombre}</p>
            <p className="text-xs text-muted">{formatDateTime12h(payment.aceptadoEn ?? payment.creadoEn)}</p>
            {payment.motivoRechazo && <p>Motivo del rechazo: {payment.motivoRechazo}</p>}
            {payment.detalles.map((d) => <div key={d.id} className="mt-2 border-t border-line-soft pt-2">
              <Row label={d.metodo} value={money(d.montoCentimos)} />
              {d.metodo === "EFECTIVO" && <p>Recibido: {money(d.recibidoCentimos ?? d.montoCentimos)} · Vuelto: {money(d.vueltoCentimos ?? 0)}</p>}
              {d.codigoOperacion && <p>Operación: {d.codigoOperacion}</p>}
              {d.bancoOrigen && <p>Banco: {d.bancoOrigen}</p>}
              {(d.ordenanteNombres || d.ordenanteApellidos) && <p>Ordenante: {[d.ordenanteNombres, d.ordenanteApellidos].filter(Boolean).join(" ")}</p>}
            </div>)}
          </div>)}
        </Section>
        <Section title="Movimientos por caja">
          {history.movimientos.map((m) => {
            const shift = history.turnos.find((s) => s.id === m.turnoId);
            return <div key={m.id} className="border-b border-line-soft py-2 text-sm">
              <Row label={`${m.tipo} · ${m.metodo ?? "Efectivo"} · ${m.usuarioNombre}`} value={`${m.tipo === "ANULACION" || m.tipo === "DEVOLUCION" || m.tipo === "VUELTO" ? "−" : "+"}${money(m.montoCentimos)}`} />
              <p className="text-xs text-muted">{formatDateTime12h(m.ocurridoEn)} · Caja abierta {shift ? formatDateTime12h(shift.abiertoEn) : m.turnoId} · {shift?.estado}</p>
              {m.motivo && <p className="text-xs text-danger">Motivo: {m.motivo}</p>}
            </div>;
          })}
        </Section>
        <Section title="Quién hizo cada operación">
          {history.auditoria.map((a) => <div key={a.id} className="border-b border-line-soft py-2 text-sm">
            <p className="font-semibold text-ink">{a.accion.replaceAll("_", " ")} · {a.usuarioNombre}</p>
            <p className="text-xs text-muted">{formatDateTime12h(a.ocurridoEn)}</p>
            {a.motivo && <p>Motivo: {a.motivo}</p>}
            {auditSummary(a.antesJson) && <p className="text-xs text-muted">Antes: {auditSummary(a.antesJson)}</p>}
            {auditSummary(a.despuesJson) && <p className="text-xs text-muted">Después: {auditSummary(a.despuesJson)}</p>}
          </div>)}
        </Section>
      </div>}
    </div>
  </ModalFrame>;
}
