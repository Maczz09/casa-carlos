import { useState } from "react";
import type { CollectionAccount, PaymentMethod } from "@casacarlos/contracts";
import { cents, format, sum } from "@casacarlos/money";
import { IconBank, IconCash, IconCombine, IconWallet } from "@casacarlos/ui";
import { Shell } from "./Shell.js";

interface Props {
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
};

/**
 * Qué se le ofrece al huésped sale de los canales de cobro que el hotel tiene
 * cargados y activos (Ajustes → Cobros), no de una lista fija en el código: si
 * el hotel no usa Plin, Plin no aparece. El efectivo siempre está — se recibe
 * en el mostrador y no necesita cuenta de nadie.
 */
function availableMethods(accounts: CollectionAccount[]): PaymentMethod[] {
  const metodos: PaymentMethod[] = ["EFECTIVO"];
  for (const cuenta of accounts) {
    if (!metodos.includes(cuenta.metodo)) metodos.push(cuenta.metodo);
  }
  return metodos;
}

export function PaymentScreen({ totalCentimos, collectionAccounts, onPropose, onCancel, busy }: Props) {
  const [method, setMethod] = useState<Method | null>(null);
  const metodos = availableMethods(collectionAccounts);
  const [hybridRows, setHybridRows] = useState([
    { metodo: "EFECTIVO", monto: "" },
    { metodo: metodos.find((m) => m !== "EFECTIVO") ?? "EFECTIVO", monto: "" },
  ]);

  const cuentasDelMetodo = collectionAccounts.filter((a) => a.metodo === method);
  const hybridTotal = sum(hybridRows.map((r) => cents(Math.round((Number(r.monto) || 0) * 100))));
  const hybridOk = hybridTotal === totalCentimos;

  if (!method) {
    return (
      <Shell title="¿Cómo vas a pagar?" step="Paso 3 de 3" onBack={onCancel}>
        <div className="animate-fade-up mb-8 rounded-2xl bg-surface px-8 py-6 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
          <p className="text-sm uppercase tracking-wide text-subtle">Total a pagar</p>
          <p className="font-serif text-5xl text-ink">{format(cents(totalCentimos))}</p>
        </div>
        <div className="stagger grid flex-1 grid-cols-2 gap-5 content-start">
          {metodos.map((m, i) => (
            <MethodButton
              key={m}
              i={i}
              icon={m === "EFECTIVO" ? IconCash : m === "TRANSFERENCIA" ? IconBank : IconWallet}
              label={METHOD_LABEL[m] ?? m}
              onClick={() => setMethod(m)}
            />
          ))}
          {metodos.length > 1 && (
            <MethodButton i={metodos.length} icon={IconCombine} label="Combinar métodos" onClick={() => setMethod("HIBRIDO")} wide />
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={method === "HIBRIDO" ? "Combinar métodos" : (METHOD_LABEL[method] ?? method)} onBack={() => setMethod(null)}>
      <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {method === "EFECTIVO" && (
          <>
            <p className="text-lg text-muted">Entrega este monto en efectivo al recepcionista</p>
            <p className="font-serif text-6xl text-ink">{format(cents(totalCentimos))}</p>
          </>
        )}

        {method !== "EFECTIVO" && method !== "HIBRIDO" && (
          <>
            {cuentasDelMetodo.length === 0 ? (
              <p className="text-lg text-muted">Este método no está disponible por ahora — elige otro.</p>
            ) : (
              <>
                <p className="text-lg text-muted">
                  {method === "TRANSFERENCIA"
                    ? "Transfiere el monto y muéstrale la constancia al recepcionista"
                    : "Escanea el código y muéstrale la confirmación al recepcionista"}
                </p>
                <div className="flex w-full flex-wrap items-stretch justify-center gap-5">
                  {cuentasDelMetodo.map((cuenta) => (
                    <AccountCard key={cuenta.id} cuenta={cuenta} />
                  ))}
                </div>
                <p className="font-serif text-3xl text-ink">{format(cents(totalCentimos))}</p>
              </>
            )}
          </>
        )}

        {method === "HIBRIDO" && (
          <div className="w-full max-w-md space-y-4 text-left">
            {hybridRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                <select
                  value={row.metodo}
                  onChange={(e) => setHybridRows((rs) => rs.map((r, i) => (i === idx ? { ...r, metodo: e.target.value } : r)))}
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-ink"
                >
                  {metodos.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m] ?? m}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="S/"
                  value={row.monto}
                  onChange={(e) => setHybridRows((rs) => rs.map((r, i) => (i === idx ? { ...r, monto: e.target.value } : r)))}
                  className="w-28 rounded-lg border border-line bg-surface px-3 py-2 text-right text-ink"
                />
              </div>
            ))}
            <p className={`text-center text-sm ${hybridOk ? "text-brand" : "text-danger"}`}>
              {format(hybridTotal)} de {format(cents(totalCentimos))}
            </p>
          </div>
        )}

        <button
          disabled={busy || (method !== "EFECTIVO" && method !== "HIBRIDO" && cuentasDelMetodo.length === 0) || (method === "HIBRIDO" && !hybridOk)}
          onClick={() =>
            onPropose(
              method === "HIBRIDO"
                ? hybridRows.map((r) => ({ metodo: r.metodo, montoCentimos: Math.round((Number(r.monto) || 0) * 100) }))
                : [{ metodo: method, montoCentimos: totalCentimos }],
            )
          }
          className="mt-2 w-full max-w-md rounded-2xl bg-brand py-5 text-xl font-medium text-brand-ink shadow-[var(--shadow-card)] transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          Ya pagué, avisar a recepción
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
function AccountCard({ cuenta }: { cuenta: CollectionAccount }) {
  const esBanco = cuenta.tipo === "BANCO";
  return (
    <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-left shadow-[var(--shadow-card)] ring-1 ring-line">
      <p className="text-sm uppercase tracking-wide text-subtle">{esBanco ? "Transfiere a" : (METHOD_LABEL[cuenta.metodo] ?? cuenta.proveedor)}</p>
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

function MethodButton({ icon: Icon, label, onClick, wide, i }: { icon: typeof IconCash; label: string; onClick: () => void; wide?: boolean; i: number }) {
  return (
    <button
      style={{ ["--i" as string]: i }}
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 rounded-3xl bg-surface py-8 shadow-[var(--shadow-card)] ring-1 ring-line transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] ${wide ? "col-span-2" : ""}`}
    >
      <Icon className="h-9 w-9 text-brand" />
      <span className="text-lg font-medium text-ink">{label}</span>
    </button>
  );
}
