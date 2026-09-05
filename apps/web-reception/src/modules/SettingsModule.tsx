import { useEffect, useRef, useState } from "react";
import type { Brand, CollectionAccount } from "@casacarlos/contracts";
import { WALLET_PROVIDERS } from "@casacarlos/contracts";
import { IconBank, IconPlus, IconWallet, IconX } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { setBrand, useBrand } from "../hooks/useBrand.js";
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
  const [tab, setTab] = useState<"marca" | "cobros">("marca");

  return (
    <>
      <PageHeader title="Ajustes" subtitle="El logo y el nombre que muestra todo el sistema, y las cuentas por las que el hotel cobra" />
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: "marca" as const, label: "Marca" },
            { id: "cobros" as const, label: "Cobros" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>
      {tab === "marca" ? <BrandTab /> : <CollectionAccountsTab />}
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
