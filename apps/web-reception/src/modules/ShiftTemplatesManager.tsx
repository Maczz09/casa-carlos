import { ActionButton } from "@casacarlos/ui/components/action-button";
import { ModalFrame } from "@casacarlos/ui/components/modal-frame";
import { useState, useEffect } from "react";
import type { CashboxAutomation, ShiftTemplate } from "@casacarlos/contracts";
import { formatTime12h } from "@casacarlos/contracts";
import { IconClock, IconPlus, IconTrash, IconCheck, IconX, IconAlertTriangle, IconSliders } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Button, Card, EmptyState, Field, Input, Notice, Section, Skeleton, Switch, cx } from "../components/ui.js";

interface ShiftTemplatesManagerProps {
  onTemplatesChange?: (templates: ShiftTemplate[]) => void;
  className?: string;
}

export const CARLOS_PRESET_SHIFTS = [
  { nombre: "Turno Mañana (Día)", horaInicio: "09:00", horaFin: "17:00", orden: 1 },
  { nombre: "Turno Tarde", horaInicio: "17:00", horaFin: "01:00", orden: 2 },
  { nombre: "Turno Noche (Madrugada)", horaInicio: "01:00", horaFin: "09:00", orden: 3 },
];

export function calculateDuration(horaInicio: string, horaFin: string): { durationText: string; crossesMidnight: boolean } {
  const parts1 = horaInicio.split(":");
  const parts2 = horaFin.split(":");
  const h1 = Number(parts1[0]);
  const m1 = Number(parts1[1]);
  const h2 = Number(parts2[0]);
  const m2 = Number(parts2[1]);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) {
    return { durationText: "", crossesMidnight: false };
  }
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  const crossesMidnight = mins <= 0;
  if (crossesMidnight) mins += 24 * 60;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const durationText = remMins === 0 ? `${hours} hrs` : `${hours} hrs ${remMins} min`;
  return { durationText, crossesMidnight };
}

