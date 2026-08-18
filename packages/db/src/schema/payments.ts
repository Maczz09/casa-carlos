import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const paymentsCuentasCobro = sqliteTable("payments_cuentas_cobro", {
  id: text("id").primaryKey(),
  tipo: text("tipo", { enum: ["BANCO", "BILLETERA"] }).notNull(),
  proveedor: text("proveedor").notNull(),
  titular: text("titular").notNull(),
  numeroCuenta: text("numero_cuenta"),
  cci: text("cci"),
  qrImagenUrl: text("qr_imagen_url"),
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
