import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { CollectionAccount } from "@casacarlos/contracts";
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

type Method = "EFECTIVO" | "YAPE" | "PLIN" | "TRANSFERENCIA" | "HIBRIDO";

const METHOD_LABEL: Record<Exclude<Method, "HIBRIDO">, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFERENCIA: "Transferencia",
};

function useQr(text: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!text) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(text, { margin: 1, width: 260, color: { dark: "#292524", light: "#FFFFFF" } }).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [text]);
  return url;
}

export function PaymentScreen({ totalCentimos, collectionAccounts, onPropose, onCancel, busy }: Props) {
  const [method, setMethod] = useState<Method | null>(null);
  const [hybridRows, setHybridRows] = useState([
    { metodo: "EFECTIVO", monto: "" },
    { metodo: "YAPE", monto: "" },
  ]);

  const bank = collectionAccounts.find((a) => a.tipo === "BANCO");
  const wallet = collectionAccounts.find((a) => a.tipo === "BILLETERA" && (method === "YAPE" ? a.proveedor === "YAPE" : a.proveedor === "PLIN"));
  const qrText = wallet ? `${wallet.proveedor} · ${wallet.titular} · ${format(cents(totalCentimos))}` : null;
  const qrUrl = useQr(method === "YAPE" || method === "PLIN" ? qrText : null);

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
          <MethodButton i={0} icon={IconCash} label="Efectivo" onClick={() => setMethod("EFECTIVO")} />
          <MethodButton i={1} icon={IconWallet} label="Yape" onClick={() => setMethod("YAPE")} />
          <MethodButton i={2} icon={IconWallet} label="Plin" onClick={() => setMethod("PLIN")} />
          <MethodButton i={3} icon={IconBank} label="Transferencia" onClick={() => setMethod("TRANSFERENCIA")} />
          <MethodButton i={4} icon={IconCombine} label="Combinar métodos" onClick={() => setMethod("HIBRIDO")} wide />
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={method === "HIBRIDO" ? "Combinar métodos" : METHOD_LABEL[method]} onBack={() => setMethod(null)}>
      <div className="animate-fade-up flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {method === "EFECTIVO" && (
          <>
            <p className="text-lg text-muted">Entrega este monto en efectivo al recepcionista</p>
            <p className="font-serif text-6xl text-ink">{format(cents(totalCentimos))}</p>
          </>
        )}

        {(method === "YAPE" || method === "PLIN") &&
          (wallet ? (
            <>
              <p className="text-lg text-muted">Escanea el código y muéstrale la confirmación al recepcionista</p>
              {qrUrl && <img src={qrUrl} alt={`Código QR de ${METHOD_LABEL[method]}`} className="animate-pop rounded-2xl shadow-[var(--shadow-pop)]" width={260} height={260} />}
              <p className="font-serif text-3xl text-ink">{format(cents(totalCentimos))}</p>
            </>
          ) : (
            <p className="text-lg text-muted">Este método no está disponible por ahora — elige otro.</p>
          ))}

        {method === "TRANSFERENCIA" &&
          (bank ? (
            <div className="w-full max-w-md rounded-2xl bg-surface p-8 text-left shadow-[var(--shadow-card)] ring-1 ring-line">
              <p className="text-sm uppercase tracking-wide text-subtle">Transfiere a</p>
              <p className="mt-1 font-serif text-2xl text-ink">{bank.titular}</p>
              <dl className="mt-4 space-y-2 text-sm text-ink">
                <div className="flex justify-between">
                  <dt className="text-subtle">Banco</dt>
                  <dd className="font-medium">{bank.proveedor}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-subtle">Cuenta</dt>
                  <dd className="font-mono font-medium">{bank.numeroCuenta}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-subtle">CCI</dt>
                  <dd className="font-mono font-medium">{bank.cci}</dd>
                </div>
              </dl>
              <p className="mt-5 text-center font-serif text-3xl text-ink">{format(cents(totalCentimos))}</p>
            </div>
          ) : (
            <p className="text-lg text-muted">Este método no está disponible por ahora — elige otro.</p>
          ))}

        {method === "HIBRIDO" && (
          <div className="w-full max-w-md space-y-4 text-left">
            {hybridRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                <select
                  value={row.metodo}
                  onChange={(e) => setHybridRows((rs) => rs.map((r, i) => (i === idx ? { ...r, metodo: e.target.value } : r)))}
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-ink"
                >
                  {Object.entries(METHOD_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
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
          disabled={busy || (method === "TRANSFERENCIA" && !bank) || ((method === "YAPE" || method === "PLIN") && !wallet) || (method === "HIBRIDO" && !hybridOk)}
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
