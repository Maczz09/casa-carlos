import { useEffect, useRef, useState } from "react";
import type { SunatConfig, SunatMode } from "@casacarlos/contracts";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, Field, Input, Notice, Section, Skeleton, cx } from "../components/ui.js";

const MODO_INFO: Record<SunatMode, { titulo: string; detalle: string; tono: string }> = {
  MOCK: {
    titulo: "Prueba interna",
    detalle: "No se envía nada a SUNAT. Los comprobantes se arman y se guardan, pero no tienen valor legal. Sirve para practicar.",
    tono: "tone-stone",
  },
  BETA: {
    titulo: "Pruebas con SUNAT",
    detalle: "Se envía al ambiente de pruebas real de SUNAT. Sirve para verificar el certificado y las claves antes de facturar de verdad.",
    tono: "tone-amber",
  },
  PRODUCCION: {
    titulo: "Facturación real",
    detalle: "Cada boleta y factura se emite de verdad ante SUNAT y queda declarada. Usalo solo con el certificado y las claves definitivas del hotel.",
    tono: "tone-teal",
  },
};

const MODOS: SunatMode[] = ["MOCK", "BETA", "PRODUCCION"];

const fecha = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" }) : "—";

/**
 * Ajustes → Facturación SUNAT. Existe para poder corregir lo que se haya
 * cargado mal en la instalación (modo equivocado, RUC con un dígito de más,
 * certificado vencido) sin reinstalar el sistema ni editar archivos a mano.
 *
 * Las contraseñas nunca vuelven del servidor: de la clave SOL solo se sabe si
 * hay una guardada, y dejar el campo vacío significa conservarla.
 */
