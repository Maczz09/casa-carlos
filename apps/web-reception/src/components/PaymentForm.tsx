import { useState } from "react";
import type { PaymentDetailInput, PaymentMethod } from "@casacarlos/contracts";
import { cents, format, subtract, sum } from "@casacarlos/money";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  LEMON: "Lemon",
  AGORA: "Agora",
  TRANSFERENCIA: "Transferencia",
  POS_CREDITO: "POS crédito",
  POS_DEBITO: "POS débito",
};

interface Row {
  metodo: PaymentMethod;
  monto: string; // soles, as typed
  codigoOperacion: string;
  ordenanteNombres: string;
  ordenanteApellidos: string;
  bancoOrigen: string;
  recibido: string;
}

const emptyRow = (): Row => ({ metodo: "EFECTIVO", monto: "", codigoOperacion: "", ordenanteNombres: "", ordenanteApellidos: "", bancoOrigen: "", recibido: "" });

interface Props {
  totalCentimos: number;
  onSubmit: (detalles: PaymentDetailInput[]) => Promise<void>;
  busy: boolean;
  /** Lo que el cliente propuso desde el kiosco — solo prellena, recepción igual completa los códigos. */
  proposedSplit?: { metodo: string; montoCentimos: number }[] | null;
}

export function PaymentForm({ totalCentimos, onSubmit, busy, proposedSplit }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    proposedSplit && proposedSplit.length > 0
      ? proposedSplit.map((p) => ({ ...emptyRow(), metodo: p.metodo as PaymentMethod, monto: (p.montoCentimos / 100).toFixed(2) }))
      : [{ ...emptyRow(), monto: (totalCentimos / 100).toFixed(2) }],
  );
  const [error, setError] = useState<string | null>(null);

  const update = (idx: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const amounts = rows.map((r) => Math.round((Number(r.monto) || 0) * 100));
  const total = cents(totalCentimos);
  const entered = sum(amounts.map((a) => cents(a)));
  const diff = subtract(total, entered);

  const submit = async () => {
    setError(null);
    if (diff !== 0) {
      setError(`La suma de los métodos debe ser exactamente ${format(total)}.`);
      return;
    }
    const detalles: PaymentDetailInput[] = rows.map((r, i) => ({
      metodo: r.metodo,
      montoCentimos: amounts[i]!,
      codigoOperacion: r.codigoOperacion || null,
      ordenanteNombres: r.ordenanteNombres || null,
      ordenanteApellidos: r.ordenanteApellidos || null,
      bancoOrigen: r.bancoOrigen || null,
      recibidoCentimos: r.recibido ? Math.round(Number(r.recibido) * 100) : null,
    }));
    await onSubmit(detalles);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-lg bg-raised px-4 py-3">
        <span className="text-muted">Total a cobrar</span>
        <span className="text-xl font-semibold text-ink">{format(total)}</span>
      </div>

      {rows.map((row, idx) => (
        <div key={idx} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <select
              value={row.metodo}
              onChange={(e) => update(idx, { metodo: e.target.value as PaymentMethod })}
              className="flex-1 rounded-lg border border-line bg-raised px-2 py-1.5 text-ink"
            >
              {Object.entries(METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.10"
              value={row.monto}
              onChange={(e) => update(idx, { monto: e.target.value })}
              placeholder="Monto S/"
              className="w-28 rounded-lg border border-line bg-raised px-2 py-1.5 text-ink"
            />
            {rows.length > 1 && (
              <button onClick={() => removeRow(idx)} className="rounded-lg px-2 py-1 text-danger hover:bg-danger/10">
                ✕
              </button>
            )}
          </div>

          {row.metodo === "EFECTIVO" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="number"
                step="1"
                value={row.recibido}
                onChange={(e) => update(idx, { recibido: e.target.value })}
                placeholder="Recibido S/ (opcional)"
                className="w-40 rounded-lg border border-line bg-raised px-2 py-1 text-ink"
              />
              {row.recibido && Number(row.recibido) * 100 >= (amounts[idx] ?? 0) && (
                <span className="text-muted">Vuelto: {format(cents(Math.round(Number(row.recibido) * 100) - (amounts[idx] ?? 0)))}</span>
              )}
            </div>
          )}

          {(row.metodo === "YAPE" || row.metodo === "PLIN" || row.metodo === "LEMON" || row.metodo === "AGORA") && (
            <input
              value={row.codigoOperacion}
              onChange={(e) => update(idx, { codigoOperacion: e.target.value })}
              placeholder={row.metodo === "YAPE" ? "Código de 3 dígitos" : "Código de operación"}
              className="w-full rounded-lg border border-line bg-raised px-2 py-1.5 text-sm text-ink"
            />
          )}

          {row.metodo === "TRANSFERENCIA" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={row.codigoOperacion}
                onChange={(e) => update(idx, { codigoOperacion: e.target.value })}
                placeholder="ID de operación"
                className="rounded-lg border border-line bg-raised px-2 py-1.5 text-sm text-ink"
              />
              <input
                value={row.bancoOrigen}
                onChange={(e) => update(idx, { bancoOrigen: e.target.value })}
                placeholder="Banco origen"
                className="rounded-lg border border-line bg-raised px-2 py-1.5 text-sm text-ink"
              />
              <input
                value={row.ordenanteNombres}
                onChange={(e) => update(idx, { ordenanteNombres: e.target.value })}
                placeholder="Nombres del ordenante"
                className="rounded-lg border border-line bg-raised px-2 py-1.5 text-sm text-ink"
              />
              <input
                value={row.ordenanteApellidos}
                onChange={(e) => update(idx, { ordenanteApellidos: e.target.value })}
                placeholder="Apellidos del ordenante"
                className="rounded-lg border border-line bg-raised px-2 py-1.5 text-sm text-ink"
              />
            </div>
          )}

          {(row.metodo === "POS_CREDITO" || row.metodo === "POS_DEBITO") && (
            <input
              value={row.codigoOperacion}
              onChange={(e) => update(idx, { codigoOperacion: e.target.value })}
              placeholder="N.º de operación del voucher"
              className="w-full rounded-lg border border-line bg-raised px-2 py-1.5 text-sm text-ink"
            />
          )}
        </div>
      ))}

      <button onClick={addRow} className="self-start text-sm text-brand hover:opacity-80">
        + Combinar con otro método
      </button>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">Ingresado: {format(entered)}</span>
        {diff !== 0 && <span className="text-danger">Falta {format(diff)}</span>}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || diff !== 0}
        className="rounded-lg bg-brand py-2.5 font-medium text-brand-ink transition hover:bg-brand-hover disabled:opacity-50"
      >
        {busy ? "Registrando…" : "Registrar pago"}
      </button>
    </div>
  );
}
