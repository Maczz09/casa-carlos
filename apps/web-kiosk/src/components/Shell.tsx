import type { ReactNode } from "react";
import { IconArrowLeft } from "@casacarlos/ui";

interface Props {
  title?: string;
  step?: string;
  onBack?: () => void;
  children: ReactNode;
}

/** Consistent chrome for every non-idle screen: a slim header, generous body, nothing else competing for attention. */
export function Shell({ title, step, onBack, children }: Props) {
  return (
    <div className="animate-fade-up flex h-screen flex-col bg-bg">
      <header className="flex items-center gap-4 px-10 py-6">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted shadow-[var(--shadow-card)] ring-1 ring-line transition-transform active:scale-95"
          >
            <IconArrowLeft className="h-6 w-6" />
          </button>
        ) : (
          <div className="h-14 w-14" />
        )}
        <div className="flex-1 text-center">
          {step && <p className="font-serif text-sm uppercase tracking-[0.2em] text-brand/70">{step}</p>}
          {title && <h1 className="font-serif text-2xl text-ink">{title}</h1>}
        </div>
        <div className="h-14 w-14" />
      </header>
      <main className="flex flex-1 flex-col overflow-y-auto px-10 pb-10">{children}</main>
    </div>
  );
}
