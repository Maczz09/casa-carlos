import { useEffect, useState } from "react";
import type { NotificationEventCode, NotificationQueueItem, NotificationRecipient, NotificationState, NotificationTemplate } from "@casacarlos/contracts";
import { api, ApiError } from "../api.js";

interface Props {
  onClose: () => void;
}

const EVENT_CODES: NotificationEventCode[] = ["STAY_OVERSTAYED", "LOW_STOCK", "SHIFT_DIFFERENCE"];

const EVENT_LABEL: Record<NotificationEventCode, string> = {
  STAY_OVERSTAYED: "Cuarto excedido",
  LOW_STOCK: "Stock bajo",
  SHIFT_DIFFERENCE: "Diferencia de caja",
};

const EVENT_VARS: Record<NotificationEventCode, string> = {
  STAY_OVERSTAYED: "{{cuarto}}, {{minutos}}",
  LOW_STOCK: "{{producto}}, {{stock}}, {{minimo}}",
  SHIFT_DIFFERENCE: "{{cajero}}, {{diferencia}}",
};

const QUEUE_STATE_STYLE: Record<NotificationState, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700",
  ENVIADO: "bg-teal-50 text-teal-700",
  FALLIDO: "bg-rose-50 text-rose-700",
};

const QUEUE_STATE_LABEL: Record<NotificationState, string> = {
  PENDIENTE: "Pendiente",
  ENVIADO: "Enviado",
  FALLIDO: "Fallido",
};