export function SunatTab() {
  const [config, setConfig] = useState<SunatConfig | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [modo, setModo] = useState<SunatMode>("MOCK");
  const [solPassword, setSolPassword] = useState("");
  const [certPassword, setCertPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const certInput = useRef<HTMLInputElement>(null);

  const aplicar = (nueva: SunatConfig) => {
    setConfig(nueva);
    setModo(nueva.modo);
    setForm({
      ruc: nueva.emisor.ruc,
      razonSocial: nueva.emisor.razonSocial,
      nombreComercial: nueva.emisor.nombreComercial,
      direccion: nueva.emisor.direccion,
      ubigeo: nueva.emisor.ubigeo,
      distrito: nueva.emisor.distrito,
      provincia: nueva.emisor.provincia,
      departamento: nueva.emisor.departamento,
      solUser: nueva.solUser,
    });
    setSolPassword("");
  };

  useEffect(() => {
    api
      .sunatConfig()
      .then(aplicar)
      .catch((err) => setError(err instanceof ApiError ? err.message : "No se pudo leer la configuración de SUNAT."));
  }, []);

  const run = async (fn: () => Promise<SunatConfig>, mensajeOk: string, fallback: string) => {
    setBusy(true);
    setError(null);
    setOk(null);
    setPrueba(null);
    try {
      aplicar(await fn());
      setOk(mensajeOk);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const guardar = () =>
    void run(
      () =>
        api.updateSunatConfig({
          modo,
          ruc: form["ruc"] ?? "",
          razonSocial: form["razonSocial"] ?? "",
          nombreComercial: form["nombreComercial"] ?? "",
          direccion: form["direccion"] ?? "",
          ubigeo: form["ubigeo"] ?? "",
          distrito: form["distrito"] ?? "",
          provincia: form["provincia"] ?? "",
          departamento: form["departamento"] ?? "",
          solUser: form["solUser"] ?? "",
          // Vacío significa "no la estoy cambiando": la clave guardada nunca se
          // muestra en pantalla, así que tampoco se puede reenviar.
          ...(solPassword ? { solPassword } : {}),
        }),
      "Configuración guardada. Ya quedó aplicada, sin reiniciar nada.",
      "No se pudo guardar la configuración.",
    );

  const subirCertificado = (file: File) => {
    if (!certPassword.trim()) {
      setError("Escribí la contraseña del certificado antes de subirlo.");
      return;
    }
    void run(() => api.uploadSunatCertificate(file, certPassword), "Certificado cargado y verificado.", "No se pudo cargar el certificado.");
    setCertPassword("");
  };

  const probar = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      setPrueba(await api.testSunat());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo probar la conexión con SUNAT.");
    } finally {
      setBusy(false);
    }
  };

  if (!config) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const cert = config.certificado;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-subtle">Estado actual</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {MODO_INFO[config.modo].titulo}
              {config.endpoint && <span className="ml-2 break-all font-normal text-muted">{config.endpoint}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={MODO_INFO[config.modo].tono}>{config.modo}</Badge>
            <Badge tone={config.listoParaEmitir ? "tone-teal" : "tone-amber"}>{config.listoParaEmitir ? "Listo para emitir" : "Incompleto"}</Badge>
          </div>
        </div>
        {config.modoActivo !== config.modo && (
          <div className="mt-3">
            <Notice kind="warn">
              La configuración guardada dice <strong>{config.modo}</strong>, pero el sistema está funcionando en <strong>{config.modoActivo}</strong> porque no pudo
              usarla al arrancar. Corregí lo que falta y volvé a guardar: se aplica al instante.
            </Notice>
          </div>
        )}
        {config.faltantes.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
            {config.faltantes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </Card>

      {error && <Notice>{error}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}
      {prueba && <Notice kind={prueba.ok ? "ok" : "warn"}>{prueba.mensaje}</Notice>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Modo de trabajo" subtitle="Se puede cambiar cuando haga falta: no hay que reinstalar ni reiniciar nada">
          <div className="flex flex-col gap-3">
            {MODOS.map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={cx("rounded-xl border px-4 py-3 text-left transition-colors", modo === m ? "border-brand bg-brand-soft" : "border-line hover:bg-inset")}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={cx("text-sm font-medium", modo === m ? "text-brand" : "text-ink")}>{MODO_INFO[m].titulo}</span>
                  <Badge tone={MODO_INFO[m].tono}>{m}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{MODO_INFO[m].detalle}</p>
              </button>
            ))}
            {modo === "PRODUCCION" && config.modo !== "PRODUCCION" && (
              <Notice kind="warn">
                Al guardar, las boletas y facturas que se emitan pasan a ser reales ante SUNAT. Probá antes en «Pruebas con SUNAT» con el mismo certificado.
              </Notice>
            )}
          </div>
        </Section>

        <Section title="Certificado digital" subtitle="El archivo .pfx que SUNAT le entrega al hotel" delay={80}>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-line p-3 text-sm">
              {cert.presente && !cert.error ? (
                <>
                  <p className="font-medium text-ink">{cert.titular ?? "Certificado cargado"}</p>
                  <p className="mt-1 text-xs text-muted">Emitido por {cert.emisor ?? "—"}</p>
                  <p className="mt-1 text-xs text-muted">
                    Vigente del {fecha(cert.validoDesde)} al {fecha(cert.validoHasta)}
                  </p>
                  {cert.vencido && (
                    <p className="mt-2">
                      <Badge tone="tone-red">Fuera de vigencia</Badge>
                    </p>
                  )}
                </>
              ) : cert.error ? (
                <>
                  <p className="font-medium text-ink">Hay un problema con el certificado</p>
                  <p className="mt-1 text-xs text-muted">{cert.error}</p>
                </>
              ) : (
                <p className="text-muted">Todavía no se cargó ningún certificado.</p>
              )}
              {cert.ruta && <p className="mt-2 break-all text-[11px] text-subtle">{cert.ruta}</p>}
            </div>

            <Field label="Contraseña del certificado" hint="La que entrega SUNAT junto con el archivo. Se verifica antes de reemplazar al anterior.">
              <Input type="password" value={certPassword} onChange={(e) => setCertPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </Field>
            <input
              ref={certInput}
              type="file"
              accept=".pfx,.p12"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) subirCertificado(file);
              }}
            />
            <Button disabled={busy} onClick={() => certInput.current?.click()}>
              {cert.presente ? "Reemplazar certificado" : "Cargar certificado"}
            </Button>
          </div>
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Datos del hotel" subtitle="Van impresos dentro de cada comprobante electrónico" delay={120}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="RUC" hint="11 dígitos.">
              <Input value={form["ruc"] ?? ""} onChange={(e) => setForm({ ...form, ruc: e.target.value })} inputMode="numeric" maxLength={11} />
            </Field>
            <Field label="Razón social">
              <Input value={form["razonSocial"] ?? ""} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} />
            </Field>
            <Field label="Nombre comercial">
              <Input value={form["nombreComercial"] ?? ""} onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })} />
            </Field>
            <Field label="Dirección">
              <Input value={form["direccion"] ?? ""} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            </Field>
            <Field label="Ubigeo" hint="Código de 6 dígitos del distrito.">
              <Input value={form["ubigeo"] ?? ""} onChange={(e) => setForm({ ...form, ubigeo: e.target.value })} inputMode="numeric" maxLength={6} />
            </Field>
            <Field label="Distrito">
              <Input value={form["distrito"] ?? ""} onChange={(e) => setForm({ ...form, distrito: e.target.value })} />
            </Field>
            <Field label="Provincia">
              <Input value={form["provincia"] ?? ""} onChange={(e) => setForm({ ...form, provincia: e.target.value })} />
            </Field>
            <Field label="Departamento">
              <Input value={form["departamento"] ?? ""} onChange={(e) => setForm({ ...form, departamento: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Clave SOL" subtitle="El usuario secundario de SUNAT, nunca el principal" delay={160}>
          <div className="flex flex-col gap-4">
            <Field label="Usuario SOL secundario">
              <Input value={form["solUser"] ?? ""} onChange={(e) => setForm({ ...form, solUser: e.target.value })} autoComplete="off" />
            </Field>
            <Field
              label="Clave SOL"
              hint={config.solPasswordConfigurada ? "Ya hay una clave guardada. Dejalo vacío para conservarla." : "Todavía no hay ninguna clave guardada."}
            >
              <Input
                type="password"
                value={solPassword}
                onChange={(e) => setSolPassword(e.target.value)}
                placeholder={config.solPasswordConfigurada ? "•••••••• (sin cambios)" : "Clave del usuario secundario"}
                autoComplete="new-password"
              />
            </Field>
            <Card className="bg-inset p-3 shadow-none">
              <p className="text-xs text-muted">
                Creá el usuario secundario desde el portal SOL de SUNAT con el perfil de facturación electrónica. No uses la clave SOL principal del RUC: si se filtra,
                da acceso a todo.
              </p>
            </Card>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy} onClick={guardar}>
                {busy ? "Guardando…" : "Guardar configuración"}
              </Button>
              <Button
                disabled={busy || config.modo === "MOCK"}
                onClick={() => void probar()}
                title={config.modo === "MOCK" ? "En modo prueba interna no hay nada que probar contra SUNAT" : undefined}
              >
                Probar conexión
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
