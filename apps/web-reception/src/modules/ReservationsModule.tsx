import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import breezyThemePlugin from "@fullcalendar/react/themes/breezy";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/breezy/theme.css";
import "@fullcalendar/react/themes/breezy/palettes/emerald.css";
import type { FloorBoard, Modality, StayWithCustomer } from "@casacarlos/contracts";
import { formatDateTime12h } from "@casacarlos/contracts";
import { IconCalendar } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Select, Skeleton } from "../components/ui.js";

interface Props {
  floors: FloorBoard[];
}

const STATE_LABEL: Record<string, string> = {
  RESERVADA: "Reservada",
  EN_CURSO: "En curso",
  EN_TOLERANCIA: "En tolerancia",
  EXCEDIDA: "Excedida",
  FINALIZADA: "Finalizada",
  ANULADA: "Anulada",
};

const STATE_COLOR: Record<string, string> = {
  RESERVADA: "#7c3aed",
  EN_CURSO: "#0d9488",
  EN_TOLERANCIA: "#d97706",
  EXCEDIDA: "#e11d48",
  FINALIZADA: "#64748b",
  ANULADA: "#94a3b8",
};

export function ReservationsModule({ floors }: Props) {
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [modalidadId, setModalidadId] = useState("");
  const [cuartoId, setCuartoId] = useState("");
  const [reservadaPara, setReservadaPara] = useState("");
  const [noches, setNoches] = useState(1);
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [stays, setStays] = useState<StayWithCustomer[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleRange, setVisibleRange] = useState({ desde: new Date().toISOString().slice(0, 10), hasta: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    api.modalities().then((list) => {
      setModalities(list);
      if (list[0]) setModalidadId(list[0].id);
    });
  }, []);

  const roomMeta = useMemo(
    () => new Map(floors.flatMap((floor) => floor.rooms.map((entry) => [entry.room.id, { numero: entry.room.numero, piso: floor.floor.nombre, estado: entry.estado }] as const))),
    [floors],
  );
  const modalidad = modalities.find((item) => item.id === modalidadId);
  const esPorNoche = !!modalidad?.checkinFijo;
  const seleccionables = useMemo(
    () => floors.flatMap((floor) => floor.rooms.filter((entry) => entry.estado !== "FUERA_DE_SERVICIO").map((entry) => ({ ...entry, pisoNombre: floor.floor.nombre }))),
    [floors],
  );
  const selected = stays?.find((stay) => stay.id === selectedId) ?? null;
  const reservasVisibles = stays?.filter((stay) => stay.tipo === "RESERVA" && stay.estado !== "ANULADA") ?? [];
  const completo = cuartoId && modalidadId && reservadaPara && nombres && apellidos && dni;

  const loadCalendar = async (range: { desde: string; hasta: string }) => {
    setVisibleRange(range);
    setError(null);
    try {
      setStays(await api.staysByRange(range));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron cargar las reservas.");
      setStays([]);
    }
  };

  const submit = async () => {
    if (!completo) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await api.createReservation({
        cuartoId,
        modalidadId,
        cliente: { nombres, apellidos, dni, telefono: telefono || null },
        reservadaPara: new Date(reservadaPara).toISOString(),
        noches: esPorNoche ? noches : undefined,
      });
      setOk(`Reserva creada para ${nombres} ${apellidos}.`);
      setNombres("");
      setApellidos("");
      setDni("");
      setTelefono("");
      setReservadaPara("");
      setCuartoId("");
      await loadCalendar(visibleRange);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la reserva.");
    } finally {
      setBusy(false);
    }
  };

  const calendarEvents = (stays ?? []).map((stay) => {
    const room = roomMeta.get(stay.cuartoId);
    return {
      id: stay.id,
      title: `Cuarto ${room?.numero ?? "—"} · ${stay.cliente.nombres} ${stay.cliente.apellidos}`,
      start: stay.bloqueoDesde,
      end: stay.bloqueoHasta,
      backgroundColor: STATE_COLOR[stay.estado] ?? "#64748b",
      borderColor: STATE_COLOR[stay.estado] ?? "#64748b",
      textColor: "#ffffff",
    };
  });

  return (
    <>
      <PageHeader title="Reservas" subtitle="Calendario operativo por día, semana o mes, con disponibilidad validada por el servidor" />

      {error && <div className="mb-4"><Notice>{error}</Notice></div>}
      {ok && <div className="mb-4"><Notice kind="ok">{ok}</Notice></div>}

      <Card className="mb-5 p-4 sm:p-5">
        {stays === null && <Skeleton className="mb-3 h-8" />}
        <div className="reservation-calendar">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, breezyThemePlugin]}
            initialView="dayGridMonth"
            locale="es"
            firstDay={1}
            height="auto"
            nowIndicator
            dayMaxEvents={3}
            events={calendarEvents}
            eventClick={(info) => setSelectedId(info.event.id)}
            dateClick={(info) => setReservadaPara(`${info.dateStr.slice(0, 10)}T14:00`)}
            datesSet={(info) => {
              const inclusiveEnd = new Date(info.end);
              inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
              void loadCalendar({ desde: info.startStr.slice(0, 10), hasta: inclusiveEnd.toISOString().slice(0, 10) });
            }}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          />
        </div>
      </Card>

      {selected && (
        <Card className="mb-5 border-l-4 border-l-brand p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-ink">Cuarto {roomMeta.get(selected.cuartoId)?.numero ?? "—"}</h2>
                <Badge tone={selected.estado === "RESERVADA" ? "tone-violet" : selected.estado === "EN_CURSO" ? "tone-teal" : "tone-stone"}>{STATE_LABEL[selected.estado]}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{selected.cliente.nombres} {selected.cliente.apellidos} · DNI {selected.cliente.dni}</p>
              <p className="mt-1 text-xs text-subtle">{formatDateTime12h(selected.bloqueoDesde)} → {formatDateTime12h(selected.bloqueoHasta)}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setSelectedId(null)}>Cerrar detalle</Button>
              {selected.estado === "RESERVADA" && <Button variant="primary" disabled={busy} onClick={async () => { setBusy(true); try { await api.checkInReservation(selected.id); await loadCalendar(visibleRange); } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo hacer check-in."); } finally { setBusy(false); } }}>Hacer check-in</Button>}
              {selected.estado === "RESERVADA" && <Button variant="danger" disabled={busy} onClick={async () => { const motivo = window.prompt("Motivo de la cancelación"); if (!motivo) return; setBusy(true); try { await api.cancelStay(selected.id, motivo); setSelectedId(null); await loadCalendar(visibleRange); } catch (err) { setError(err instanceof ApiError ? err.message : "No se pudo cancelar."); } finally { setBusy(false); } }}>Cancelar reserva</Button>}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <Section title="Nueva reserva" subtitle="También podés tocar una fecha del calendario para precargarla">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Modalidad"><Select value={modalidadId} onChange={(event) => setModalidadId(event.target.value)}>{modalities.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</Select></Field>
              <Field label="Cuarto"><Select value={cuartoId} onChange={(event) => setCuartoId(event.target.value)}><option value="">Elegir cuarto…</option>{seleccionables.map((entry) => <option key={entry.room.id} value={entry.room.id}>{entry.pisoNombre} — Cuarto {entry.room.numero}</option>)}</Select></Field>
              <Field label="Fecha y hora"><Input type="datetime-local" value={reservadaPara} onChange={(event) => setReservadaPara(event.target.value)} /></Field>
              {esPorNoche && <Field label="Noches"><Input type="number" min={1} value={noches} onChange={(event) => setNoches(Math.max(1, Number(event.target.value)))} /></Field>}
            </div>
            <div className="border-t border-line-soft pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Datos del huésped</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombres"><Input value={nombres} onChange={(event) => setNombres(event.target.value)} /></Field>
                <Field label="Apellidos"><Input value={apellidos} onChange={(event) => setApellidos(event.target.value)} /></Field>
                <Field label="DNI"><Input value={dni} onChange={(event) => setDni(event.target.value)} /></Field>
                <Field label="Teléfono (opcional)"><Input value={telefono} onChange={(event) => setTelefono(event.target.value)} /></Field>
              </div>
            </div>
            <Button variant="primary" size="lg" disabled={busy || !completo} onClick={submit}>{busy ? "Guardando…" : "Crear reserva"}</Button>
          </div>
        </Section>

        <Section title="Reservas del periodo" subtitle={`${reservasVisibles.length} visibles en el calendario`} delay={80}>
          {reservasVisibles.length === 0 ? (
            <EmptyState icon={<IconCalendar className="h-6 w-6" />} title="Sin reservas en este periodo" hint="Navegá a otra semana o mes, o crea una nueva reserva." />
          ) : (
            <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
              {reservasVisibles.map((stay) => (
                <button key={stay.id} onClick={() => setSelectedId(stay.id)} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:bg-inset/60">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">Cuarto {roomMeta.get(stay.cuartoId)?.numero ?? "—"} · {stay.cliente.nombres}</span><span className="block truncate text-xs text-muted">{formatDateTime12h(stay.bloqueoDesde)}</span></span>
                  <Badge tone={stay.estado === "RESERVADA" ? "tone-violet" : "tone-stone"}>{STATE_LABEL[stay.estado]}</Badge>
                </button>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
