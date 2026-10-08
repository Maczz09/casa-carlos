import { useEffect, useMemo, useState } from "react";
import type { CollectionAccount, PaymentDetailInput, PaymentMethod } from "@casacarlos/contracts";
import { cents, format, subtract, sum } from "@casacarlos/money";
import { prepareCelebrationAudio } from "@casacarlos/ui";
import { api } from "../api.js";
import { cx } from "./ui.js";

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
  denominaciones?: Record<string, number>;
}

/**
 * Efectivo y POS no dependen de ninguna cuenta: la plata se recibe en el
 * mostrador o en el terminal del banco. Las billeteras y la transferencia sí —
 * solo se ofrecen si el hotel cargó ese canal en Ajustes → Cobros.
 */
const METODOS_SIN_CUENTA: PaymentMethod[] = ["EFECTIVO", "POS_CREDITO", "POS_DEBITO"];

const BILLETES_PERU = [
  { centimos: 20000, label: "S/ 200", bg: "hover:bg-purple-500/20 border-purple-500/30 text-purple-300" },
  { centimos: 10000, label: "S/ 100", bg: "hover:bg-sky-500/20 border-sky-500/30 text-sky-300" },
  { centimos: 5000, label: "S/ 50", bg: "hover:bg-rose-500/20 border-rose-500/30 text-rose-300" },
  { centimos: 2000, label: "S/ 20", bg: "hover:bg-amber-500/20 border-amber-500/30 text-amber-300" },
  { centimos: 1000, label: "S/ 10", bg: "hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300" },
] as const;

const MONEDAS_PERU = [
  { centimos: 500, label: "S/ 5" },
  { centimos: 200, label: "S/ 2" },
  { centimos: 100, label: "S/ 1" },
  { centimos: 50, label: "S/ 0.50" },
  { centimos: 20, label: "S/ 0.20" },
  { centimos: 10, label: "S/ 0.10" },
] as const;

function sumDenominaciones(denominaciones?: Record<string, number>): number {
  if (!denominaciones) return 0;
  return Object.entries(denominaciones).reduce((acc, [centimosStr, cant]) => acc + Number(centimosStr) * (cant || 0), 0);
}

function desglosarVuelto(vueltoCentimos: number): string {
  if (vueltoCentimos <= 0) return "";
  const orden = [
    { valor: 20000, nombre: "billete de S/ 200", plural: "billetes de S/ 200" },
    { valor: 10000, nombre: "billete de S/ 100", plural: "billetes de S/ 100" },
    { valor: 5000, nombre: "billete de S/ 50", plural: "billetes de S/ 50" },
    { valor: 2000, nombre: "billete de S/ 20", plural: "billetes de S/ 20" },
    { valor: 1000, nombre: "billete de S/ 10", plural: "billetes de S/ 10" },
    { valor: 500, nombre: "moneda de S/ 5", plural: "monedas de S/ 5" },
    { valor: 200, nombre: "moneda de S/ 2", plural: "monedas de S/ 2" },
    { valor: 100, nombre: "moneda de S/ 1", plural: "monedas de S/ 1" },
    { valor: 50, nombre: "moneda de S/ 0.50", plural: "monedas de S/ 0.50" },
    { valor: 20, nombre: "moneda de S/ 0.20", plural: "monedas de S/ 0.20" },
    { valor: 10, nombre: "moneda de S/ 0.10", plural: "monedas de S/ 0.10" },
  ];

  let restante = vueltoCentimos;
  const partes: string[] = [];
  for (const item of orden) {
    if (restante >= item.valor) {
      const cant = Math.floor(restante / item.valor);
      restante = restante % item.valor;
      partes.push(`${cant} ${cant === 1 ? item.nombre : item.plural}`);
    }
  }

  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0]!;
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function getSugerenciasMonto(montoCentimos: number): number[] {
  if (montoCentimos <= 0) return [1000, 2000, 5000, 10000, 20000];
  const list = new Set<number>();
  const proxDecena = Math.ceil(montoCentimos / 1000) * 1000;
  if (proxDecena > montoCentimos && proxDecena <= 20000) {
    list.add(proxDecena);
  }
  const billetes = [1000, 2000, 5000, 10000, 20000];
  for (const b of billetes) {
    if (b > montoCentimos) {
      list.add(b);
    }
  }
  return Array.from(list).sort((a, b) => a - b).slice(0, 4);
}

