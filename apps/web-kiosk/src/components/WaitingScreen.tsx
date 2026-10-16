import { IconLoader } from "@casacarlos/ui";
import { KioskAmbient } from "./KioskAmbient.js";

interface Props {
  title: string;
  subtitle: string;
}

export function WaitingScreen({ title, subtitle }: Props) {
  return (
    <div className="animate-fade relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-bg px-10 text-center">
      <KioskAmbient />
      <div className="relative z-10 flex flex-col items-center rounded-2xl border border-line bg-surface/90 p-8 shadow-[var(--shadow-card)]">
        <IconLoader className="h-12 w-12 animate-spin text-brand motion-reduce:animate-none" />
        <h1 className="animate-fade-up mt-8 font-sans text-3xl text-ink">{title}</h1>
        <p className="animate-fade-up mt-3 max-w-sm text-lg text-muted" style={{ animationDelay: "80ms" }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
