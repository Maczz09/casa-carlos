import { useEffect, useState } from "react";
import type { CollectionAccount, KioskSession, PaymentMethod } from "@casacarlos/contracts";
import { cents, format, sum } from "@casacarlos/money";
import { IconBank, IconCash, IconCombine, IconWallet, prepareCelebrationAudio } from "@casacarlos/ui";
import { Shell } from "./Shell.js";

interface Props {
  session?: KioskSession | null;
  totalCentimos: number;
  collectionAccounts: CollectionAccount[];
  onPropose: (detalles: { metodo: string; montoCentimos: number }[]) => void;
  onCancel: () => void;
  busy: boolean;
}

type Method = PaymentMethod | "HIBRIDO";

const METHOD_LABEL: Record<string, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  LEMON: "Lemon",
  AGORA: "Agora",
  TRANSFERENCIA: "Transferencia",
  POS_CREDITO: "Tarjeta POS (Crédito)",
  POS_DEBITO: "Tarjeta POS (Débito)",
  HIBRIDO: "Pago combinado",
};

/**
 * Métodos disponibles para el cliente. Incluye efectivo, POS y las billeteras/bancos
 * que el hotel tenga configurados.
 */
function availableMethods(accounts: CollectionAccount[]): Method[] {
  const metodos: Method[] = ["EFECTIVO", "POS_DEBITO"];
  for (const cuenta of accounts) {
    if (!metodos.includes(cuenta.metodo as Method)) {
      metodos.push(cuenta.metodo as Method);
    }
  }
  return metodos;
}

