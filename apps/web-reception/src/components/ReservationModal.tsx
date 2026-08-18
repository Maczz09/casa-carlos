import { useEffect, useState } from "react";
import type { FloorBoard, Modality } from "@casacarlos/contracts";
import { api, ApiError } from "../api.js";

interface Props {
  floors: FloorBoard[];
  onClose: () => void;
}

/** Reserva un cuarto para una fecha/hora futura (no es un walk-in) — RES-01: la modalidad siempre es el primer dato que se pide. */
export function ReservationModal({ floors, onClose }: Props) {
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

  useEffect(() => {
    api.modalities().then((list) => {
      setModalities(list);
      if (list[0]) setModalidadId(list[0].id);
    });
  }, []);

  const modalidad = modalities.find((m) => m.id === modalidadId);
  const esPorNoche = !!modalidad?.checkinFijo;

  const disponibles = floors.flatMap((f) => f.rooms.filter((r) => r.estado === "DISPONIBLE").map((r) => ({ ...r, pisoNombre: f.floor.nombre })));

  const submit = async () => {
    if (!cuartoId || !modalidadId || !reservadaPara || !nombres || !apellidos || !dni) return;
    setBusy(true);
    setError(null);
    try {
      await api.createReservation({
        cuartoId,
        modalidadId,
        cliente: { nombres, apellidos, dni, telefono: telefono || null },
        reservadaPara: new Date(reservadaPara).toISOString(),
        noches: esPorNoche ? noches : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la reserva.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Nueva reserva</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <select value={modalidadId} onChange={(e) => setModalidadId(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white">
            {modalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>

          <select value={cuartoId} onChange={(e) => setCuartoId(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white">
            <option value="">Elegir cuarto disponible…</option>
            {disponibles.map((r) => (
              <option key={r.room.id} value={r.room.id}>
                {r.pisoNombre} — Cuarto {r.room.numero}
              </option>
            ))}
          </select>

          <label className="text-xs text-slate-400">
            Fecha y hora de la reserva
            <input
              type="datetime-local"
              value={reservadaPara}
              onChange={(e) => setReservadaPara(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
            />
          </label>

          {esPorNoche && (
            <label className="text-xs text-slate-400">
              Noches
              <input
                type="number"
                min={1}
                value={noches}
                onChange={(e) => setNoches(Math.max(1, Number(e.target.value)))}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nombres" value={nombres} onChange={(e) => setNombres(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
            <input placeholder="Apellidos" value={apellidos} onChange={(e) => setApellidos(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
          </div>
          <input placeholder="DNI" value={dni} onChange={(e) => setDni(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" />
          <input
            placeholder="Teléfono (opcional)"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white"
          />

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || !cuartoId || !modalidadId || !reservadaPara || !nombres || !apellidos || !dni}
            className="rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Crear reserva
          </button>
        </div>
      </div>
    </div>
  );
}
