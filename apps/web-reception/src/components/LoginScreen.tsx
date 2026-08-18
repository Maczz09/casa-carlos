import { useState, type FormEvent } from "react";
import { ApiError } from "../api.js";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-900">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-slate-800 p-8 shadow-xl">
        <h1 className="mb-1 text-2xl font-semibold text-white">Casa Carlos</h1>
        <p className="mb-6 text-sm text-slate-400">Recepción</p>

        <div className="mb-4 flex gap-2 rounded-lg bg-slate-900 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("password")}
            className={`flex-1 rounded-md py-1.5 ${mode === "password" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          >
            Usuario
          </button>
          <button
            type="button"
            onClick={() => setMode("pin")}
            className={`flex-1 rounded-md py-1.5 ${mode === "pin" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          >
            PIN rápido
          </button>
        </div>

        {mode === "password" ? (
          <div className="flex flex-col gap-3">
            <input
              autoFocus
              placeholder="Usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white outline-none focus:border-emerald-500"
            />
          </div>
        ) : (
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-emerald-500"
          />
        )}

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-lg bg-emerald-600 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
