import { useState, type FormEvent } from "react";
import { ApiError } from "../api.js";
import { useBrand } from "../hooks/useBrand.js";
import { BrandMark } from "./layout.js";
import { BrandAtmosphere } from "@casacarlos/ui";
import { Button, Input, Notice, cx } from "./ui.js";

interface Props {
  onLogin: (usuario: string, password: string) => Promise<void>;
  onLoginByPin: (pin: string) => Promise<void>;
  onRegister: (input: {
    usuario: string;
    password: string;
    nombres: string;
    apellidos: string;
    pin?: string;
    telefonoWhatsapp?: string | null;
    adminUsuario?: string;
    adminPassword?: string;
  }) => Promise<void>;
}

export function LoginScreen({ onLogin, onLoginByPin, onRegister }: Props) {
  const brand = useBrand();
  const [mode, setMode] = useState<"password" | "pin" | "register">("password");
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [telefono, setTelefono] = useState("");
  const [adminUsuario, setAdminUsuario] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      if (mode === "password") await onLogin(usuario, password);
      else if (mode === "pin") await onLoginByPin(pin);
      else {
        await onRegister({
          usuario,
          password,
          nombres,
          apellidos,
          pin: pin || undefined,
          telefonoWhatsapp: telefono || null,
          adminUsuario: adminUsuario || undefined,
          adminPassword: adminPassword || undefined,
        });
        setMode("password");
        setPassword("");
        setPin("");
        setOk("Cuenta creada. Ya podés iniciar sesión con el nuevo usuario.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100dvh] bg-bg lg:grid-cols-2">
      {/* Panel de marca — decorativo, se esconde en pantallas chicas */}
      <div className="relative hidden overflow-hidden bg-brand lg:block">
        <BrandAtmosphere className="absolute inset-0" />
        <div
          className="absolute inset-0 opacity-25"
          style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.6) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.4) 0, transparent 40%)" }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-brand-ink">
          <div className="animate-fade-up flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-white/20 backdrop-blur">
              <BrandMark logoUrl={brand.logoUrl} nombre={brand.nombre} className={brand.logoUrl ? "p-1" : "h-6 w-6"} />
            </span>
            <span className="text-lg font-semibold">{brand.nombre}</span>
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

          <h1 className="text-2xl font-semibold tracking-tight text-ink">{mode === "register" ? "Crear cuenta" : "Iniciar sesión"}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">{mode === "register" ? "Alta segura para el personal del hospedaje" : "Panel de recepción"}</p>

          <div className="mb-4 flex gap-1 rounded-xl border border-line bg-inset p-1">
            {(["password", "pin", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cx(
                  "flex-1 rounded-lg py-1.5 text-sm font-medium transition-all duration-150",
                  mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {m === "password" ? "Usuario" : m === "pin" ? "PIN rápido" : "Registrarme"}
              </button>
            ))}
          </div>

          {mode === "password" ? (
            <div className="animate-fade flex flex-col gap-3">
              <Input autoFocus placeholder="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
              <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          ) : mode === "pin" ? (
            <Input
              autoFocus
              type="password"
              inputMode="numeric"
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="animate-fade py-3 text-center text-2xl tracking-[0.5em]"
            />
          ) : (
            <div className="animate-fade flex max-h-[58vh] flex-col gap-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3">
                <Input autoFocus placeholder="Nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} />
                <Input placeholder="Apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
              </div>
              <Input placeholder="Nuevo usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
              <Input type="password" placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input inputMode="numeric" placeholder="PIN (opcional)" value={pin} onChange={(e) => setPin(e.target.value)} />
                <Input inputMode="tel" placeholder="WhatsApp (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div className="mt-1 rounded-xl border border-line bg-inset/70 p-3">
                <p className="mb-2 text-xs font-semibold text-ink">Autorización del administrador</p>
                <p className="mb-3 text-xs leading-relaxed text-muted">Evita que una persona ajena cree cuentas desde la pantalla de acceso.</p>
                <div className="flex flex-col gap-2">
                  <Input placeholder="Usuario administrador" value={adminUsuario} onChange={(e) => setAdminUsuario(e.target.value)} />
                  <Input type="password" placeholder="Contraseña del administrador" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3">
              <Notice>{error}</Notice>
            </div>
          )}
          {ok && <div className="mt-3"><Notice kind="ok">{ok}</Notice></div>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={busy || (mode === "register" && (!nombres || !apellidos || !usuario || !password || !adminUsuario || !adminPassword))}
            className="mt-6"
          >
            {busy ? (mode === "register" ? "Creando…" : "Ingresando…") : mode === "register" ? "Crear cuenta" : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
