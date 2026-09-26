import { useEffect, useRef, useState } from "react";
import type { Brand, CollectionAccount } from "@casacarlos/contracts";
import { WALLET_PROVIDERS } from "@casacarlos/contracts";
import { IconBank, IconCheck, IconClock, IconMoon, IconPlus, IconSun, IconWallet, IconX } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { setBrand, useBrand } from "../hooks/useBrand.js";
import { useTheme } from "../hooks/useTheme.js";
import { SunatTab } from "./SunatSettingsTab.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Skeleton, Tabs, cx } from "../components/ui.js";

/** Sugerencias, no una lista cerrada: el hotel puede cobrar en cualquier banco o caja. */
const BANCOS = [
  "BCP",
  "BBVA",
  "Interbank",
  "Scotiabank",
  "BanBif",
  "Banco Pichincha",
  "Banco de la Nación",
  "Mibanco",
  "Caja Arequipa",
  "Caja Huancayo",
  "Caja Ica",
  "Caja Piura",
  "Caja Trujillo",
];

const WALLET_LABEL: Record<string, string> = { YAPE: "Yape", PLIN: "Plin", LEMON: "Lemon", AGORA: "Agora" };

export function SettingsModule() {
  const [tab, setTab] = useState<"marca" | "apariencia" | "cobros" | "sunat">("marca");

  return (
    <>
      <PageHeader
        title="Ajustes"
        subtitle="Logo y nombre del hotel, apariencia y horario del modo oscuro, cuentas de cobro y facturación electrónica SUNAT"
      />
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: "marca" as const, label: "Marca" },
            { id: "apariencia" as const, label: "Tema y Apariencia" },
            { id: "cobros" as const, label: "Cobros" },
            { id: "sunat" as const, label: "Facturación SUNAT" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>
      {tab === "marca" ? (
        <BrandTab />
      ) : tab === "apariencia" ? (
        <AppearanceTab />
      ) : tab === "cobros" ? (
        <CollectionAccountsTab />
      ) : (
        <SunatTab />
      )}
    </>
  );
}


/* ------------------------------- Marca ------------------------------- */

