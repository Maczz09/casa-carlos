import { Checkbox } from "@casacarlos/ui/components/checkbox";
import { ModalFrame } from "@casacarlos/ui/components/modal-frame";
import { useEffect, useState } from "react";
import type { CheckoutPreview, CheckoutResult, PaymentDetailInput, PaymentWithDetails } from "@casacarlos/contracts";
import { formatDateTime12h } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { api } from "../api.js";
import { PaymentForm } from "./PaymentForm.js";
import { printReceiptForSale } from "./receipt.js";
import { Button, Field, Notice, Row, Textarea } from "./ui.js";

interface Props {
  stayId: string; roomNumber: string; horaSalida: string; retroactiva: boolean;
  onClose: () => void; onUpdated: () => Promise<void>; onCompleted: () => void;
}

const money = (amount: number) => format(cents(amount));

export function CheckoutDialog({ stayId, roomNumber, horaSalida, retroactiva, onClose, onUpdated, onCompleted }: Props) {
  const [waive, setWaive] = useState(retroactiva);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [pending, setPending] = useState<PaymentWithDetails | null>(null);
  const [reason, setReason] = useState("");
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setPreview(null);
    setRefundConfirmed(false);
    api.previewCheckOut(stayId, horaSalida, waive).then((p) => { if (active) setPreview(p); }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [stayId, horaSalida, waive, refresh]);

  useEffect(() => {
    if (!result) return;
    let active = true;
    api.paymentsForSale(result.venta.id).then((payments) => { if (active) setPending(payments.find((p) => p.estado === "PENDIENTE") ?? null); }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [result]);

  const act = async (operation: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la salida."); }
    finally { setBusy(false); }
  };

  const finish = async () => {
    await api.checkOut(stayId);
    onCompleted();
  };

  const acceptAndFinish = async (payment: PaymentWithDetails) => {
    await api.acceptPayment(payment.id);
    setPending(null);
    const venta = await api.getSale(payment.ventaId);
    setResult((r) => r && { ...r, venta });
    await onUpdated();
    void printReceiptForSale(venta.id, roomNumber);
    await finish();
  };

  const pay = (details: PaymentDetailInput[]) => act(async () => {
    if (!result) return;
    const payment = await api.createPayment(result.venta.id, details);
    setPending(payment);
    await acceptAndFinish(payment);
  });

  return <ModalFrame title="Revisar salida y cuenta" onClose={onClose} busy={busy}>
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4">
      <h2 id="checkout-title" className="text-lg font-bold text-ink">Revisar salida · Cuarto {roomNumber}</h2>
      <Row label="Hora real de salida" value={formatDateTime12h(horaSalida)} />
      {error && <Notice kind="error">{error}</Notice>}
      {!result ? <>
        <p className="text-sm text-muted">Al confirmar se fija esta hora para el cálculo. El tiempo que tome cobrar y cerrar la cuenta no agrega horas extra.</p>
        {retroactiva && <label className="flex gap-2 text-sm text-ink">
          <Checkbox checked={waive} disabled={busy} onCheckedChange={(checked) => { setWaive(checked === true); setError(null); }} />
          Anular las horas extra cargadas por la corrección de salida
        </label>}
        {retroactiva && <p className="text-xs text-muted">Si desmarcas esta opción, el exceso automático se recalcula hasta la hora elegida y las horas agregadas manualmente se conservan.</p>}
        {preview ? <>
          {preview.cambios.map((c, i) => <Row key={c.lineaId ?? i} label={c.descripcion} value={`${money(c.antesCentimos)} → ${money(c.despuesCentimos)}`} />)}
          <Row label="Total de la cuenta al salir" value={money(preview.totalDespuesCentimos)} strong />
          <Row label="Saldo por cobrar" value={money(preview.saldoDespuesCentimos)} strong />
          {preview.requiereConfirmacion && <Field label="Motivo de la corrección (obligatorio)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: el huésped salió antes y se registró la salida tarde" /></Field>}
          {preview.devolverCentimos > 0 && <div className="rounded-xl border border-line p-3 space-y-2">
            <p className="text-sm font-semibold text-ink">Hay que devolver {money(preview.devolverCentimos)} de horas ya cobradas.</p>
            {preview.devoluciones.map((d) => <Row key={d.metodo} label={d.metodo} value={money(d.montoCentimos)} />)}
            <p className="text-xs text-muted">Se registra en tu caja abierta por los métodos originales, con tu usuario y el motivo.</p>
            <label className="flex gap-2 text-sm text-ink"><Checkbox checked={refundConfirmed} disabled={busy} onCheckedChange={(checked) => setRefundConfirmed(checked === true)} />Confirmo que devolví estos importes al huésped.</label>
          </div>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => { setError(null); setRefresh((v) => v + 1); }}>Actualizar revisión</Button>
            <Button variant="primary" disabled={busy || (preview.requiereConfirmacion && !reason.trim()) || (preview.devolverCentimos > 0 && !refundConfirmed)} onClick={() => act(async () => {
              const updated = await api.confirmCheckOut(stayId, { horaSalida: preview.horaSalida, revision: preview.revision, anularHorasExtra: waive, motivo: reason, confirmarDevolucion: refundConfirmed });
              if (updated.finalizada) { onCompleted(); return; }
              setResult(updated);
              await onUpdated();
            })}>{preview.saldoDespuesCentimos > 0 ? "Confirmar salida y cobrar saldo" : "Confirmar y cerrar estadía"}</Button>
          </div>
        </> : <p className="text-sm text-muted">Calculando la cuenta para esta salida…</p>}
      </> : <>
        <Notice kind="warn">La salida quedó registrada. Completa el cobro para cerrar la estadía; las horas extra quedan fijadas a esa hora.</Notice>
        {pending ? <div className="space-y-3">
          <Row label="Pago pendiente" value={money(pending.totalCentimos)} />
          <Button variant="primary" disabled={busy} onClick={() => act(() => acceptAndFinish(pending))}>Aceptar pago pendiente y cerrar</Button>
          <Field label="Motivo para rechazar este pago"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <Button disabled={busy || !reason.trim()} onClick={() => act(async () => { await api.rejectPayment(pending.id, reason); setPending(null); })}>Rechazar pago y corregir método</Button>
        </div> : result.venta.saldoCentimos > 0 ? <PaymentForm totalCentimos={result.venta.saldoCentimos} busy={busy} onSubmit={pay} /> : <Button variant="primary" disabled={busy} onClick={() => act(finish)}>Completar checkout</Button>}
      </>}
      <Button block disabled={busy} onClick={onClose}>{result ? "Continuar luego" : "Volver"}</Button>
    </div>
  </ModalFrame>;
}
