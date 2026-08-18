import { useEffect, useMemo, useState } from "react";
import type { FloorBoard, Modality } from "@casacarlos/contracts";
import { IconCalendar } from "@casacarlos/ui";
import { api, ApiError } from "../api.js";
import { Badge, Button, Card, EmptyState, Field, Input, Notice, PageHeader, Section, Select } from "../components/ui.js";

interface Props {
  floors: FloorBoard[];
}

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

  useEffect(() => {
    api.modalities().then((list) => {
      setModalities(list);
      if (list[0]) setModalidadId(list[0].id);
    });
  }, []);

  const modalidad = modalities.find((m) => m.id === modalidadId);
  const esPorNoche = !!modalidad?.checkinFijo;

  // No se filtra por el estado ACTUAL del cuarto: una reserva es para una fecha
  // futura y el backend valida el solapamiento contra la ventana real pedida
  // (assertNoOverlap). Un cuarto ocupado hoy puede estar libre mañana.
  const seleccionables = useMemo(
    () => floors.flatMap((f) => f.rooms.filter((r) => r.estado !== "FUERA_DE_SERVICIO").map((r) => ({ ...r, pisoNombre: f.floor.nombre }))),
    [floors],
  );

  const reservados = useMemo(
    () => floors.flatMap((f) => f.rooms.filter((r) => r.estado === "RESERVADO").map((r) => ({ ...r, pisoNombre: f.floor.nombre }))),
    [floors],
  );

  const completo = cuartoId && modalidadId && reservadaPara && nombres && apellidos && dni;

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la reserva.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Reservas" subtitle="Reservá un cuarto para una fecha futura — la disponibilidad se valida contra la ventana pedida" />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Section title="Nueva reserva">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Modalidad">
                <Select value={modalidadId} onChange={(e) => setModalidadId(e.target.value)}>
                  {modalities.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Cuarto">
                <Select value={cuartoId} onChange={(e) => setCuartoId(e.target.value)}>
                  <option value="">Elegir cuarto…</option>
                  {seleccionables.map((r) => (
                    <option key={r.room.id} value={r.room.id}>
                      {r.pisoNombre} — Cuarto {r.room.numero}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Fecha y hora de la reserva">
                <Input type="datetime-local" value={reservadaPara} onChange={(e) => setReservadaPara(e.target.value)} />
              </Field>

              {esPorNoche && (
                <Field label="Noches">
                  <Input type="number" min={1} value={noches} onChange={(e) => setNoches(Math.max(1, Number(e.target.value)))} />
                </Field>
              )}
            </div>

            <div className="border-t border-line-soft pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Datos del huésped</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombres">
                  <Input value={nombres} onChange={(e) => setNombres(e.target.value)} placeholder="Nombres" />
                </Field>
                <Field label="Apellidos">
                  <Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" />
                </Field>
                <Field label="DNI">
                  <Input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="DNI" />
                </Field>
                <Field label="Teléfono (opcional)">
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono" />
                </Field>
              </div>
            </div>

            {error && <Notice>{error}</Notice>}
            {ok && <Notice kind="ok">{ok}</Notice>}

            <Button variant="primary" size="lg" disabled={busy || !completo} onClick={submit}>
              {busy ? "Creando…" : "Crear reserva"}
            </Button>
          </div>
        </Section>

        <Section title="Cuartos reservados" subtitle="Reservas activas sobre el tablero" delay={80}>
          {reservados.length === 0 ? (
            <EmptyState icon={<IconCalendar className="h-6 w-6" />} title="Sin reservas activas" hint="Las reservas que crees aparecerán acá y en el tablero." />
          ) : (
            <div className="flex flex-col gap-2">
              {reservados.map((r) => (
                <Card key={r.room.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">Cuarto {r.room.numero}</p>
                    <p className="truncate text-xs text-muted">
                      {r.pisoNombre}
                      {r.clienteNombre ? ` · ${r.clienteNombre}` : ""}
                    </p>
                  </div>
                  <Badge tone="tone-violet">Reservado</Badge>
                </Card>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
