CREATE TABLE `identity_sesiones` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`iniciada_en` text NOT NULL,
	`expira_en` text NOT NULL,
	`cerrada_en` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `identity_usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `identity_usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario` text NOT NULL,
	`nombres` text NOT NULL,
	`apellidos` text NOT NULL,
	`password_hash` text NOT NULL,
	`pin_hash` text,
	`rol` text NOT NULL,
	`telefono_whatsapp` text,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_usuarios_usuario_unique` ON `identity_usuarios` (`usuario`);--> statement-breakpoint
CREATE TABLE `rooms_atributos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms_categoria_atributos` (
	`categoria_id` text NOT NULL,
	`atributo_id` text NOT NULL,
	PRIMARY KEY(`categoria_id`, `atributo_id`),
	FOREIGN KEY (`categoria_id`) REFERENCES `rooms_categorias`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`atributo_id`) REFERENCES `rooms_atributos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms_categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text,
	`camas` integer DEFAULT 1 NOT NULL,
	`activo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms_cuartos` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` text NOT NULL,
	`piso_id` text NOT NULL,
	`categoria_id` text NOT NULL,
	`descripcion` text,
	`incluye` text,
	`fuera_de_servicio` integer DEFAULT false NOT NULL,
	`motivo_fuera_servicio` text,
	`limpieza_hasta` text,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`piso_id`) REFERENCES `rooms_pisos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`categoria_id`) REFERENCES `rooms_categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_cuartos_numero_unique` ON `rooms_cuartos` (`numero`);--> statement-breakpoint
CREATE TABLE `rooms_historial_estado` (
	`id` text PRIMARY KEY NOT NULL,
	`cuarto_id` text NOT NULL,
	`estado_anterior` text NOT NULL,
	`estado_nuevo` text NOT NULL,
	`estadia_id` text,
	`usuario_id` text,
	`ocurrido_en` text NOT NULL,
	FOREIGN KEY (`cuarto_id`) REFERENCES `rooms_cuartos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms_pisos` (
	`id` text PRIMARY KEY NOT NULL,
	`numero` integer NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer NOT NULL,
	`activo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pricing_cargos` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`nombre` text NOT NULL,
	`precio_centimos` integer NOT NULL,
	`unidad` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_cargos_codigo_unique` ON `pricing_cargos` (`codigo`);--> statement-breakpoint