export function ShiftTemplatesManager({ onTemplatesChange, className }: ShiftTemplatesManagerProps) {
  const [templates, setTemplates] = useState<ShiftTemplate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [automation, setAutomation] = useState<CashboxAutomation | null>(null);
  const [automationBusy, setAutomationBusy] = useState(false);

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formHoraInicio, setFormHoraInicio] = useState("09:00");
  const [formHoraFin, setFormHoraFin] = useState("17:00");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Confirmar Eliminar
  const [deletingTemplate, setDeletingTemplate] = useState<ShiftTemplate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Preset Aplicar 3 Turnos
  const [presetBusy, setPresetBusy] = useState(false);
  const [showPresetConfirm, setShowPresetConfirm] = useState(false);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await api.shiftTemplates();
      setTemplates(list);
      setAutomation(await api.cashboxAutomation());
      onTemplatesChange?.(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar las plantillas de turnos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
    let pending: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(pending); pending = setTimeout(() => void loadTemplates(), 150); };
    window.addEventListener("casacarlos:cashbox-changed", refresh);
    return () => { clearTimeout(pending); window.removeEventListener("casacarlos:cashbox-changed", refresh); };
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormNombre("");
    setFormHoraInicio("09:00");
    setFormHoraFin("17:00");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (t: ShiftTemplate) => {
    setEditingTemplate(t);
    setFormNombre(t.nombre);
    setFormHoraInicio(t.horaInicio);
    setFormHoraFin(t.horaFin);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (formBusy) return;
    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      setFormError("Por favor ingresa un nombre para el turno.");
      return;
    }
    if (!formHoraInicio || !formHoraFin) {
      setFormError("Por favor define las horas de inicio y fin.");
      return;
    }

    try {
      setFormBusy(true);
      setFormError(null);
      if (editingTemplate) {
        await api.updateShiftTemplate(editingTemplate.id, {
          nombre: formNombre.trim(),
          horaInicio: formHoraInicio,
          horaFin: formHoraFin,
        });
        setOkMessage(`Turno "${formNombre.trim()}" actualizado con éxito.`);
      } else {
        await api.createShiftTemplate({
          nombre: formNombre.trim(),
          horaInicio: formHoraInicio,
          horaFin: formHoraFin,
        });
        setOkMessage(`Turno "${formNombre.trim()}" creado con éxito.`);
      }
      setIsModalOpen(false);
      await loadTemplates();
      setTimeout(() => setOkMessage(null), 4000);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Error al guardar el turno.");
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    try {
      setDeleteBusy(true);
      await api.deleteShiftTemplate(deletingTemplate.id);
      setOkMessage(`Turno "${deletingTemplate.nombre}" eliminado correctamente.`);
      setDeletingTemplate(null);
      await loadTemplates();
      setTimeout(() => setOkMessage(null), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al eliminar el turno.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleApplyPreset = async () => {
    try {
      setPresetBusy(true);
      setError(null);
      await api.applyStandardSchedule();
      setOkMessage("¡Se configuraron con éxito los 3 turnos de Casa Carlos (9 am, 5 pm, 1 am)!");
      setShowPresetConfirm(false);
      await loadTemplates();
      setTimeout(() => setOkMessage(null), 6000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al aplicar los turnos preestablecidos.");
    } finally {
      setPresetBusy(false);
    }
  };

  const modalPreview = calculateDuration(formHoraInicio, formHoraFin);

  return (
    <div className={cx("space-y-6", className)}>
      {error && <Notice kind="error">{error}</Notice>}
      {okMessage && <Notice kind="ok">{okMessage}</Notice>}
      <Card className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-ink">Relevos automáticos de la caja compartida</h3><p className="mt-1 text-sm text-muted">Hora de Lima. Después de la primera apertura, al terminar cada horario se cierra su tramo y el fondo esperado pasa al siguiente. El relevo queda auditado y no sustituye el arqueo físico.</p></div>
          <Switch aria-label="Relevos automáticos" checked={automation?.habilitado ?? false} disabled={!automation || automationBusy} onCheckedChange={async habilitado => { setAutomationBusy(true); setError(null); try { setAutomation(await api.setCashboxAutomation(habilitado)); } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cambiar la automatización."); } finally { setAutomationBusy(false); } }} />
        </div>
        {automation?.problema && <Notice kind="warn">{automation.problema}</Notice>}
        {automation?.habilitado && automation.horarioValido && <p className="text-sm font-medium text-brand">Activo: el cambio se sincroniza en todas las sesiones. Si cierras caja manualmente, una nueva apertura requiere declarar el fondo.</p>}
      </Card>

      {/* Tarjeta de Acceso Rápido: Los 3 Turnos de Carlos */}
      <Card className="border-brand/30 bg-brand/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-brand-ink text-xs font-bold">
                3
              </span>
              <h3 className="text-base font-bold text-ink">Horarios de atención de Carlos (3 turnos rotativos)</h3>
            </div>
            <p className="text-xs text-muted max-w-2xl leading-relaxed">
              Configuración solicitada para el hotel con turnos continuos de 8 horas:
              <strong className="text-ink ml-1">9:00 AM</strong> a <strong className="text-ink">5:00 PM</strong>,{" "}
              <strong className="text-ink">5:00 PM</strong> a <strong className="text-ink">1:00 AM</strong> y{" "}
              <strong className="text-ink">1:00 AM</strong> a <strong className="text-ink">9:00 AM</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="primary"
              size="md"
              icon={<IconCheck className="h-4 w-4" />}
              disabled={presetBusy}
              onClick={() => {
                if (templates && templates.length > 0) {
                  setShowPresetConfirm(true);
                } else {
                  handleApplyPreset();
                }
              }}
            >
              {presetBusy ? "Configurando…" : "Aplicar 3 turnos automáticos"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de Turnos Configurados */}
      <Section
        title="Turnos configurados"
        subtitle="Turnos disponibles para la apertura de caja y control de relevos del recepcionista"
        actions={
          <Button variant="secondary" size="sm" icon={<IconPlus className="h-4 w-4" />} onClick={openCreateModal}>
            Nuevo turno
          </Button>
        }
      >
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        )}

        {!loading && templates && templates.length === 0 && (
          <EmptyState
            icon={<IconClock className="h-8 w-8 text-subtle" />}
            title="Aún no hay turnos registrados"
            hint="Puedes crear turnos individuales o hacer clic en 'Aplicar 3 turnos automáticos' arriba para cargarlos de una vez."
            action={
              <Button variant="primary" size="md" icon={<IconPlus className="h-4 w-4" />} onClick={openCreateModal}>
                Crear primer turno
              </Button>
            }
          />
        )}

        {!loading && templates && templates.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => {
              const { durationText, crossesMidnight } = calculateDuration(t.horaInicio, t.horaFin);
              return (
                <div
                  key={t.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand/40 hover:shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-ink text-sm truncate">{t.nombre}</h4>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                          <IconClock className="h-3.5 w-3.5 text-subtle" />
                          <span>{t.horaInicio} – {t.horaFin} (24h)</span>
                        </div>
                      </div>
                      <span className="shrink-0 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                        {durationText}
                      </span>
                    </div>

                    <div className="rounded-lg bg-inset p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        <span>{formatTime12h(t.horaInicio)}</span>
                        <span className="text-subtle">→</span>
                        <span>{formatTime12h(t.horaFin)}</span>
                      </div>
                      {crossesMidnight && (
                        <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500">
                          Cruza noche
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-line-soft pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(t)}
                      className="text-xs text-brand hover:text-brand-hover"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconTrash className="h-3.5 w-3.5" />}
                      onClick={() => setDeletingTemplate(t)}
                      className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Modal Crear / Editar Turno */}
      {isModalOpen && (
        <ModalFrame title="Registrar o editar turno" onClose={closeModal} busy={formBusy}>
          <Card className="relative w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-line-soft pb-3">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand mb-1">
                  <IconSliders className="h-3.5 w-3.5" />
                  {editingTemplate ? "Modificar turno" : "Nuevo turno"}
                </span>
                <h3 className="text-lg font-bold text-ink">
                  {editingTemplate ? `Editar: ${editingTemplate.nombre}` : "Registrar nuevo turno"}
                </h3>
              </div>
              <ActionButton aria-label="Cerrar"
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-muted hover:bg-inset hover:text-ink transition-colors"
                disabled={formBusy}
              >
                <IconX className="h-5 w-5" />
              </ActionButton>
            </div>

            {formError && <Notice kind="error">{formError}</Notice>}

            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Nombre del turno" hint="Ej: Turno Mañana, Turno Tarde, Turno Noche">
                <Input aria-label="Ej: Turno Mañana"
                  type="text"
                  placeholder="Ej: Turno Mañana"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  autoFocus
                  required
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Hora de inicio">
                  <Input
                    type="time"
                    value={formHoraInicio}
                    onChange={(e) => setFormHoraInicio(e.target.value)}
                    required
                  />
                  <span className="text-[11px] font-medium text-brand">
                    {formatTime12h(formHoraInicio) || "—"}
                  </span>
                </Field>

                <Field label="Hora de fin">
                  <Input
                    type="time"
                    value={formHoraFin}
                    onChange={(e) => setFormHoraFin(e.target.value)}
                    required
                  />
                  <span className="text-[11px] font-medium text-brand">
                    {formatTime12h(formHoraFin) || "—"}
                  </span>
                </Field>
              </div>

              {/* Tarjeta de Vista Previa */}
              <div className="rounded-xl border border-line bg-inset p-3 space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-subtle">Vista previa del horario</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{formNombre || "Nombre del turno"}</span>
                  <span className="text-xs font-medium text-brand">{modalPreview.durationText}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{formatTime12h(formHoraInicio)} a {formatTime12h(formHoraFin)}</span>
                  {modalPreview.crossesMidnight && (
                    <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-500">
                      Cruza medianoche
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-4">
                <Button type="button" variant="secondary" onClick={closeModal} disabled={formBusy}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={formBusy}>
                  {formBusy ? "Guardando…" : editingTemplate ? "Guardar cambios" : "Crear turno"}
                </Button>
              </div>
            </form>
          </Card>
        </ModalFrame>
      )}

      {/* Modal Confirmar Eliminar */}
      {deletingTemplate && (
        <ModalFrame title="Eliminar turno" onClose={() => setDeletingTemplate(null)} busy={deleteBusy}>
          <Card className="relative w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-500">
                <IconAlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink">¿Eliminar turno?</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  ¿Estás seguro de que deseas eliminar el turno <strong>"{deletingTemplate.nombre}"</strong> ({formatTime12h(deletingTemplate.horaInicio)} a {formatTime12h(deletingTemplate.horaFin)})?
                </p>
                <p className="mt-2 text-xs text-subtle">
                  Nota: Si ya existen aperturas de caja anteriores con este turno, el registro se desactivará de forma segura para no alterar los reportes históricos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-3">
              <Button variant="secondary" onClick={() => setDeletingTemplate(null)} disabled={deleteBusy}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteBusy}>
                {deleteBusy ? "Eliminando…" : "Sí, eliminar turno"}
              </Button>
            </div>
          </Card>
        </ModalFrame>
      )}

      {/* Modal Confirmar Aplicar Preset */}
      {showPresetConfirm && (
        <ModalFrame title="Configurar turnos" onClose={() => setShowPresetConfirm(false)} busy={presetBusy}>
          <Card className="relative w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                <IconClock className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink">Configurar 3 turnos automáticos</h3>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Se reemplazarán los horarios activos por estos tres turnos y se habilitarán los relevos automáticos. Los horarios anteriores se conservarán para sus reportes históricos.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-ink">
                  <li>• <strong>Turno Mañana:</strong> 9:00 AM – 5:00 PM (09:00 - 17:00)</li>
                  <li>• <strong>Turno Tarde:</strong> 5:00 PM – 1:00 AM (17:00 - 01:00)</li>
                  <li>• <strong>Turno Noche:</strong> 1:00 AM – 9:00 AM (01:00 - 09:00)</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-3">
              <Button variant="secondary" onClick={() => setShowPresetConfirm(false)} disabled={presetBusy}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleApplyPreset} disabled={presetBusy}>
                {presetBusy ? "Configurando…" : "Aplicar horarios y activar relevos"}
              </Button>
            </div>
          </Card>
        </ModalFrame>
      )}
    </div>
  );
}
