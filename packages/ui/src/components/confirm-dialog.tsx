import type { ReactNode } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "./alert-dialog.js";
import { Button } from "./button.js";

export function ConfirmDialog({ open, title, description, confirmLabel = "Confirmar", destructive = false, busy = false, onCancel, onConfirm }: {
  open: boolean; title: string; description: ReactNode; confirmLabel?: string; destructive?: boolean; busy?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  return <AlertDialog open={open} onOpenChange={(value) => { if (!value && !busy) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription></AlertDialogHeader>
      <AlertDialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy} autoFocus>Cancelar</Button>
        <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>{busy ? "Procesando…" : confirmLabel}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