CREATE TABLE `pricing_escala_noches` (
	`id` text PRIMARY KEY NOT NULL,
	`modalidad_id` text NOT NULL,
	`categoria_id` text NOT NULL,
	`noches` integer NOT NULL,
	`precio_total_centimos` integer NOT NULL,
	FOREIGN KEY (`modalidad_id`) REFERENCES `pricing_modalidades`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pricing_franjas` (
	`id` text PRIMARY KEY NOT NULL,
	`temporada_id` text NOT NULL,
	`hora_inicio` text NOT NULL,
	`orden` integer NOT NULL,
	`etiqueta` text NOT NULL,
	FOREIGN KEY (`temporada_id`) REFERENCES `pricing_temporadas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pricing_modalidades` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`nombre` text NOT NULL,
	`duracion_horas` integer NOT NULL,
	`checkin_fijo` text,
	`checkout_fijo` text,
	`tolerancia_min` integer DEFAULT 15 NOT NULL,
	`activa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pricing_modalidades_codigo_unique` ON `pricing_modalidades` (`codigo`);--> statement-breakpoint
CREATE TABLE `pricing_tarifas` (
	`id` text PRIMARY KEY NOT NULL,
	`franja_id` text NOT NULL,
	`categoria_id` text NOT NULL,
	`modalidad_id` text NOT NULL,
	`precio_centimos` integer NOT NULL,
	FOREIGN KEY (`franja_id`) REFERENCES `pricing_franjas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modalidad_id`) REFERENCES `pricing_modalidades`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pricing_temporadas` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`desde` text NOT NULL,
	`hasta` text NOT NULL,
	`prioridad` integer DEFAULT 0 NOT NULL,
	`activa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stays_clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`nombres` text NOT NULL,
	`apellidos` text NOT NULL,
	`dni` text NOT NULL,
	`telefono` text,
	`creado_en` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stays_clientes_dni_unique` ON `stays_clientes` (`dni`);--> statement-breakpoint
CREATE TABLE `stays_estadias` (
	`id` text PRIMARY KEY NOT NULL,
	`cuarto_id` text NOT NULL,
	`cliente_id` text NOT NULL,
	`modalidad_id` text NOT NULL,
	`venta_id` text,
	`tipo` text NOT NULL,
	`estado` text NOT NULL,
	`bloqueo_desde` text NOT NULL,
	`bloqueo_hasta` text NOT NULL,
	`checkin_previsto` text NOT NULL,
	`checkin_real` text,
	`checkout_previsto` text NOT NULL,
	`checkout_real` text,
	`noches` integer DEFAULT 0 NOT NULL,
	`tolerancia_min` integer DEFAULT 15 NOT NULL,
	`notificado_exceso_en` text,
	`motivo_anulacion` text,
	`usuario_id` text NOT NULL,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `stays_clientes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_lineas` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`tipo` text NOT NULL,
	`referencia_id` text,
	`descripcion` text NOT NULL,
	`cantidad` integer DEFAULT 1 NOT NULL,
	`precio_unitario_centimos` integer NOT NULL,
	`subtotal_centimos` integer NOT NULL,
	`fase` text NOT NULL,
	`anulada` integer DEFAULT false NOT NULL,
	`motivo_anulacion` text,
	`usuario_id` text NOT NULL,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`venta_id`) REFERENCES `sales_ventas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_ventas` (
	`id` text PRIMARY KEY NOT NULL,
	`serie` text NOT NULL,
	`correlativo` integer NOT NULL,
	`tipo` text NOT NULL,
	`estado` text NOT NULL,
	`estadia_id` text,
	`cuarto_id` text,
	`cliente_nombres` text,
	`cliente_apellidos` text,
	`cliente_dni` text,
	`total_centimos` integer DEFAULT 0 NOT NULL,
	`pagado_centimos` integer DEFAULT 0 NOT NULL,
	`saldo_centimos` integer DEFAULT 0 NOT NULL,
	`usuario_id` text NOT NULL,
	`pagada_en` text,
	`cerrada_en` text,
	`motivo_anulacion` text,
	`creado_en` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_venta_serie` ON `sales_ventas` (`serie`,`correlativo`);--> statement-breakpoint
CREATE TABLE `payments_cuentas_cobro` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`proveedor` text NOT NULL,
	`titular` text NOT NULL,
	`numero_cuenta` text,
	`cci` text,
	`qr_imagen_url` text,
	`orden` integer DEFAULT 0 NOT NULL,
	`activa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments_detalles` (
	`id` text PRIMARY KEY NOT NULL,
	`pago_id` text NOT NULL,
	`metodo` text NOT NULL,
	`monto_centimos` integer NOT NULL,
	`codigo_operacion` text,
	`ordenante_nombres` text,
	`ordenante_apellidos` text,
	`banco_origen` text,
	`recibido_centimos` integer,
	`vuelto_centimos` integer,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`pago_id`) REFERENCES `payments_pagos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments_pagos` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`total_centimos` integer NOT NULL,
	`estado` text NOT NULL,
	`motivo_rechazo` text,
	`aceptado_por` text,
	`aceptado_en` text,
	`creado_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_movimientos` (
	`id` text PRIMARY KEY NOT NULL,
	`producto_id` text NOT NULL,
	`tipo` text NOT NULL,
	`cantidad` integer NOT NULL,
	`stock_resultante` integer NOT NULL,
	`cuarto_id` text,
	`venta_id` text,
	`linea_venta_id` text,
	`motivo` text,
	`usuario_id` text NOT NULL,
	`ocurrido_en` text NOT NULL,
	FOREIGN KEY (`producto_id`) REFERENCES `inventory_productos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_productos` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo_barras` text,
	`nombre` text NOT NULL,
	`descripcion` text,
	`categoria` text,
	`precio_centimos` integer NOT NULL,
	`costo_centimos` integer DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`stock_minimo` integer DEFAULT 0 NOT NULL,
	`estado` text DEFAULT 'ACTIVO' NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_productos_codigo_barras_unique` ON `inventory_productos` (`codigo_barras`);--> statement-breakpoint
CREATE TABLE `cashbox_movimientos` (
	`id` text PRIMARY KEY NOT NULL,
	`turno_id` text NOT NULL,
	`tipo` text NOT NULL,
	`metodo` text,
	`monto_centimos` integer NOT NULL,
	`venta_id` text,
	`pago_id` text,
	`vuelto_centimos` integer,
	`motivo` text,
	`usuario_id` text NOT NULL,
	`ocurrido_en` text NOT NULL,
	FOREIGN KEY (`turno_id`) REFERENCES `cashbox_turnos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cashbox_plantillas_turno` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`hora_inicio` text NOT NULL,
	`hora_fin` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`activa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cashbox_turnos` (
	`id` text PRIMARY KEY NOT NULL,
	`plantilla_id` text,
	`usuario_id` text NOT NULL,
	`fecha` text NOT NULL,
	`abierto_en` text NOT NULL,
	`cerrado_en` text,
	`apertura_centimos` integer DEFAULT 0 NOT NULL,
	`efectivo_esperado_centimos` integer,
	`efectivo_declarado_centimos` integer,
	`diferencia_centimos` integer,
	`justificacion` text,
	`estado` text DEFAULT 'ABIERTO' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications_cola` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`canal` text DEFAULT 'WHATSAPP' NOT NULL,
	`destinatario` text NOT NULL,
	`destinatario_nombre` text NOT NULL,
	`mensaje` text NOT NULL,
	`estado` text DEFAULT 'PENDIENTE' NOT NULL,
	`intentos` integer DEFAULT 0 NOT NULL,
	`ultimo_error` text,
	`creado_en` text NOT NULL,
	`enviado_en` text
);
--> statement-breakpoint
CREATE TABLE `notifications_destinatarios` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`nombre` text NOT NULL,
	`telefono` text NOT NULL,
	`eventos` text NOT NULL,
	`activo` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications_plantillas` (
	`id` text PRIMARY KEY NOT NULL,
	`codigo` text NOT NULL,
	`canal` text DEFAULT 'WHATSAPP' NOT NULL,
	`cuerpo` text NOT NULL,
	`activa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_plantillas_codigo_unique` ON `notifications_plantillas` (`codigo`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`entidad` text NOT NULL,
	`entidad_id` text NOT NULL,
	`accion` text NOT NULL,
	`usuario_id` text,
	`ocurrido_en` text NOT NULL,
	`antes_json` text,
	`despues_json` text,
	`motivo` text
);
