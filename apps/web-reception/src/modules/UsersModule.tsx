import { useEffect, useMemo, useState } from "react";
import {
  APP_PERMISSIONS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  type AppPermission,
  type Role,
  type User,
} from "@casacarlos/contracts";
import { IconUsers } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Select, Skeleton, cx } from "../components/ui.js";

const PERMISSION_LABEL: Record<AppPermission, { label: string; description: string }> = {
  BOARD_VIEW: { label: "Tablero", description: "Ver el estado de los cuartos." },
  SALES_MANAGE: { label: "Ventas", description: "Crear ventas, cobrar y hacer check-out." },
  RESERVATIONS_MANAGE: { label: "Reservas", description: "Crear, consultar y cancelar reservas." },
  CASHBOX_MANAGE: { label: "Caja", description: "Abrir/cerrar turnos y revisar movimientos." },
  INVENTORY_MANAGE: { label: "Bodega", description: "Consultar y operar productos y stock." },
  CATEGORIES_MANAGE: { label: "Categorías", description: "Configurar categorías del inventario." },
  ROOMS_MANAGE: { label: "Cuartos", description: "Crear y editar pisos, cuartos y tarifas." },
  BILLING_MANAGE: { label: "Comprobantes", description: "Emitir y consultar documentos SUNAT." },
  DASHBOARD_VIEW: { label: "Dashboard", description: "Ver indicadores financieros y operativos." },
  REPORTS_EXPORT: { label: "Reportes", description: "Abrir y exportar hojas de cálculo y PDF." },
  NOTIFICATIONS_MANAGE: { label: "Notificaciones", description: "Gestionar avisos y destinatarios." },
  SETTINGS_MANAGE: { label: "Ajustes", description: "Cambiar marca, cobros y credenciales SUNAT." },
  USERS_MANAGE: { label: "Usuarios", description: "Crear cuentas y asignar accesos." },
};

interface UserForm {
  usuario: string;
  nombres: string;
  apellidos: string;
  telefonoWhatsapp: string;
  password: string;
  pin: string;
  rol: Role;
  activo: boolean;
  permisos: AppPermission[];
}

const blankForm = (): UserForm => ({
  usuario: "",
  nombres: "",
  apellidos: "",
  telefonoWhatsapp: "",
  password: "",
  pin: "",
  rol: "RECEPCIONISTA",
  activo: true,
  permisos: [...DEFAULT_PERMISSIONS_BY_ROLE.RECEPCIONISTA],
});

const formFromUser = (user: User): UserForm => ({
  usuario: user.usuario,
  nombres: user.nombres,
  apellidos: user.apellidos,
  telefonoWhatsapp: user.telefonoWhatsapp ?? "",
  password: "",
  pin: "",
  rol: user.rol,
  activo: user.activo,
  permisos: [...user.permisos],
});