export function NotificationsPanel({ onClose }: Props) {
  const [tab, setTab] = useState<"destinatarios" | "plantillas" | "cola">("destinatarios");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [eventos, setEventos] = useState<NotificationEventCode[]>([]);

  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const [queue, setQueue] = useState<NotificationQueueItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<NotificationState | "">("");

  const loadRecipients = () => api.notificationRecipients().then(setRecipients);
  const loadTemplates = () =>
    api.notificationTemplates().then((list) => {
      setTemplates(list);
      setDrafts(Object.fromEntries(list.map((t) => [t.codigo, t.cuerpo])));
    });
  const loadQueue = () => api.notificationQueue(queueFilter || undefined).then(setQueue);

  useEffect(() => {
    loadRecipients();
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "cola") loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, queueFilter]);

  const toggleEvento = (codigo: NotificationEventCode) => {
    setEventos((prev) => (prev.includes(codigo) ? prev.filter((e) => e !== codigo) : [...prev, codigo]));
  };

  const createRecipient = async () => {
    if (!nombre || !telefono || eventos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.createNotificationRecipient({ nombre, telefono, eventos });
      setNombre("");
      setTelefono("");
      setEventos([]);
      await loadRecipients();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear el destinatario.");
    } finally {
      setBusy(false);
    }
  };

  const toggleRecipientEvent = async (recipient: NotificationRecipient, codigo: NotificationEventCode) => {
    const nextEventos = recipient.eventos.includes(codigo) ? recipient.eventos.filter((e) => e !== codigo) : [...recipient.eventos, codigo];
    await api.updateNotificationRecipient(recipient.id, { eventos: nextEventos });
    await loadRecipients();
  };

  const toggleRecipientActivo = async (recipient: NotificationRecipient) => {
    await api.updateNotificationRecipient(recipient.id, { activo: !recipient.activo });
    await loadRecipients();
  };

  const saveTemplate = async (codigo: NotificationEventCode) => {
    setBusy(true);
    setError(null);
    try {
      await api.updateNotificationTemplate(codigo, drafts[codigo] ?? "");
      await loadTemplates();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la plantilla.");
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.retryNotification(id);
      await loadQueue();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reintentar el envío.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Notificaciones</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mb-5 flex gap-2 rounded-lg bg-slate-900 p-1 text-sm">
          <button onClick={() => setTab("destinatarios")} className={`flex-1 rounded-md py-1.5 ${tab === "destinatarios" ? "bg-slate-700 text-white" : "text-slate-400"}`}>
            Destinatarios
          </button>
          <button onClick={() => setTab("plantillas")} className={`flex-1 rounded-md py-1.5 ${tab === "plantillas" ? "bg-slate-700 text-white" : "text-slate-400"}`}>
            Plantillas
          </button>
          <button onClick={() => setTab("cola")} className={`flex-1 rounded-md py-1.5 ${tab === "cola" ? "bg-slate-700 text-white" : "text-slate-400"}`}>
            Cola
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-rose-400">{error}</p>}

        {tab === "destinatarios" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {recipients.length === 0 && <p className="text-sm text-slate-500">Sin destinatarios registrados.</p>}
              {recipients.map((r) => (
                <div key={r.id} className={`rounded-lg bg-slate-900 p-3 ${r.activo ? "" : "opacity-50"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{r.nombre}</p>
                      <p className="text-xs text-slate-400">{r.telefono}</p>
                    </div>
                    <button onClick={() => toggleRecipientActivo(r)} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700">
                      {r.activo ? "Activo" : "Inactivo"}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {EVENT_CODES.map((codigo) => (
                      <button
                        key={codigo}
                        onClick={() => toggleRecipientEvent(r, codigo)}
                        className={`rounded-full px-2 py-0.5 text-xs ${r.eventos.includes(codigo) ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-500"}`}
                      >
                        {EVENT_LABEL[codigo]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 rounded-lg bg-slate-900 p-4">
              <p className="text-sm font-medium text-white">Nuevo destinatario</p>
              <input placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white" />
              <input
                placeholder="WhatsApp (ej. 51987654321)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              />
              <div className="flex flex-wrap gap-1.5">
                {EVENT_CODES.map((codigo) => (
                  <button
                    key={codigo}
                    onClick={() => toggleEvento(codigo)}
                    className={`rounded-full px-2 py-0.5 text-xs ${eventos.includes(codigo) ? "bg-indigo-500/20 text-indigo-300" : "bg-slate-800 text-slate-500"}`}
                  >
                    {EVENT_LABEL[codigo]}
                  </button>
                ))}
              </div>
              <button
                onClick={createRecipient}
                disabled={busy || !nombre || !telefono || eventos.length === 0}
                className="rounded-lg bg-emerald-600 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          </div>
        )}

        {tab === "plantillas" && (
          <div className="flex flex-col gap-4">
            {templates.map((t) => (
              <div key={t.codigo} className="flex flex-col gap-2 rounded-lg bg-slate-900 p-4">
                <p className="text-sm font-medium text-white">{EVENT_LABEL[t.codigo]}</p>
                <p className="text-xs text-slate-500">Variables disponibles: {EVENT_VARS[t.codigo]}</p>
                <textarea
                  value={drafts[t.codigo] ?? ""}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [t.codigo]: e.target.value }))}
                  rows={3}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                />
                <button
                  onClick={() => saveTemplate(t.codigo)}
                  disabled={busy || drafts[t.codigo] === t.cuerpo}
                  className="self-start rounded-lg bg-slate-700 px-4 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-40"
                >
                  Guardar
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "cola" && (
          <div className="flex flex-col gap-3">
            <select
              value={queueFilter}
              onChange={(e) => setQueueFilter(e.target.value as NotificationState | "")}
              className="w-fit rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ENVIADO">Enviado</option>
              <option value="FALLIDO">Fallido</option>
            </select>

            <div className="flex flex-col gap-2">
              {queue.length === 0 && <p className="text-sm text-slate-500">Sin notificaciones en la cola.</p>}
              {queue.map((item) => (
                <div key={item.id} className="rounded-lg bg-slate-900 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-white">
                        {EVENT_LABEL[item.codigo]} · {item.destinatarioNombre}
                      </p>
                      <p className="text-xs text-slate-400">{new Date(item.creadoEn).toLocaleString("es-PE")}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${QUEUE_STATE_STYLE[item.estado]}`}>{QUEUE_STATE_LABEL[item.estado]}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{item.mensaje}</p>
                  {item.ultimoError && <p className="mt-1 text-xs text-rose-400">{item.ultimoError}</p>}
                  {item.estado === "FALLIDO" && (
                    <button onClick={() => retry(item.id)} disabled={busy} className="mt-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-white hover:bg-slate-600 disabled:opacity-50">
                      Reintentar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
