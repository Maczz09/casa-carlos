import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Card, Field, Input, Select, Textarea, Badge, Notice, PageHeader, StatCard, Skeleton } from "../components/ui.js";
import { Checkbox } from "@casacarlos/ui/components/checkbox";
import { Switch } from "@casacarlos/ui/components/switch";
import { RadioGroup, RadioGroupItem } from "@casacarlos/ui/components/radio-group";
import { Label } from "@casacarlos/ui/components/label";
import { ConfirmDialog } from "@casacarlos/ui/components/confirm-dialog";
import { ModalFrame } from "@casacarlos/ui/components/modal-frame";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@casacarlos/ui/components/table";
import { IconCash, IconClock, IconCheck, IconBed, IconPlus } from "@casacarlos/ui";
import "../index.css";

// Entrada de desarrollo independiente, sin servidor de negocio ni datos del hotel.
function Gallery() {
  const [dark, setDark] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <PageHeader title="Galería de componentes" subtitle="Controles compartidos de recepción y kiosco" icon={<IconBed />} actions={<Button onClick={() => setDark(!dark)}>{dark ? "Tema claro" : "Tema oscuro"}</Button>} />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Cobrado" value="S/ 80.00" icon={<IconCash />} /><StatCard label="Hora adicional" value="S/ 10.00" icon={<IconClock />} /><StatCard label="Saldo" value="S/ 0.00" icon={<IconCheck />} /></div>
    <Card className="space-y-5 p-5"><h2 className="font-semibold">Acciones y estados</h2><div className="flex flex-wrap gap-3">{(["primary","secondary","ghost","warn","danger"] as const).map(variant => <Button key={variant} variant={variant} icon={<IconPlus />}>{variant}</Button>)}<Button disabled>Deshabilitado</Button></div><div className="flex flex-wrap gap-2">{["tone-teal","tone-rose","tone-amber","tone-red","tone-violet","tone-sky"].map(tone => <Badge key={tone} tone={tone}>Estado visible</Badge>)}</div><Notice kind="error">Error persistente al registrar la operación.</Notice><Notice kind="warn">Hay horas extra cargadas.</Notice><Notice kind="ok">Operación registrada.</Notice></Card>
    <Card className="grid gap-4 p-5 sm:grid-cols-2"><Field label="Importe en soles"><Input inputMode="decimal" placeholder="0.00" /></Field><Field label="Método"><Select><option>Efectivo</option><option>Yape</option></Select></Field><Field label="Motivo"><Textarea placeholder="Explica la corrección" /></Field><Field label="Campo deshabilitado"><Input disabled value="Historial conservado" readOnly /></Field><Label className="flex items-center gap-2"><Checkbox checked={checked} onCheckedChange={value => setChecked(value === true)} />Confirmación de devolución</Label><Label className="flex items-center gap-2"><Switch checked={dark} onCheckedChange={setDark} />Tema oscuro</Label><RadioGroup defaultValue="cash" aria-label="Forma de cobro"><Label><RadioGroupItem value="cash" />Efectivo</Label><Label><RadioGroupItem value="digital" />Digital</Label></RadioGroup><Skeleton className="h-12" /></Card>
    <Card className="p-4"><Table><TableHeader><TableRow><TableHead>Operación</TableHead><TableHead>Usuario</TableHead><TableHead className="text-right">Importe</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Cobro de horas extra</TableCell><TableCell>Recepción</TableCell><TableCell className="text-right">S/ 10.00</TableCell></TableRow></TableBody></Table></Card>
    <div className="flex gap-3"><Button onClick={() => setDialog(true)}>Abrir diálogo</Button><Button variant="danger" onClick={() => setConfirm(true)}>Probar confirmación</Button></div>
    {dialog && <ModalFrame title="Revisión de cuenta" onClose={() => setDialog(false)}><Card className="w-full max-w-lg space-y-4 p-5"><h2 className="font-semibold">Revisión de cuenta</h2><Field label="Motivo"><Textarea autoFocus /></Field><Button onClick={() => setDialog(false)}>Cerrar</Button></Card></ModalFrame>}
    <ConfirmDialog open={confirm} title="Confirmar operación" description="Ejemplo de confirmación. No modifica datos." onCancel={() => setConfirm(false)} onConfirm={() => setConfirm(false)} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Gallery />);
