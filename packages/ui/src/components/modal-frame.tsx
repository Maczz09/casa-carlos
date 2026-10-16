import { useRef, type ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "./dialog.js";

/** Mantiene el formulario operativo y aporta portal, foco, Escape y retorno al control. */
export function ModalFrame({ title, children, onClose, busy = false }: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  busy?: boolean;
}) {
  const opener = useRef(typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose?.(); }}>
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none justify-center overflow-y-auto overscroll-contain border-0 bg-transparent p-0 shadow-none sm:max-w-none [&>div]:max-h-[calc(100dvh-2rem)]"
      onEscapeKeyDown={(event) => { if (busy || !onClose) event.preventDefault(); }}
      onPointerDownOutside={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => { event.preventDefault(); opener.current?.focus(); }}
    >
      <DialogTitle className="sr-only">{title}</DialogTitle>
      {children}
    </DialogContent>
  </Dialog>;
}
