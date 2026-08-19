import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import type { NotificationEventCode, NotificationQueueItem, NotificationRecipient, NotificationState, NotificationTemplate } from "@casacarlos/contracts";
import { IconBell } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Select, Tabs, Textarea, cx } from "../components/ui.js";

type WhatsAppStatus = "AGENTE_OFFLINE" | "DESCONECTADO" | "ESPERANDO_QR" | "CONECTADO";

const WHATSAPP_TONE: Record<WhatsAppStatus, string> = {
  AGENTE_OFFLINE: "tone-rose",
  DESCONECTADO: "tone-stone",
  ESPERANDO_QR: "tone-amber",
  CONECTADO: "tone-teal",
};

const WHATSAPP_LABEL: Record<WhatsAppStatus, string> = {
  AGENTE_OFFLINE: "Agente apagado",
  DESCONECTADO: "Desconectado",
  ESPERANDO_QR: "Esperando que escanees el código",
  CONECTADO: "Conectado",
};

/** Pestaña para vincular el WhatsApp real del hotel — ver services/notifications/src/whatsapp-bridge.ts. */
function WhatsAppTab() {
  const [status, setStatus] = useState<WhatsAppStatus>("DESCONECTADO");
  const [qr, setQr] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyStatus = (s: { status: WhatsAppStatus; qr: string | null }) => {
    setStatus(s.status);
    setQr(s.qr);
  };

  const load = async () => {
    try {
      applyStatus(await api.whatsappStatus());
    } catch {
      // silencioso -- el sondeo reintenta solo
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mientras no esté conectado del todo, sondea cada 2s para ver si ya llegó
  // el QR o si alguien lo escaneó -- no hay WebSocket para esto, es un flujo
  // de una sola vez, no vale la pena.
  useEffect(() => {
    if (status === "CONECTADO") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(load, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!qr) {
      setQrImage(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(qr, { margin: 1, width: 280 }).then((url) => {
      if (!cancelled) setQrImage(url);
    });
    return () => {
      cancelled = true;
    };
  }, [qr]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      applyStatus(await api.whatsappConnect());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar WhatsApp.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      applyStatus(await api.whatsappDisconnect());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desconectar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="WhatsApp del hotel" subtitle="El teléfono que manda los avisos automáticos — cuarto excedido, stock bajo, diferencia de caja">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <Badge tone={WHATSAPP_TONE[status]}>{WHATSAPP_LABEL[status]}</Badge>

        {status === "AGENTE_OFFLINE" && (
          <>
            <p className="max-w-sm text-sm text-muted">
              El asistente de WhatsApp todavía no respondió. Arranca solo con Windows y se reconecta solo — normalmente esto se resuelve en unos
              segundos después de prender la PC.
            </p>
            <p className="max-w-sm text-sm text-subtle">
              Si sigue así, abrí el acceso directo <strong>«Hospedaje Carlos — WhatsApp»</strong> del Escritorio. No hace falta volver a escanear el
              código: la vinculación se conserva.
            </p>
          </>
        )}

        {status === "DESCONECTADO" && (
          <>
            <p className="max-w-sm text-sm text-muted">
              Conectá el WhatsApp del hotel una sola vez — después las notificaciones se mandan solas, sin tocar nada más.
            </p>
            <Button variant="primary" size="lg" onClick={connect} disabled={busy}>
              {busy ? "Conectando…" : "Conectar WhatsApp"}
            </Button>
          </>
        )}

        {status === "ESPERANDO_QR" && (
          <>
            <p className="max-w-sm text-sm text-muted">
              Abrí WhatsApp en el teléfono del hotel → <strong>Dispositivos vinculados</strong> → <strong>Vincular un dispositivo</strong>, y escaneá este código.
            </p>
            {qrImage ? (
              <img src={qrImage} alt="Código QR para vincular WhatsApp" className="animate-pop rounded-2xl border border-line shadow-[var(--shadow-card)]" width={280} height={280} />
            ) : (
              <div className="grid h-[280px] w-[280px] place-items-center rounded-2xl border border-line bg-inset text-sm text-subtle">Generando código…</div>
            )}
            <p className="text-xs text-subtle">Se actualiza solo — no hace falta recargar la página.</p>
          </>
        )}

        {status === "CONECTADO" && (
          <>
            <p className="max-w-sm text-sm text-muted">Listo — las notificaciones se mandan automáticamente desde este WhatsApp. Solo hizo falta escanear una vez.</p>
            <Button variant="danger" onClick={disconnect} disabled={busy}>
              {busy ? "Desconectando…" : "Desvincular"}
            </Button>
          </>
        )}

        {error && (
          <div className="w-full max-w-sm">
            <Notice>{error}</Notice>
          </div>
        )}
      </div>
    </Section>
  );
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

const QUEUE_TONE: Record<NotificationState, string> = {
  PENDIENTE: "tone-amber",
  ENVIADO: "tone-teal",
  FALLIDO: "tone-red",
};

const QUEUE_STATE_LABEL: Record<NotificationState, string> = {
  PENDIENTE: "Pendiente",
  ENVIADO: "Enviado",
  FALLIDO: "Fallido",
};

type Tab = "destinatarios" | "plantillas" | "cola" | "whatsapp";

/** Chip que se puede prender/apagar — se usa para suscribir a cada evento. */
function EventChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-95",
        on ? "tone-teal" : "bg-inset text-subtle hover:text-muted",
      )}
    >
      {label}
    </button>
  );
}

export function NotificationsModule() {
  const [tab, setTab] = useState<Tab>("destinatarios");
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
    <>
      <PageHeader
        title="Notificaciones"
        subtitle="A quién se avisa por WhatsApp, con qué texto y qué pasó con cada envío"
        actions={
          <Tabs<Tab>
            tabs={[
              { id: "whatsapp", label: "WhatsApp" },
              { id: "destinatarios", label: "Destinatarios" },
              { id: "plantillas", label: "Plantillas" },
              { id: "cola", label: "Cola" },
            ]}
            active={tab}
            onChange={setTab}
          />
        }
      />

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {tab === "whatsapp" && <WhatsAppTab />}

      {tab === "destinatarios" && (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Section title="Destinatarios registrados">
            {recipients.length === 0 ? (
              <EmptyState icon={<IconBell className="h-6 w-6" />} title="Sin destinatarios" hint="Agregá a quién avisar cuando pase algo importante." />
            ) : (
              <div className="flex flex-col gap-2">
                {recipients.map((r, i) => (
                  <div
                    key={r.id}
                    className={cx("stagger rounded-xl border border-line p-3 transition-opacity", !r.activo && "opacity-50")}
                    style={{ ["--i" as string]: i }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{r.nombre}</p>
                        <p className="text-xs text-muted">{r.telefono}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          await api.updateNotificationRecipient(r.id, { activo: !r.activo });
                          await loadRecipients();
                        }}
                      >
                        {r.activo ? "Activo" : "Inactivo"}
                      </Button>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {EVENT_CODES.map((codigo) => (
                        <EventChip key={codigo} label={EVENT_LABEL[codigo]} on={r.eventos.includes(codigo)} onClick={() => toggleRecipientEvent(r, codigo)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Nuevo destinatario" delay={80}>
            <div className="flex flex-col gap-4">
              <Field label="Nombre">
                <Input placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </Field>
              <Field label="WhatsApp" hint="Con código de país, ej. 51987654321">
                <Input placeholder="51987654321" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </Field>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Eventos a los que se suscribe</p>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_CODES.map((codigo) => (
                    <EventChip
                      key={codigo}
                      label={EVENT_LABEL[codigo]}
                      on={eventos.includes(codigo)}
                      onClick={() => setEventos((prev) => (prev.includes(codigo) ? prev.filter((e) => e !== codigo) : [...prev, codigo]))}
                    />
                  ))}
                </div>
              </div>
              <Button variant="primary" onClick={createRecipient} disabled={busy || !nombre || !telefono || eventos.length === 0}>
                Agregar destinatario
              </Button>
            </div>
          </Section>
        </div>
      )}

      {tab === "plantillas" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {templates.map((t, i) => (
            <Section key={t.codigo} title={EVENT_LABEL[t.codigo]} subtitle={`Variables: ${EVENT_VARS[t.codigo]}`} delay={i * 60}>
              <div className="flex flex-col gap-3">
                <Textarea rows={3} value={drafts[t.codigo] ?? ""} onChange={(e) => setDrafts((prev) => ({ ...prev, [t.codigo]: e.target.value }))} />
                <Button variant="primary" className="self-start" onClick={() => saveTemplate(t.codigo)} disabled={busy || drafts[t.codigo] === t.cuerpo}>
                  Guardar
                </Button>
              </div>
            </Section>
          ))}
        </div>
      )}

      {tab === "cola" && (
        <Section
          title="Cola de envíos"
          actions={
            <Select value={queueFilter} onChange={(e) => setQueueFilter(e.target.value as NotificationState | "")} className="w-48">
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="ENVIADO">Enviado</option>
              <option value="FALLIDO">Fallido</option>
            </Select>
          }
        >
          {queue.length === 0 ? (
            <EmptyState icon={<IconBell className="h-6 w-6" />} title="Sin notificaciones en la cola" hint="Acá aparece cada mensaje que el sistema intentó enviar." />
          ) : (
            <div className="flex flex-col gap-2">
              {queue.map((item, i) => (
                <div key={item.id} className="stagger rounded-xl border border-line p-3" style={{ ["--i" as string]: i }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {EVENT_LABEL[item.codigo]} · {item.destinatarioNombre}
                      </p>
                      <p className="text-xs text-muted">{new Date(item.creadoEn).toLocaleString("es-PE")}</p>
                    </div>
                    <Badge tone={QUEUE_TONE[item.estado]}>{QUEUE_STATE_LABEL[item.estado]}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted">{item.mensaje}</p>
                  {item.ultimoError && <p className="mt-1 text-xs text-danger">{item.ultimoError}</p>}
                  {item.estado === "FALLIDO" && (
                    <Button size="sm" className="mt-2" onClick={() => retry(item.id)} disabled={busy}>
                      Reintentar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  );
}
