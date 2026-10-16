import { ActionButton } from "@casacarlos/ui/components/action-button";
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
    <div className="animate-fade-up flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-bg">
      <header className="shrink-0 border-b border-line/70 bg-surface/70 px-4 py-4 sm:px-8 backdrop-blur"><div className="mx-auto flex w-full max-w-6xl items-center gap-4">
        {onBack ? (
          <ActionButton aria-label="Volver al paso anterior"
            onClick={onBack}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted shadow-[var(--shadow-card)] ring-1 ring-line transition-transform active:scale-95"
          >
            <IconArrowLeft className="h-6 w-6" />
          </ActionButton>
        ) : (
          <div className="h-14 w-14" />
        )}
        <div className="flex-1 text-center">
          {step && <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand">{step}</p>}
          {title && <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>}
        </div>
        <div className="h-14 w-14" />
      </div></header>
      <main id="kiosk-main-scroll" className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-y-auto px-4 pb-24 pt-6 sm:px-8">{children}</main>
    </div>
  );
}