function BrandTab() {
  const brand = useBrand();
  const [nombre, setNombre] = useState(brand.nombre);
  const [lema, setLema] = useState(brand.lema);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // La marca llega por fetch, así que la primera vez el hook devuelve el valor
  // por defecto: cuando llega la real se sincronizan los campos una sola vez,
  // para no pisar lo que la persona ya esté escribiendo.
  const sincronizado = useRef(false);
  useEffect(() => {
    if (sincronizado.current) return;
    sincronizado.current = true;
    setNombre(brand.nombre);
    setLema(brand.lema);
  }, [brand.nombre, brand.lema]);

  const run = async (fn: () => Promise<Brand>, mensajeOk: string, fallback: string) => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      setBrand(await fn());
      setOk(mensajeOk);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Logo del hotel">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-5">
            <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-inset">
              {brand.logoUrl ? (
                <img src={brand.logoUrl} alt="Logo del hotel" className="h-full w-full object-contain p-2" />
              ) : (
                <span className="px-2 text-center text-[11px] leading-tight text-subtle">Sin logo cargado</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void run(() => api.uploadBrandLogo(file), "Logo actualizado.", "No se pudo cargar el logo.");
                }}
              />
              <Button variant="primary" disabled={busy} onClick={() => fileInput.current?.click()}>
                {brand.logoUrl ? "Cambiar logo" : "Cargar logo"}
              </Button>
              {brand.logoUrl && (
                <Button disabled={busy} onClick={() => void run(() => api.deleteBrandLogo(), "Se quitó el logo.", "No se pudo quitar el logo.")}>
                  Quitar logo
                </Button>
              )}
            </div>
          </div>
          <Card className="bg-inset p-3 shadow-none">
            <p className="text-xs text-muted">
              JPG, PNG o WebP de hasta 3 MB. Se ve mejor un logo cuadrado y con fondo transparente: aparece en la barra lateral, en la pantalla de acceso, en el kiosco
              del huésped y arriba de los comprobantes impresos. Si se cargó uno durante la instalación, es este mismo.
            </p>
          </Card>
        </div>
      </Section>

      <Section title="Nombre" delay={80}>
        <div className="flex flex-col gap-4">
          <Field label="Nombre del hotel">
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Hospedaje Carlos" maxLength={60} />
          </Field>
          <Field label="Bajada (opcional)" hint="El texto chico debajo del nombre en la barra lateral.">
            <Input value={lema} onChange={(e) => setLema(e.target.value)} placeholder="Sistema de hospedaje" maxLength={60} />
          </Field>
          <Button
            variant="primary"
            disabled={busy || !nombre.trim()}
            onClick={() => void run(() => api.updateBrand({ nombre, lema }), "Nombre actualizado.", "No se pudo guardar el nombre.")}
          >
            Guardar
          </Button>
          {error && <Notice>{error}</Notice>}
          {ok && <Notice kind="ok">{ok}</Notice>}
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------- Apariencia ------------------------------- */

function formatHour12(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(isNaN(m) ? 0 : m).padStart(2, "0")} ${ampm}`;
}

function AppearanceTab() {
  const { theme, toggle, config, updateConfig, peruTime, isScheduledDark } = useTheme();

  const [autoEnabled, setAutoEnabled] = useState(config.autoEnabled);
  const [startTime, setStartTime] = useState(config.startTime);
  const [endTime, setEndTime] = useState(config.endTime);
  const [manualTheme, setManualTheme] = useState(config.manualTheme);

  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAutoEnabled(config.autoEnabled);
    setStartTime(config.startTime);
    setEndTime(config.endTime);
    setManualTheme(config.manualTheme);
  }, [config.autoEnabled, config.startTime, config.endTime, config.manualTheme]);

  const handleSave = async () => {
    setBusy(true);
    setOk(null);
    setError(null);
    try {
      if (!startTime || !endTime) {
        throw new Error("Por favor completa los horarios de inicio y fin.");
      }
      await updateConfig({
        autoEnabled,
        startTime,
        endTime,
        manualTheme,
      });
      setOk("Configuración de apariencia guardada correctamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetDefaults = () => {
    setStartTime("18:00");
    setEndTime("07:00");
    setAutoEnabled(true);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Reloj y Estado en Vivo */}
      <Section title="Horario Oficial de Perú (UTC-5)">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-inset p-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand/15 text-brand">
              <IconClock className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Hora actual en Lima, Perú</p>
              <p className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-ink tabular-nums">
                {peruTime.timeString}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {autoEnabled ? (
                  isScheduledDark ? (
                    <Badge tone="tone-slate" className="gap-1.5 py-1">
                      <IconMoon className="h-3.5 w-3.5" />
                      <span>Modo Oscuro Activo (Noche hasta las {formatHour12(endTime)})</span>
                    </Badge>
                  ) : (
                    <Badge tone="tone-amber" className="gap-1.5 py-1">
                      <IconSun className="h-3.5 w-3.5" />
                      <span>Modo Claro Activo (Día hasta las {formatHour12(startTime)})</span>
                    </Badge>
                  )
                ) : (
                  <Badge tone={manualTheme === "dark" ? "tone-slate" : "tone-amber"} className="gap-1.5 py-1">
                    {manualTheme === "dark" ? <IconMoon className="h-3.5 w-3.5" /> : <IconSun className="h-3.5 w-3.5" />}
                    <span>Modo Manual Fijo ({manualTheme === "dark" ? "Oscuro" : "Claro"})</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Card className="bg-inset p-3.5 shadow-none">
            <p className="text-xs leading-relaxed text-muted">
              El horario del sistema se sincroniza con la zona horaria oficial de Perú (America/Lima, UTC-5)
              automáticamente, garantizando que el modo oscuro se aplique puntualmente a las {formatHour12(startTime)} y
              retorne al modo claro a las {formatHour12(endTime)} independientemente del reloj de la PC o dispositivo.
            </p>
          </Card>
        </div>
      </Section>

      {/* Programación Automática */}
      <Section title="Programación de Modo Oscuro">
        <div className="flex flex-col gap-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-raised p-3.5 transition-colors hover:border-brand/40">
            <input
              type="checkbox"
              checked={autoEnabled}
              onChange={(e) => setAutoEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-line text-brand accent-brand focus:ring-brand"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">Activar modo oscuro automático</span>
              <span className="text-xs text-muted">
                Cambia automáticamente entre modo claro y modo oscuro según el horario configurado abajo.
              </span>
            </div>
          </label>

          <div className={cx("grid gap-4 sm:grid-cols-2 transition-opacity", !autoEnabled && "opacity-40 pointer-events-none")}>
            <Field label="Inicio del modo oscuro (Noche)" hint={`Equivale a: ${formatHour12(startTime)}`}>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={!autoEnabled || busy}
              />
            </Field>

            <Field label="Fin del modo oscuro (Amanecer)" hint={`Equivale a: ${formatHour12(endTime)}`}>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={!autoEnabled || busy}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !autoEnabled}
              onClick={handleResetDefaults}
            >
              Restablecer a 18:00 — 07:00 (Por defecto)
            </Button>
          </div>
        </div>
      </Section>

      {/* Selector de Tema Manual / Vista Previa */}
      <Section title="Tema Predeterminado" className="lg:col-span-2">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">
            {autoEnabled
              ? "El modo automático está activo. Puedes elegir el tema que se usará si se desactiva la programación, o hacer clic en cualquiera para probarlo ahora:"
              : "Selecciona el tema que permanecerá visible de forma continua:"}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Tarjeta Claro */}
            <div
              onClick={() => {
                setManualTheme("light");
                if (!autoEnabled) {
                  void updateConfig({ manualTheme: "light" });
                }
              }}
              className={cx(
                "group relative flex cursor-pointer items-center gap-4 rounded-2xl border p-4.5 transition-all duration-200",
                manualTheme === "light"
                  ? "border-brand bg-brand/5 shadow-sm ring-2 ring-brand/20"
                  : "border-line bg-raised hover:border-brand/40 hover:bg-inset"
              )}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <IconSun className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">Modo Claro</p>
                  {manualTheme === "light" && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-ink">
                      <IconCheck className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Superficies claras, alto contraste y lectura óptima para luz de día.
                </p>
              </div>
            </div>

            {/* Tarjeta Oscuro */}
            <div
              onClick={() => {
                setManualTheme("dark");
                if (!autoEnabled) {
                  void updateConfig({ manualTheme: "dark" });
                }
              }}
              className={cx(
                "group relative flex cursor-pointer items-center gap-4 rounded-2xl border p-4.5 transition-all duration-200",
                manualTheme === "dark"
                  ? "border-brand bg-brand/5 shadow-sm ring-2 ring-brand/20"
                  : "border-line bg-raised hover:border-brand/40 hover:bg-inset"
              )}
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-500/15 text-slate-700 dark:text-slate-300">
                <IconMoon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">Modo Oscuro</p>
                  {manualTheme === "dark" && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-brand-ink">
                      <IconCheck className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  Superficies profundas y menor brillo para turnos de noche y recepción con poca luz.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={toggle}
                title="Cambiar tema de la pantalla en este momento"
              >
                {theme === "dark" ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
                <span>Probar alternar tema ahora ({theme === "dark" ? "Ver Claro" : "Ver Oscuro"})</span>
              </Button>
            </div>

            <Button
              variant="primary"
              disabled={busy}
              onClick={handleSave}
            >
              {busy ? "Guardando…" : "Guardar ajustes de apariencia"}
            </Button>
          </div>

          {error && <Notice kind="error">{error}</Notice>}
          {ok && <Notice kind="ok">{ok}</Notice>}
        </div>
      </Section>
    </div>
  );
}


/* ------------------------------- Cobros ------------------------------- */

interface Draft {
  tipo: "BILLETERA" | "BANCO";
  proveedor: string;
  titular: string;
  telefono: string;
  numeroCuenta: string;
  cci: string;
  notas: string;
}

const emptyDraft = (tipo: "BILLETERA" | "BANCO"): Draft => ({
  tipo,
  proveedor: tipo === "BILLETERA" ? "YAPE" : "",
  titular: "",
  telefono: "",
  numeroCuenta: "",
  cci: "",
  notas: "",
});

function CollectionAccountsTab() {
  const [cuentas, setCuentas] = useState<CollectionAccount[] | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft("BILLETERA"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => setCuentas(await api.collectionAccounts());

  useEffect(() => {
    void reload();
  }, []);

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const crear = () =>
    run(async () => {
      await api.createCollectionAccount({
        tipo: draft.tipo,
        proveedor: draft.proveedor,
        titular: draft.titular,
        telefono: draft.telefono || null,
        numeroCuenta: draft.numeroCuenta || null,
        cci: draft.cci || null,
        notas: draft.notas || null,
        orden: (cuentas?.length ?? 0) + 1,
      });
      setDraft(emptyDraft(draft.tipo));
    }, "No se pudo agregar el canal de cobro.");

  const billeteras = cuentas?.filter((c) => c.tipo === "BILLETERA") ?? [];
  const bancos = cuentas?.filter((c) => c.tipo === "BANCO") ?? [];

  const rowProps = (cuenta: CollectionAccount, index: number) => ({
    cuenta,
    index,
    busy,
    editing: editingId === cuenta.id,
    confirming: confirmDeleteId === cuenta.id,
    onEdit: () => {
      setEditingId(editingId === cuenta.id ? null : cuenta.id);
      setConfirmDeleteId(null);
    },
    onConfirmDelete: () => setConfirmDeleteId(confirmDeleteId === cuenta.id ? null : cuenta.id),
    run,
    onDone: () => setEditingId(null),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <div className="flex flex-col gap-5">
        {error && <Notice>{error}</Notice>}

        <Section title="Billeteras digitales" subtitle="Lo que ve el huésped en el kiosco al elegir Yape, Plin, Lemon o Agora">
          {cuentas === null ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : billeteras.length === 0 ? (
            <EmptyState
              icon={<IconWallet className="h-6 w-6" />}
              title="Todavía no hay billeteras"
              hint="Agregá una y subí la foto del QR que exportás desde la app de la billetera."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {billeteras.map((cuenta, i) => (
                <AccountRow key={cuenta.id} {...rowProps(cuenta, i)} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Cuentas bancarias" subtitle="Para las transferencias: el huésped ve el número de cuenta y el CCI" delay={80}>
          {cuentas === null ? (
            <Skeleton className="h-20" />
          ) : bancos.length === 0 ? (
            <EmptyState icon={<IconBank className="h-6 w-6" />} title="Todavía no hay cuentas bancarias" hint="Podés cargar varias, de bancos distintos." />
          ) : (
            <div className="flex flex-col gap-2">
              {bancos.map((cuenta, i) => (
                <AccountRow key={cuenta.id} {...rowProps(cuenta, i)} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Agregar canal de cobro" delay={140}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            {(["BILLETERA", "BANCO"] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setDraft(emptyDraft(tipo))}
                className={cx(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  draft.tipo === tipo ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:bg-inset hover:text-ink",
                )}
              >
                {tipo === "BILLETERA" ? <IconWallet className="h-4 w-4" /> : <IconBank className="h-4 w-4" />}
                {tipo === "BILLETERA" ? "Billetera" : "Banco"}
              </button>
            ))}
          </div>

          {draft.tipo === "BILLETERA" ? (
            <Field label="Billetera">
              <select
                value={draft.proveedor}
                onChange={(e) => setDraft({ ...draft, proveedor: e.target.value })}
                className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink"
              >
                {WALLET_PROVIDERS.map((w) => (
                  <option key={w} value={w}>
                    {WALLET_LABEL[w] ?? w}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Banco o caja" hint="Escribí el que sea — la lista es solo una ayuda.">
              <Input
                list="bancos-sugeridos"
                value={draft.proveedor}
                onChange={(e) => setDraft({ ...draft, proveedor: e.target.value })}
                placeholder="BCP, Interbank, Caja Ica…"
              />
              <datalist id="bancos-sugeridos">
                {BANCOS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
          )}

          <Field label="Titular">
            <Input value={draft.titular} onChange={(e) => setDraft({ ...draft, titular: e.target.value })} placeholder="A nombre de quién está la cuenta" />
          </Field>

          {draft.tipo === "BILLETERA" ? (
            <Field label="Teléfono (opcional)">
              <Input value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} placeholder="987 654 321" />
            </Field>
          ) : (
            <>
              <Field label="Número de cuenta">
                <Input value={draft.numeroCuenta} onChange={(e) => setDraft({ ...draft, numeroCuenta: e.target.value })} placeholder="194-1234567-0-89" />
              </Field>
              <Field label="CCI" hint="Los 20 dígitos del código interbancario, para que le transfieran desde otro banco.">
                <Input value={draft.cci} onChange={(e) => setDraft({ ...draft, cci: e.target.value })} placeholder="00219400123456789012" />
              </Field>
            </>
          )}

          <Field label="Nota para el huésped (opcional)">
            <Input value={draft.notas} onChange={(e) => setDraft({ ...draft, notas: e.target.value })} placeholder="Cuenta en soles" />
          </Field>

          <Button variant="primary" icon={<IconPlus className="h-4 w-4" />} disabled={busy || !draft.proveedor.trim() || !draft.titular.trim()} onClick={crear}>
            Agregar
          </Button>

          <Card className="bg-inset p-3 shadow-none">
            <p className="text-xs text-muted">
              La foto del QR se sube desde la fila de cada billetera, ya creada. Subí el QR que exportás desde la app de la billetera: es el único que cobra de verdad.
              Un canal desactivado deja de ofrecerse en el kiosco pero conserva los pagos que ya entraron por él.
            </p>
          </Card>
        </div>
      </Section>
    </div>
  );
}

function AccountRow({
  cuenta,
  index,
  busy,
  editing,
  confirming,
  onEdit,
  onConfirmDelete,
  run,
  onDone,
}: {
  cuenta: CollectionAccount;
  index: number;
  busy: boolean;
  editing: boolean;
  confirming: boolean;
  onEdit: () => void;
  onConfirmDelete: () => void;
  run: (fn: () => Promise<unknown>, fallback: string) => Promise<void>;
  onDone: () => void;
}) {
  const esBilletera = cuenta.tipo === "BILLETERA";
  const [form, setForm] = useState({
    proveedor: cuenta.proveedor,
    titular: cuenta.titular,
    telefono: cuenta.telefono ?? "",
    numeroCuenta: cuenta.numeroCuenta ?? "",
    cci: cuenta.cci ?? "",
    notas: cuenta.notas ?? "",
  });
  const qrInput = useRef<HTMLInputElement>(null);

  const detalle = esBilletera
    ? [cuenta.telefono, cuenta.notas].filter(Boolean).join(" · ")
    : [cuenta.numeroCuenta && `Cuenta ${cuenta.numeroCuenta}`, cuenta.cci && `CCI ${cuenta.cci}`, cuenta.notas].filter(Boolean).join(" · ");

  return (
    <div className={cx("stagger rounded-xl border border-line p-3 transition-opacity", !cuenta.activa && "opacity-55")} style={{ ["--i" as string]: index }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {esBilletera && (
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-inset">
              {cuenta.qrUrl ? (
                <img src={cuenta.qrUrl} alt={`QR de ${cuenta.proveedor}`} className="h-full w-full object-contain" />
              ) : (
                <span className="text-center text-[10px] leading-tight text-subtle">Sin QR</span>
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {esBilletera ? (WALLET_LABEL[cuenta.proveedor] ?? cuenta.proveedor) : cuenta.proveedor}
              <span className="text-muted"> · {cuenta.titular}</span>
            </p>
            <p className="truncate text-xs text-muted">{detalle || "Sin datos adicionales"}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {!cuenta.activa && <Badge tone="tone-stone">Inactiva</Badge>}
          {esBilletera && (
            <>
              <input
                ref={qrInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void run(() => api.uploadCollectionAccountQr(cuenta.id, file), "No se pudo cargar el QR.");
                }}
              />
              <Button size="sm" disabled={busy} onClick={() => qrInput.current?.click()}>
                {cuenta.qrUrl ? "Cambiar QR" : "Subir QR"}
              </Button>
              {cuenta.qrUrl && (
                <Button size="sm" disabled={busy} onClick={() => void run(() => api.deleteCollectionAccountQr(cuenta.id), "No se pudo quitar el QR.")}>
                  Quitar QR
                </Button>
              )}
            </>
          )}
          <Button size="sm" onClick={onEdit}>
            {editing ? "Cerrar" : "Editar"}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void run(() => api.updateCollectionAccount(cuenta.id, { activa: !cuenta.activa }), "No se pudo cambiar el estado.")}
          >
            {cuenta.activa ? "Desactivar" : "Activar"}
          </Button>
          <Button size="sm" variant="danger" disabled={busy} title="Borrar canal de cobro" onClick={onConfirmDelete}>
            <IconX className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="animate-fade mt-3 grid gap-3 rounded-lg bg-inset p-3 sm:grid-cols-2">
          <Field label={esBilletera ? "Billetera" : "Banco o caja"}>
            {esBilletera ? (
              <select
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                className="w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink"
              >
                {WALLET_PROVIDERS.map((w) => (
                  <option key={w} value={w}>
                    {WALLET_LABEL[w] ?? w}
                  </option>
                ))}
              </select>
            ) : (
              <Input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
            )}
          </Field>
          <Field label="Titular">
            <Input value={form.titular} onChange={(e) => setForm({ ...form, titular: e.target.value })} />
          </Field>
          {esBilletera ? (
            <Field label="Teléfono">
              <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </Field>
          ) : (
            <>
              <Field label="Número de cuenta">
                <Input value={form.numeroCuenta} onChange={(e) => setForm({ ...form, numeroCuenta: e.target.value })} />
              </Field>
              <Field label="CCI">
                <Input value={form.cci} onChange={(e) => setForm({ ...form, cci: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="Nota para el huésped">
            <Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <Button
              variant="primary"
              block
              disabled={busy || !form.proveedor.trim() || !form.titular.trim()}
              onClick={() =>
                void run(async () => {
                  await api.updateCollectionAccount(cuenta.id, {
                    proveedor: form.proveedor,
                    titular: form.titular,
                    telefono: form.telefono || null,
                    numeroCuenta: form.numeroCuenta || null,
                    cci: form.cci || null,
                    notas: form.notas || null,
                  });
                  onDone();
                }, "No se pudieron guardar los cambios.")
              }
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      )}

      {confirming && (
        <div className="animate-fade mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-inset p-2.5">
          <span className="text-xs text-muted">¿Borrar este canal de cobro? Si solo querés dejar de ofrecerlo, mejor desactivalo.</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={onConfirmDelete}>
              Cancelar
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => void run(() => api.deleteCollectionAccount(cuenta.id), "No se pudo borrar el canal.")}>
              Sí, borrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
