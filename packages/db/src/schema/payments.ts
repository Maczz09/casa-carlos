import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Canales por los que el hotel cobra: billeteras digitales (con la foto de su
 * QR) y cuentas bancarias (con número y CCI). Se administran desde
 * Ajustes → Cobros y son lo que el kiosco le ofrece al huésped.
 */
export const paymentsCuentasCobro = sqliteTable("payments_cuentas_cobro", {
  id: text("id").primaryKey(),
  tipo: text("tipo", { enum: ["BANCO", "BILLETERA"] }).notNull(),
  /** Método con el que se registra un pago cobrado por este canal. Un banco siempre cobra como TRANSFERENCIA. */
  metodo: text("metodo", {
    enum: ["EFECTIVO", "YAPE", "PLIN", "LEMON", "AGORA", "TRANSFERENCIA", "POS_CREDITO", "POS_DEBITO"],
  })
    .notNull()
    .default("TRANSFERENCIA"),
  proveedor: text("proveedor").notNull(),
  titular: text("titular").notNull(),
  telefono: text("telefono"),
  numeroCuenta: text("numero_cuenta"),
  cci: text("cci"),
  notas: text("notas"),
  /** Nombre opaco del archivo dentro de data/qr-images (la foto del QR de la billetera). */
  qrArchivo: text("qr_archivo"),
  qrMimeType: text("qr_mime_type", { enum: ["image/jpeg", "image/png", "image/webp"] }),
  orden: integer("orden").notNull().default(0),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
});

export const paymentsPagos = sqliteTable("payments_pagos", {
  id: text("id").primaryKey(),
  ventaId: text("venta_id").notNull(),
  totalCentimos: integer("total_centimos").notNull(),
  estado: text("estado", { enum: ["PENDIENTE", "ACEPTADO", "RECHAZADO"] }).notNull(),
  motivoRechazo: text("motivo_rechazo"),
  aceptadoPor: text("aceptado_por"),
  aceptadoEn: text("aceptado_en"),
  creadoEn: text("creado_en").notNull(),
});

export const paymentsDetalles = sqliteTable("payments_detalles", {
  id: text("id").primaryKey(),
  pagoId: text("pago_id")
    .notNull()
    .references(() => paymentsPagos.id),
  metodo: text("metodo", {
    enum: ["EFECTIVO", "YAPE", "PLIN", "LEMON", "AGORA", "TRANSFERENCIA", "POS_CREDITO", "POS_DEBITO"],
  }).notNull(),
  montoCentimos: integer("monto_centimos").notNull(),
  codigoOperacion: text("codigo_operacion"),
  ordenanteNombres: text("ordenante_nombres"),
  ordenanteApellidos: text("ordenante_apellidos"),
  bancoOrigen: text("banco_origen"),
  recibidoCentimos: integer("recibido_centimos"),
  vueltoCentimos: integer("vuelto_centimos"),
  creadoEn: text("creado_en").notNull(),
});
