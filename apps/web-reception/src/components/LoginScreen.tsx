import { useState, type FormEvent } from "react";
import { ApiError } from "../api.js";
import { Button, Input, Notice, cx } from "./ui.js";

interface Props {
  onLogin: (usuario: string, password: string) => Promise<void>;
  onLoginByPin: (pin: string) => Promise<void>;
}

export function LoginScreen({ onLogin, onLoginByPin }: Props) {
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "password") await onLogin(usuario, password);
      else await onLoginByPin(pin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-2">
      {/* Panel de marca — decorativo, se esconde en pantallas chicas */}
      <div className="relative hidden overflow-hidden bg-brand lg:block">
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.6) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.4) 0, transparent 40%)" }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-brand-ink">
          <div className="animate-fade-up flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/20 backdrop-blur">
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.6 10 3l7 5.6V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
                <path d="M7.6 17v-4.4h4.8V17" />
              </svg>
            </span>
            <span className="text-lg font-semibold">Hospedaje Carlos</span>
          </div>

          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <h2 className="max-w-md text-4xl font-semibold leading-tight tracking-tight">Todo el hospedaje, en una sola pantalla.</h2>
            <p className="mt-4 max-w-md text-sm opacity-90">
              Tablero de cuartos en vivo, caja, bodega y facturación electrónica SUNAT.
            </p>
          </div>

          <p className="animate-fade text-xs opacity-70">Sistema de gestión de hospedaje</p>
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="animate-fade-up w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-brand-ink">
              <svg viewBox="0 0 20 20" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.6 10 3l7 5.6V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" />
                <path d="M7.6 17v-4.4h4.8V17" />
              </svg>
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-ink">Iniciar sesión</h1>
          <p className="mt-1 mb-6 text-sm text-muted">Panel de recepción</p>

          <div className="mb-4 flex gap-1 rounded-xl border border-line bg-inset p-1">
            {(["password", "pin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cx(
                  "flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-150",
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {m === "password" ? "Usuario" : "PIN rápido"}
              </button>
            ))}
          </div>

          {mode === "password" ? (
            <div className="animate-fade flex flex-col gap-3">
              <Input autoFocus placeholder="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
              <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          ) : (
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="animate-fade py-3 text-center text-2xl tracking-[0.5em]"
            />
          )}

          {error && (
            <div className="mt-3">
              <Notice>{error}</Notice>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" block disabled={busy} className="mt-6">
            {busy ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