const emptyRow = (): Row => ({
  metodo: "EFECTIVO",
  monto: "",
  codigoOperacion: "",
  ordenanteNombres: "",
  ordenanteApellidos: "",
  bancoOrigen: "",
  recibido: "",
  denominaciones: {},
});

interface Props {
  totalCentimos: number;
  onSubmit: (detalles: PaymentDetailInput[]) => Promise<void>;
  busy: boolean;
  /** Lo que el cliente propuso desde el kiosco — solo prellena, recepción igual completa los códigos. */
  proposedSplit?: { metodo: string; montoCentimos: number }[] | null;
}

export function PaymentForm({ totalCentimos, onSubmit, busy, proposedSplit }: Props) {
  const [accounts, setAccounts] = useState<CollectionAccount[] | null>(null);
  const [rows, setRows] = useState<Row[]>(() =>
    proposedSplit && proposedSplit.length > 0
      ? proposedSplit.map((p) => ({ ...emptyRow(), metodo: p.metodo as PaymentMethod, monto: (p.montoCentimos / 100).toFixed(2) }))
      : [{ ...emptyRow(), monto: (totalCentimos / 100).toFixed(2) }],
  );
  const [error, setError] = useState<string | null>(null);
  const proposalSignature = (proposedSplit ?? []).map((item) => `${item.metodo}:${item.montoCentimos}`).join("|");

  // La propuesta llega por WebSocket después de que el formulario de
  // Recepción ya puede estar abierto. Sin este efecto React conservaba la
  // primera fila (por defecto efectivo) aunque el huésped eligiera Yape,
  // transferencia o una combinación desde el kiosco.
  useEffect(() => {
    if (proposedSplit && proposedSplit.length > 0) {
      setRows(proposedSplit.map((proposal) => ({ ...emptyRow(), metodo: proposal.metodo as PaymentMethod, monto: (proposal.montoCentimos / 100).toFixed(2) })));
    } else {
      setRows([{ ...emptyRow(), monto: (totalCentimos / 100).toFixed(2) }]);
    }
    setError(null);
    // La firma evita reiniciar los códigos que Recepción ya está escribiendo
    // ante un mensaje de sesión que no cambia los métodos propuestos.
  }, [proposalSignature, totalCentimos]);

  useEffect(() => {
    api
      .collectionAccounts()
      .then((cuentas) => setAccounts(cuentas.filter((c) => c.activa)))
      .catch(() => setAccounts([]));
  }, []);

  // Notifica en tiempo real al kiosco cuál método de pago está seleccionando recepción
  useEffect(() => {
    const methodToSend = rows.length > 1 ? "HIBRIDO" : (rows[0]?.metodo ?? "EFECTIVO");
    const detallesToSend = rows.map((r) => ({
      metodo: r.metodo,
      montoCentimos: Math.round((Number(r.monto) || 0) * 100),
    }));
    void api.setKioskPaymentMethod(methodToSend, detallesToSend).catch(() => {});
  }, [rows]);


  /**
   * Mientras las cuentas no llegan se ofrecen todos los métodos: es preferible
   * mostrar uno de más que bloquear un cobro por una lista que todavía no cargó.
   */
  const metodos = useMemo<PaymentMethod[]>(() => {
    if (accounts === null) return Object.keys(METHOD_LABEL) as PaymentMethod[];
    const conCuenta = accounts.map((c) => c.metodo);
    const propuestos = rows.map((r) => r.metodo);
    return (Object.keys(METHOD_LABEL) as PaymentMethod[]).filter(
      (m) => METODOS_SIN_CUENTA.includes(m) || conCuenta.includes(m) || propuestos.includes(m),
    );
  }, [accounts, rows]);

  const update = (idx: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const amounts = rows.map((r) => Math.round((Number(r.monto) || 0) * 100));
  const total = cents(totalCentimos);
  const entered = sum(amounts.map((a) => cents(a)));
  const diff = subtract(total, entered);

  const submit = async () => {
    prepareCelebrationAudio();
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

      {proposedSplit && proposedSplit.length > 0 && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          Métodos cargados desde el kiosco. Verificá el importe y completá los códigos de operación antes de registrar.
        </p>
      )}

      {rows.map((row, idx) => (
        <div key={idx} className="rounded-lg border border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <select
              value={row.metodo}
              onChange={(e) => update(idx, { metodo: e.target.value as PaymentMethod })}
              className="flex-1 rounded-lg border border-line bg-raised px-2 py-1.5 text-ink"
            >
              {metodos.map((value) => (
                <option key={value} value={value}>
                  {METHOD_LABEL[value]}
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

          {row.metodo === "EFECTIVO" && (() => {
            const rowMontoCentimos = amounts[idx] ?? 0;
            const recibidoVal = Number(row.recibido) || 0;
            const recibidoCentimos = Math.round(recibidoVal * 100);
            const vueltoCentimos = Math.max(0, recibidoCentimos - rowMontoCentimos);
            const faltanteCentimos = Math.max(0, rowMontoCentimos - recibidoCentimos);
            const desgloseSugerido = vueltoCentimos > 0 ? desglosarVuelto(vueltoCentimos) : "";

            const handleAddDenominacion = (centimos: number) => {
              const currentDenom = { ...(row.denominaciones || {}) };
              const currentCount = currentDenom[String(centimos)] ?? 0;
              currentDenom[String(centimos)] = currentCount + 1;
              const newTotal = sumDenominaciones(currentDenom);
              update(idx, {
                denominaciones: currentDenom,
                recibido: (newTotal / 100).toFixed(2),
              });
            };

            const handleSubDenominacion = (centimos: number, e?: React.MouseEvent) => {
              e?.stopPropagation();
              const currentDenom = { ...(row.denominaciones || {}) };
              const currentCount = currentDenom[String(centimos)] ?? 0;
              if (currentCount <= 1) {
                delete currentDenom[String(centimos)];
              } else {
                currentDenom[String(centimos)] = currentCount - 1;
              }
              const newTotal = sumDenominaciones(currentDenom);
              update(idx, {
                denominaciones: currentDenom,
                recibido: newTotal > 0 ? (newTotal / 100).toFixed(2) : "",
              });
            };

            const handleExacto = () => {
              update(idx, {
                recibido: (rowMontoCentimos / 100).toFixed(2),
                denominaciones: {},
              });
            };

            const handleClearEfectivo = () => {
              update(idx, {
                recibido: "",
                denominaciones: {},
              });
            };

            const handleSetDirectAmount = (valCentimos: number) => {
              const denominaciones: Record<string, number> = {};
              if ([20000, 10000, 5000, 2000, 1000].includes(valCentimos)) {
                denominaciones[String(valCentimos)] = 1;
              }
              update(idx, {
                recibido: (valCentimos / 100).toFixed(2),
                denominaciones,
              });
            };

            return (
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-brand/25 bg-inset/40 p-3 sm:p-4">
                {/* Encabezado: Título y Atajos de acción rápida */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">💵</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-ink">
                      Cobro con Efectivo y Vuelto
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExacto}
                      className="rounded-lg border border-brand/40 bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand transition hover:bg-brand hover:text-brand-ink active:scale-95"
                    >
                      🎯 Pago exacto ({format(cents(rowMontoCentimos))})
                    </button>
                    {row.recibido && (
                      <button
                        type="button"
                        onClick={handleClearEfectivo}
                        className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-muted hover:border-danger/40 hover:bg-danger/10 hover:text-danger active:scale-95"
                      >
                        ✕ Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {/* Input de Monto Recibido y Sugerencias rápidas */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                      S/
                    </span>
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      value={row.recibido}
                      onChange={(e) => {
                        update(idx, {
                          recibido: e.target.value,
                          denominaciones: {},
                        });
                      }}
                      placeholder={`Monto recibido (ej. ${(Math.max(50, Math.ceil(rowMontoCentimos / 1000) * 10)).toFixed(2)})`}
                      className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-base font-bold text-ink placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 tabular-nums shadow-xs"
                    />
                  </div>

                  {/* Atajos de billetes frecuentes */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-medium text-muted">Atajos:</span>
                    {getSugerenciasMonto(rowMontoCentimos).map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleSetDirectAmount(sug)}
                        className={cx(
                          "rounded-lg border px-2.5 py-1 text-xs font-bold transition active:scale-95 tabular-nums",
                          recibidoCentimos === sug
                            ? "border-brand bg-brand text-brand-ink shadow-xs"
                            : "border-line bg-surface text-ink hover:border-brand/40 hover:bg-raised",
                        )}
                      >
                        S/ {(sug / 100).toFixed(0)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector de Billetes de Perú */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Billetes de Perú:
                    </span>
                    <span className="text-[10px] text-muted">Toca para sumar billete (+1)</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {BILLETES_PERU.map((b) => {
                      const count = row.denominaciones?.[String(b.centimos)] ?? 0;
                      return (
                        <div key={b.centimos} className="relative">
                          <button
                            type="button"
                            onClick={() => handleAddDenominacion(b.centimos)}
                            className={cx(
                              "w-full rounded-xl border p-2 text-center transition-all duration-150 active:scale-95 flex flex-col items-center justify-center min-h-[52px]",
                              count > 0
                                ? "border-brand bg-brand-soft text-brand font-bold shadow-xs ring-2 ring-brand/40"
                                : `bg-surface border-line text-ink hover:border-brand/40 hover:bg-raised ${b.bg}`,
                            )}
                          >
                            <span className="text-xs font-bold tabular-nums">{b.label}</span>
                            {count > 0 ? (
                              <span className="mt-0.5 inline-block rounded-full bg-brand px-1.5 py-0.2 text-[10px] font-bold text-brand-ink">
                                × {count}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted font-normal">billete</span>
                            )}
                          </button>
                          {count > 0 && (
                            <button
                              type="button"
                              title="Restar 1"
                              onClick={(e) => handleSubDenominacion(b.centimos, e)}
                              className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-white text-xs font-bold shadow-sm hover:bg-danger-hover"
                            >
                              −
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selector de Monedas de Perú */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Monedas de Perú:
                    </span>
                    <span className="text-[10px] text-muted">Toca para sumar monedas</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {MONEDAS_PERU.map((m) => {
                      const count = row.denominaciones?.[String(m.centimos)] ?? 0;
                      return (
                        <div key={m.centimos} className="relative">
                          <button
                            type="button"
                            onClick={() => handleAddDenominacion(m.centimos)}
                            className={cx(
                              "w-full rounded-xl border p-1.5 text-center transition-all duration-150 active:scale-95 flex flex-col items-center justify-center min-h-[46px]",
                              count > 0
                                ? "border-amber-500 bg-amber-500/15 text-amber-300 font-bold shadow-xs ring-2 ring-amber-500/40"
                                : "bg-surface border-line text-ink hover:border-amber-500/30 hover:bg-raised",
                            )}
                          >
                            <span className="text-xs font-bold tabular-nums">{m.label}</span>
                            {count > 0 && (
                              <span className="mt-0.5 inline-block rounded-full bg-amber-500 px-1 py-0.2 text-[9px] font-bold text-black">
                                × {count}
                              </span>
                            )}
                          </button>
                          {count > 0 && (
                            <button
                              type="button"
                              title="Restar 1"
                              onClick={(e) => handleSubDenominacion(m.centimos, e)}
                              className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-danger text-white text-xs font-bold shadow-sm hover:bg-danger-hover"
                            >
                              −
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumen de billetes y monedas si usó denominaciones */}
                {row.denominaciones && Object.keys(row.denominaciones).length > 0 && (
                  <div className="rounded-lg bg-surface/80 px-3 py-1.5 text-xs text-muted flex items-center justify-between border border-line-soft">
                    <span>
                      Cliente entrega:{" "}
                      <strong className="text-ink">
                        {Object.entries(row.denominaciones)
                          .filter(([, cant]) => cant > 0)
                          .map(([centStr, cant]) => `${cant}×S/ ${(Number(centStr) / 100).toFixed(Number(centStr) % 100 === 0 ? 0 : 2)}`)
                          .join(" + ")}
                      </strong>
                    </span>
                    <span className="font-bold text-ink">
                      Total: S/ {(recibidoCentimos / 100).toFixed(2)}
                    </span>
                  </div>
                )}

                {/* BANNER DEL VUELTO O DIFERENCIA */}
                {recibidoCentimos > rowMontoCentimos ? (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3.5 shadow-sm transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/25 text-xl">
                          💵
                        </span>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Vuelto a entregar al cliente
                          </p>
                          <p className="text-xs text-muted">
                            Diferencia: S/ {(recibidoCentimos / 100).toFixed(2)} recibido − S/ {(rowMontoCentimos / 100).toFixed(2)} a cobrar
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums tracking-tight">
                          S/ {(vueltoCentimos / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Sugerencia de billetes y monedas para entregar */}
                    {desgloseSugerido && (
                      <div className="mt-2.5 rounded-lg bg-surface/85 px-3 py-2 text-xs text-ink/90 flex items-start gap-2 border border-emerald-500/25">
                        <span className="text-emerald-400 font-bold shrink-0">💡 Entregar:</span>
                        <span className="font-semibold">{desgloseSugerido}</span>
                      </div>
                    )}
                  </div>
                ) : recibidoCentimos === rowMontoCentimos && recibidoCentimos > 0 ? (
                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 flex items-center justify-between text-xs text-blue-300">
                    <span className="font-semibold">✓ Pago exacto recibido (S/ {(rowMontoCentimos / 100).toFixed(2)})</span>
                    <span className="font-bold">Sin vuelto (S/ 0.00)</span>
                  </div>
                ) : recibidoCentimos > 0 && recibidoCentimos < rowMontoCentimos ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between text-xs text-amber-300">
                    <span>
                      ⚠️ Recibido: S/ {(recibidoCentimos / 100).toFixed(2)} (Monto insuficiente)
                    </span>
                    <span className="font-bold">
                      Faltan S/ {(faltanteCentimos / 100).toFixed(2)} para cubrir el total
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })()}

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

      {(() => {
        const totalVueltoCentimos = rows.reduce((acc, r, i) => {
          if (r.metodo !== "EFECTIVO" || !r.recibido) return acc;
          const rowMonto = amounts[i] ?? 0;
          const recCent = Math.round(Number(r.recibido) * 100);
          return acc + Math.max(0, recCent - rowMonto);
        }, 0);

        return (
          <button
            onClick={submit}
            disabled={busy || diff !== 0}
            className="rounded-lg bg-brand py-2.5 font-medium text-brand-ink transition hover:bg-brand-hover disabled:opacity-50"
          >
            {busy
              ? "Registrando…"
              : totalVueltoCentimos > 0
                ? `Registrar pago — Dar vuelto de ${format(cents(totalVueltoCentimos))}`
                : "Registrar pago"}
          </button>
        );
      })()}
    </div>
  );
}