export function UsersModule({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<UserForm>(blankForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selected = useMemo(() => users?.find((user) => user.id === selectedId) ?? null, [selectedId, users]);

  const load = async () => {
    try {
      setUsers(await api.users());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar los usuarios.");
      setUsers([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startCreate = () => {
    setSelectedId(null);
    setCreating(true);
    setForm(blankForm());
    setError(null);
    setOk(null);
  };

  const startEdit = (user: User) => {
    setCreating(false);
    setSelectedId(user.id);
    setForm(formFromUser(user));
    setError(null);
    setOk(null);
  };

  const setRole = (rol: Role) => {
    setForm((current) => ({ ...current, rol, permisos: [...DEFAULT_PERMISSIONS_BY_ROLE[rol]] }));
  };

  const togglePermission = (permission: AppPermission) => {
    setForm((current) => ({
      ...current,
      permisos: current.permisos.includes(permission)
        ? current.permisos.filter((item) => item !== permission)
        : [...current.permisos, permission],
    }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      if (creating) {
        const created = await api.createUser({
          usuario: form.usuario,
          password: form.password,
          nombres: form.nombres,
          apellidos: form.apellidos,
          rol: form.rol,
          pin: form.pin || undefined,
          telefonoWhatsapp: form.telefonoWhatsapp || null,
          permisos: form.permisos,
        });
        await load();
        startEdit(created);
        setOk("Usuario creado correctamente.");
      } else if (selected) {
        const updated = await api.updateUser(selected.id, {
          usuario: form.usuario,
          nombres: form.nombres,
          apellidos: form.apellidos,
          rol: form.rol,
          activo: form.activo,
          telefonoWhatsapp: form.telefonoWhatsapp || null,
          permisos: form.permisos,
          ...(form.password ? { password: form.password } : {}),
          ...(form.pin ? { pin: form.pin } : {}),
        });
        await load();
        setForm(formFromUser(updated));
        setOk("Cambios guardados.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar el usuario.");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (user: User) => {
    if (!window.confirm(`¿Desactivar a ${user.nombres} ${user.apellidos}? Su historial se conservará.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteUser(user.id);
      await load();
      setSelectedId(null);
      setCreating(false);
      setOk("Usuario desactivado. Sus movimientos e historial siguen intactos.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desactivar el usuario.");
    } finally {
      setBusy(false);
    }
  };

  const showingForm = creating || selected;
  const complete = form.usuario.trim().length >= 3 && form.nombres.trim() && form.apellidos.trim() && (!creating || form.password.length >= 6);

  return (
    <>
      <PageHeader
        title="Usuarios y accesos"
        subtitle="Cuentas del personal, estado y permisos efectivos por módulo"
        actions={<Button variant="primary" onClick={startCreate}>+ Nuevo usuario</Button>}
      />

      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {ok && <div className="mb-4"><Notice kind="ok">{ok}</Notice></div>}

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.45fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-semibold text-ink">Personal</h2>
            <p className="mt-0.5 text-xs text-muted">{users?.length ?? 0} cuentas registradas</p>
          </div>
          {users === null ? (
            <div className="flex flex-col gap-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16" />)}</div>
          ) : users.length === 0 ? (
            <EmptyState icon={<IconUsers className="h-6 w-6" />} title="Todavía no hay usuarios" hint="Crea la primera cuenta del personal." />
          ) : (
            <div className="divide-y divide-line-soft">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => startEdit(user)}
                  className={cx("flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-inset/60", selectedId === user.id && "bg-brand-soft")}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-inset text-sm font-bold text-brand">
                    {user.nombres[0]}{user.apellidos[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{user.nombres} {user.apellidos}</span>
                    <span className="block truncate text-xs text-muted">@{user.usuario} · {user.permisos.length} accesos</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone={user.rol === "ADMIN" ? "tone-violet" : "tone-sky"}>{user.rol === "ADMIN" ? "Admin" : "Recepción"}</Badge>
                    {!user.activo && <span className="text-[10px] font-medium text-danger">Inactivo</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {!showingForm ? (
          <Card className="grid min-h-[430px] place-items-center p-8">
            <EmptyState icon={<IconUsers className="h-6 w-6" />} title="Seleccioná una cuenta" hint="Podrás editar sus datos, reactivar o limitar los módulos que puede usar." action={<Button onClick={startCreate}>Crear usuario</Button>} />
          </Card>
        ) : (
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">{creating ? "Nuevo usuario" : `${selected!.nombres} ${selected!.apellidos}`}</h2>
                <p className="mt-1 text-sm text-muted">{creating ? "Los permisos se pueden ajustar antes de guardar." : "Los cambios de acceso se aplican en el siguiente ingreso."}</p>
              </div>
              {!creating && selected && selected.id !== currentUser.id && selected.activo && (
                <Button size="sm" variant="danger" onClick={() => deactivate(selected)} disabled={busy}>Desactivar</Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombres"><Input value={form.nombres} onChange={(e) => setForm((current) => ({ ...current, nombres: e.target.value }))} /></Field>
              <Field label="Apellidos"><Input value={form.apellidos} onChange={(e) => setForm((current) => ({ ...current, apellidos: e.target.value }))} /></Field>
              <Field label="Usuario"><Input value={form.usuario} onChange={(e) => setForm((current) => ({ ...current, usuario: e.target.value }))} /></Field>
              <Field label="WhatsApp"><Input value={form.telefonoWhatsapp} onChange={(e) => setForm((current) => ({ ...current, telefonoWhatsapp: e.target.value }))} placeholder="Opcional" /></Field>
              <Field label={creating ? "Contraseña" : "Nueva contraseña (opcional)"}><Input type="password" value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))} /></Field>
              <Field label={creating ? "PIN rápido (opcional)" : "Nuevo PIN (opcional)"}><Input inputMode="numeric" value={form.pin} onChange={(e) => setForm((current) => ({ ...current, pin: e.target.value }))} /></Field>
              <Field label="Rol">
                <Select value={form.rol} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="RECEPCIONISTA">Recepcionista</option>
                  <option value="ADMIN">Administrador</option>
                </Select>
              </Field>
              {!creating && <Field label="Estado"><Select value={form.activo ? "ACTIVO" : "INACTIVO"} onChange={(e) => setForm((current) => ({ ...current, activo: e.target.value === "ACTIVO" }))}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></Select></Field>}
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Acceso a módulos</h3>
                  <p className="text-xs text-muted">Oculta la vista y bloquea su API en el servidor.</p>
                </div>
                <Button size="sm" onClick={() => setForm((current) => ({ ...current, permisos: [...DEFAULT_PERMISSIONS_BY_ROLE[current.rol]] }))}>Restaurar rol</Button>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {APP_PERMISSIONS.map((permission) => {
                  const item = PERMISSION_LABEL[permission];
                  const checked = form.permisos.includes(permission);
                  return (
                    <label key={permission} className={cx("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", checked ? "border-brand/40 bg-brand-soft" : "border-line hover:bg-inset/60")}>
                      <input type="checkbox" checked={checked} onChange={() => togglePermission(permission)} className="mt-0.5 h-4 w-4 accent-[var(--c-brand)]" />
                      <span><span className="block text-sm font-medium text-ink">{item.label}</span><span className="block text-xs leading-relaxed text-muted">{item.description}</span></span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button onClick={() => { setCreating(false); setSelectedId(null); }}>Cancelar</Button>
              <Button variant="primary" onClick={save} disabled={busy || !complete}>{busy ? "Guardando…" : "Guardar usuario"}</Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
