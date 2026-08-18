import { useEffect, useState } from "react";

/** Recomputes every second, client-side — the server never needs to push per-second ticks. */
export function useCountdown(targetIso: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  return new Date(targetIso).getTime() - now;
}

export function formatDuration(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${sign}${h > 0 ? `${pad(h)}:` : ""}${pad(m)}:${pad(s)}`;
}