export function PaymentScreen({ session, totalCentimos, collectionAccounts, onPropose, onCancel, busy }: Props) {
  const metodos = availableMethods(collectionAccounts);
  const selectedFromReception = session?.metodoPagoSeleccionado;

  // Por defecto se alinea inmediatamente con lo que recepción esté usando (o EFECTIVO)
  const [method, setMethod] = useState<Method>(() => {
    if (selectedFromReception) return selectedFromReception as Method;
    return "EFECTIVO";
  });

  const [hybridRows, setHybridRows] = useState(() => {
    if (session?.propuestaPago && session.propuestaPago.length > 0) {
      return session.propuestaPago.map((p) => ({ metodo: p.metodo, monto: (p.montoCentimos / 100).toFixed(2) }));
    }
    return [
      { metodo: "EFECTIVO", monto: "" },
      { metodo: metodos.find((m) => m !== "EFECTIVO") ?? "EFECTIVO", monto: "" },
    ];
  });

  // Si recepción cambia el método de pago en su pantalla, el kiosco se actualiza en vivo al instante
  useEffect(() => {
    if (selectedFromReception) {
      setMethod(selectedFromReception as Method);
    }
  }, [selectedFromReception]);

  // Si recepción envía o modifica los montos de pago combinado, actualizar las filas
  useEffect(() => {
    if (session?.propuestaPago && session.propuestaPago.length > 0) {
      setHybridRows(
        session.propuestaPago.map((p) => ({
          metodo: p.metodo,
          monto: (p.montoCentimos / 100).toFixed(2),
        }))
      );
    }
  }, [session?.propuestaPago]);

  const splitItems =
    session?.propuestaPago && session.propuestaPago.length > 0
      ? session.propuestaPago
      : hybridRows.map((r) => ({
          metodo: r.metodo,
          montoCentimos: Math.round((Number(r.monto) || 0) * 100),
        }));

  const cuentasDelMetodo = collectionAccounts.filter((a) => a.metodo === method);
  const hybridTotal = sum(hybridRows.map((r) => cents(Math.round((Number(r.monto) || 0) * 100))));
  const hybridOk = hybridTotal === totalCentimos;

  const isPos = method === "POS_CREDITO" || method === "POS_DEBITO";

  return (
    <Shell
      title={METHOD_LABEL[method] ?? method}
      step="Paso final — Pago"
      onBack={onCancel}
    >
      <div className="flex flex-1 flex-col items-center">
        {/* Selector rápido superior (chips interactivos) */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          {metodos.map((m) => {
            const active = method === m;
            return (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                  active
                    ? "bg-brand text-brand-ink shadow-sm ring-2 ring-brand font-semibold"
                    : "border border-line bg-surface text-muted hover:bg-inset hover:text-ink"
                }`}
              >
                <span>{METHOD_LABEL[m] ?? m}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </button>
            );
          })}
          {metodos.length > 1 && (
            <button
              onClick={() => setMethod("HIBRIDO")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                method === "HIBRIDO"
                  ? "bg-brand text-brand-ink shadow-sm ring-2 ring-brand font-semibold"
                  : "border border-line bg-surface text-muted hover:bg-inset hover:text-ink"
              }`}
            >
              <span>Combinar métodos</span>
              {method === "HIBRIDO" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </button>
          )}
        </div>

        {/* Indicador de sincronización en vivo */}
        {selectedFromReception && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Seleccionado en recepción: {METHOD_LABEL[selectedFromReception] ?? selectedFromReception}</span>
          </div>
        )}

        {/* Vista para EFECTIVO */}
        {method === "EFECTIVO" && (
          <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center max-w-lg mx-auto">
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <IconCash className="h-14 w-14" />
            </div>

            <div className="space-y-2">
              <h3 className="font-serif text-3xl font-bold text-ink">
                Pago en Efectivo
              </h3>
              <p className="text-base text-muted">
                Por favor entregue el dinero en efectivo en el mostrador de recepción:
              </p>
            </div>

            <div className="rounded-3xl border border-line bg-surface px-8 py-5 shadow-sm ring-1 ring-line w-full">
              <p className="text-xs uppercase tracking-wider text-subtle">Monto total a cancelar</p>
              <p className="font-serif text-5xl font-bold text-ink mt-1">{format(cents(totalCentimos))}</p>
            </div>

            <p className="text-xs text-subtle">
              El recepcionista registrará su pago y le entregará su comprobante y llave.
            </p>
          </div>
        )}

        {/* Vista para TARJETA POS */}
        {isPos && (
          <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-6 py-6 text-center max-w-lg mx-auto">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-brand/15 text-brand shadow-lg">
              <svg viewBox="0 0 64 64" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="14" y="8" width="36" height="48" rx="6" />
                <rect x="20" y="14" width="24" height="14" rx="2" />
                <circle cx="26" cy="36" r="2" />
                <circle cx="38" cy="36" r="2" />
                <circle cx="26" cy="44" r="2" />
                <circle cx="38" cy="44" r="2" />
                <path d="M48 20a10 10 0 0 1 0 14" strokeWidth="2" strokeDasharray="2 2" className="animate-pulse" />
                <path d="M52 16a16 16 0 0 1 0 22" strokeWidth="2" />
              </svg>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3.5 py-1 text-xs font-semibold text-brand">
                <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
                Terminal POS Listo
              </span>
              <h3 className="font-serif text-3xl font-bold text-ink">
                Acerque o inserte su tarjeta en el terminal POS
              </h3>
              <p className="text-sm text-muted max-w-md">
                Aceptamos tarjetas de débito y crédito Visa, Mastercard y todas las billeteras sin contacto.
              </p>
            </div>

            <div className="rounded-3xl border border-line bg-surface px-8 py-5 shadow-sm ring-1 ring-line w-full">
              <p className="text-xs uppercase tracking-wider text-subtle">Monto total a cobrar en POS</p>
              <p className="font-serif text-5xl font-bold text-ink mt-1">{format(cents(totalCentimos))}</p>
            </div>

            <p className="text-xs text-subtle">
              El recepcionista completará la transacción con el voucher del terminal.
            </p>
          </div>
        )}

        {/* Vista para TRANSFERENCIA */}
        {method === "TRANSFERENCIA" && (
          <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-6 py-4 text-center max-w-2xl mx-auto w-full">
            <div className="space-y-1">
              <h3 className="font-serif text-3xl font-bold text-ink">
                Transferencia Bancaria
              </h3>
              <p className="text-sm text-muted">
                Transfiera el monto y muestre la constancia en recepción:
              </p>
            </div>

            <div className="grid w-full gap-4 sm:grid-cols-2">
              {cuentasDelMetodo.length === 0 ? (
                <div className="col-span-2 rounded-2xl border border-line bg-surface p-6 text-center text-muted">
                  <p>No hay cuentas bancarias registradas en este momento.</p>
                </div>
              ) : (
                cuentasDelMetodo.map((cuenta) => (
                  <AccountCard key={cuenta.id} cuenta={cuenta} />
                ))
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface px-8 py-4 shadow-sm ring-1 ring-line">
              <p className="text-xs uppercase tracking-wider text-subtle">Monto total a transferir</p>
              <p className="font-serif text-4xl font-bold text-ink mt-0.5">{format(cents(totalCentimos))}</p>
            </div>
          </div>
        )}

        {/* Vista para BILLETERAS DIGITALES (Yape, Plin, Lemon, Agora) */}
        {!isPos && method !== "EFECTIVO" && method !== "TRANSFERENCIA" && method !== "HIBRIDO" && (
          <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-6 py-4 text-center max-w-lg mx-auto w-full">
            <div className="space-y-1">
              <h3 className="font-serif text-3xl font-bold text-ink">
                Escanee el código QR desde su app {METHOD_LABEL[method] ?? method}
              </h3>
              <p className="text-sm text-muted">
                Abra su aplicación móvil y escanee el código para pagar el monto exacto:
              </p>
            </div>

            <div className="flex w-full flex-wrap items-stretch justify-center gap-5">
              {cuentasDelMetodo.length === 0 ? (
                <div className="rounded-2xl border border-line bg-surface p-6 text-center text-muted w-full">
                  <p>No hay código QR cargado para este método.</p>
                  <p className="text-xs text-subtle mt-1">Consulte los datos en recepción.</p>
                </div>
              ) : (
                cuentasDelMetodo.map((cuenta) => (
                  <AccountCard key={cuenta.id} cuenta={cuenta} />
                ))
              )}
            </div>

            <div className="rounded-2xl border border-line bg-surface px-8 py-4 shadow-sm ring-1 ring-line">
              <p className="text-xs uppercase tracking-wider text-subtle">Total a yapear / transferir</p>
              <p className="font-serif text-4xl font-bold text-ink mt-0.5">{format(cents(totalCentimos))}</p>
            </div>
          </div>
        )}

        {/* Vista para HIBRIDO */}
        {method === "HIBRIDO" && (
          <div className="animate-fade-up w-full max-w-4xl space-y-6 py-4">
            <div className="text-center space-y-1">
              <h3 className="font-serif text-3xl font-bold text-ink">
                Pago Combinado
              </h3>
              <p className="text-sm text-muted">
                {splitItems.length > 0
                  ? `Pago dividido en ${splitItems.length} métodos:`
                  : "Indique la combinación de pagos acordada con recepción:"}
              </p>
            </div>

            {/* Resumen de partes */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {splitItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-2 shadow-sm ring-1 ring-line">
                  <span className="text-xs uppercase font-semibold text-subtle">{METHOD_LABEL[item.metodo] ?? item.metodo}:</span>
                  <span className="font-bold text-ink text-base">{format(cents(item.montoCentimos))}</span>
                </div>
              ))}
              <div className="rounded-2xl bg-brand/10 px-4 py-2 ring-1 ring-brand/30">
                <span className="text-xs font-semibold text-brand mr-1.5">Total:</span>
                <span className="font-bold text-brand text-base">{format(cents(totalCentimos))}</span>
              </div>
            </div>

            {/* Tarjetas con datos de pago reales para cada parte */}
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 justify-items-center">
              {splitItems.map((item, idx) => {
                const itemMetodo = item.metodo;
                const itemMonto = item.montoCentimos;
                const isItemPos = itemMetodo === "POS_CREDITO" || itemMetodo === "POS_DEBITO";
                const cuentasItem = collectionAccounts.filter((a) => a.metodo === itemMetodo);

                if (itemMetodo === "EFECTIVO") {
                  return (
                    <div key={idx} className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-line flex flex-col items-center justify-between">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs uppercase tracking-wide font-semibold text-amber-600 dark:text-amber-400">Efectivo</span>
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                          {format(cents(itemMonto))}
                        </span>
                      </div>
                      <div className="my-5 grid h-20 w-20 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <IconCash className="h-10 w-10" />
                      </div>
                      <p className="text-base font-semibold text-ink">Entregar en mostrador</p>
                      <p className="text-xs text-muted mt-1">Pague este importe en efectivo directamente en recepción.</p>
                    </div>
                  );
                }

                if (isItemPos) {
                  return (
                    <div key={idx} className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-[var(--shadow-card)] ring-1 ring-line flex flex-col items-center justify-between">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs uppercase tracking-wide font-semibold text-brand">{METHOD_LABEL[itemMetodo] ?? "Terminal POS"}</span>
                        <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-bold text-brand">
                          {format(cents(itemMonto))}
                        </span>
                      </div>
                      <div className="my-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/15 text-brand">
                        <svg viewBox="0 0 64 64" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="14" y="8" width="36" height="48" rx="6" />
                          <rect x="20" y="14" width="24" height="14" rx="2" />
                          <circle cx="26" cy="36" r="2" />
                          <circle cx="38" cy="36" r="2" />
                          <circle cx="26" cy="44" r="2" />
                          <circle cx="38" cy="44" r="2" />
                        </svg>
                      </div>
                      <p className="text-base font-semibold text-ink">Pase su tarjeta por el POS</p>
                      <p className="text-xs text-muted mt-1">Acerque o inserte su tarjeta en el terminal en recepción.</p>
                    </div>
                  );
                }

                if (itemMetodo === "TRANSFERENCIA") {
                  return (
                    <div key={idx} className="w-full max-w-sm space-y-3">
                      {cuentasItem.length === 0 ? (
                        <div className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
                          <p className="font-semibold text-ink">Transferencia: {format(cents(itemMonto))}</p>
                          <p className="text-xs mt-1">Solicite los números de cuenta en recepción.</p>
                        </div>
                      ) : (
                        cuentasItem.map((c) => <AccountCard key={c.id} cuenta={c} montoCentimos={itemMonto} />)
                      )}
                    </div>
                  );
                }

                // Billeteras digitales (Yape, Plin, Lemon, Agora)
                return (
                  <div key={idx} className="w-full max-w-sm space-y-3">
                    {cuentasItem.length === 0 ? (
                      <div className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
                        <p className="font-semibold text-ink">{METHOD_LABEL[itemMetodo] ?? itemMetodo}: {format(cents(itemMonto))}</p>
                        <p className="text-xs mt-1">Solicite los datos en recepción.</p>
                      </div>
                    ) : (
                      cuentasItem.map((c) => <AccountCard key={c.id} cuenta={c} montoCentimos={itemMonto} />)
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botón opcional para pantallas táctiles */}
        <button
          disabled={busy || (!isPos && method !== "EFECTIVO" && method !== "HIBRIDO" && cuentasDelMetodo.length === 0) || (method === "HIBRIDO" && !hybridOk)}
          onClick={() => {
            prepareCelebrationAudio();
            onPropose(
              method === "HIBRIDO"
                ? hybridRows.map((r) => ({ metodo: r.metodo, montoCentimos: Math.round((Number(r.monto) || 0) * 100) }))
                : [{ metodo: method, montoCentimos: totalCentimos }],
            );
          }}
          className="mt-6 w-full max-w-md rounded-2xl bg-brand py-4 text-lg font-medium text-brand-ink shadow-[var(--shadow-card)] transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Ya completé el pago, avisar a recepción
        </button>
      </div>
    </Shell>
  );
}

/**
 * Los datos de un canal de cobro tal como el huésped los necesita. El QR es la
 * foto que el hotel exportó de su billetera: no se dibuja ninguno acá, porque
 * un QR generado por el sistema no cobraría nada. Sin foto cargada se muestra
 * el número, que sirve igual para yapear a mano.
 */
function AccountCard({ cuenta, montoCentimos }: { cuenta: CollectionAccount; montoCentimos?: number }) {
  const esBanco = cuenta.tipo === "BANCO";
  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-left shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm uppercase tracking-wide text-subtle">{esBanco ? "Transfiere a" : (METHOD_LABEL[cuenta.metodo] ?? cuenta.proveedor)}</p>
        {montoCentimos !== undefined && montoCentimos > 0 && (
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
            Monto: {format(cents(montoCentimos))}
          </span>
        )}
      </div>
      <p className="mt-1 font-serif text-2xl text-ink">{cuenta.titular}</p>

      {!esBanco &&
        (cuenta.qrUrl ? (
          <img
            src={cuenta.qrUrl}
            alt={`Código QR de ${cuenta.proveedor}`}
            className="animate-pop mx-auto mt-4 h-64 w-64 rounded-2xl bg-white object-contain p-2 shadow-[var(--shadow-pop)]"
          />
        ) : (
          <p className="mt-4 text-center text-sm text-muted">Muéstrale el número al recepcionista para que te confirme el pago.</p>
        ))}

      <dl className="mt-4 space-y-2 text-sm text-ink">
        {esBanco && (
          <div className="flex justify-between gap-4">
            <dt className="text-subtle">Banco</dt>
            <dd className="font-medium">{cuenta.proveedor}</dd>
          </div>
        )}
        {cuenta.telefono && (
          <div className="flex justify-between gap-4">
            <dt className="text-subtle">Número</dt>
            <dd className="font-mono font-medium">{cuenta.telefono}</dd>
          </div>
        )}
        {cuenta.numeroCuenta && (
          <div className="flex justify-between gap-4">
            <dt className="text-subtle">Cuenta</dt>
            <dd className="font-mono font-medium">{cuenta.numeroCuenta}</dd>
          </div>
        )}
        {cuenta.cci && (
          <div className="flex justify-between gap-4">
            <dt className="text-subtle">CCI</dt>
            <dd className="font-mono font-medium">{cuenta.cci}</dd>
          </div>
        )}
      </dl>

      {cuenta.notas && <p className="mt-3 text-xs text-muted">{cuenta.notas}</p>}
    </div>
  );
}
