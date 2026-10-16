import { ModalFrame } from "@casacarlos/ui/components/modal-frame";
import { useEffect, useState } from "react";
import { formatDateTime12h } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api, type ShiftCuadreDto } from "../api.js";
import { printShiftClosureReceipt } from "./receipt.js";
import { Button, Notice, Row, Section, Skeleton } from "./ui.js";

export function CashReportDialog({ shiftId, onClose, onSale }: { shiftId: string; onClose: () => void; onSale: (id: string) => void }) {
  const [report, setReport] = useState<ShiftCuadreDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.shiftCuadre(shiftId).then((data) => { if (!cancelled) setReport(data); }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [shiftId]);
  return <ModalFrame title="Reporte detallado de caja" onClose={onClose} busy={false}>
    <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold text-ink">Reporte detallado de caja</h2><div className="flex gap-2"><Button onClick={() => printShiftClosureReceipt(shiftId)}>Imprimir</Button><Button autoFocus onClick={onClose}>Cerrar</Button></div></div>
      {error && <Notice kind="error">{error}</Notice>}
      {!report && !error && <Skeleton className="h-60" />}
      {report && <div className="space-y-4">
        {report.shift.tipoCierre === "AUTOMATICO" && <Notice kind="info">Relevo automático por horario. Se trasladó el fondo esperado al siguiente turno; no se declaró un conteo físico ni una diferencia de arqueo.</Notice>}
        <Section title={`${report.shift.fecha} · ${report.shift.estado}`}>
          <Row label="Abierto por" value={report.abiertoPor.nombre} />
          <Row label="Apertura" value={formatDateTime12h(report.shift.abiertoEn)} />
          {report.cerradoPor && <Row label="Cerrado por" value={report.cerradoPor.nombre} />}
          <Row label="Cobros menos anulaciones" value={format(cents(report.summary.ventasBrutasCentimos))} strong />
          <Row label="Efectivo esperado" value={format(cents(report.summary.efectivoEsperadoCentimos))} strong />
          <Row label="Efectivo declarado" value={report.shift.efectivoDeclaradoCentimos === null ? "Sin arqueo físico" : format(cents(report.shift.efectivoDeclaradoCentimos))} />
          <Row label="Vuelto entregado (incluido en el cobro neto)" value={format(cents(report.summary.vueltosCentimos))} />
          {report.summary.porMetodo.map((m) => <Row key={m.metodo} label={m.metodo} value={format(cents(m.totalCentimos))} />)}
        </Section>
        <Section title="Movimientos, responsables y motivos">
          {report.movimientos.map((m) => <div key={m.id} className="border-b border-line-soft py-3 text-sm">
            <Row label={`${m.tipo} · ${m.metodo ?? "Efectivo"} · ${m.usuarioNombre}`} value={`${["ANULACION", "DEVOLUCION", "EGRESO", "VUELTO"].includes(m.tipo) ? "−" : ""}${format(cents(m.montoCentimos))}`} />
            <p className="text-xs text-muted">{formatDateTime12h(m.ocurridoEn)}</p>
            {m.motivo && <p className="font-medium text-danger">Motivo: {m.motivo}</p>}
            {m.ventaId && <Button size="sm" variant="secondary" onClick={() => onSale(m.ventaId!)}>Ver venta</Button>}
          </div>)}
        </Section>
        <Section title="Ventas vinculadas y cobros de este turno">
          {report.ventasDetalle?.map((v) => <div key={v.ventaId} className="border-b border-line-soft py-3 text-sm">
            <p className="font-semibold text-ink">{v.serie}-{v.correlativo} · {v.cuartoNumero ? `Hab. ${v.cuartoNumero} · ` : ""}{v.clienteNombre} · {v.estado}</p>
            <Row label="Total completo de la venta" value={format(cents(v.totalCentimos))} />
            <Row label="Cobrado en este turno" value={format(cents(v.cobradoTurnoCentimos))} strong />
            <Row label="Anulado en este turno" value={format(cents(v.anuladoTurnoCentimos))} />
            <Row label="Devuelto en este turno" value={format(cents(v.devueltoTurnoCentimos))} />
            {[...v.horasExtra, ...v.productos, ...v.otrosCargos].map((l, i) => <Row key={i} label={l.descripcion} value={format(cents(l.subtotalCentimos))} />)}
            {v.cargosAnulados.map((l, i) => <p key={`anulado-${i}`} className="text-xs text-muted">Cargo anulado: {l.descripcion} · {format(cents(l.subtotalCentimos))} · {l.motivo}</p>)}
            {v.cobros.map((c, i) => <p key={i} className="text-xs text-muted">{c.usuarioNombre} · {c.metodo} · {format(cents(c.montoCentimos))} · Recibido {format(cents(c.recibidoCentimos ?? c.montoCentimos))} · Vuelto {format(cents(c.vueltoCentimos ?? 0))}{c.codigoOperacion ? ` · Operación ${c.codigoOperacion}` : ""}</p>)}
            <Button size="sm" onClick={() => onSale(v.ventaId)}>Ver historial completo</Button>
          </div>)}
        </Section>
      </div>}
    </div>
  </ModalFrame>;
}
