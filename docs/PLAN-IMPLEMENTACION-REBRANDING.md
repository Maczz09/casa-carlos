# Plan de implementación del rebranding integral

## 1. Lectura de diseño

Hospedaje Carlos es un sistema operativo de recepción y administración para uso continuo. El rebranding debe priorizar lectura rápida, confianza, baja fricción y densidad útil. Se conserva la identidad turquesa de la aplicación y el soporte claro/oscuro, con un lenguaje visual sobrio y contemporáneo.

- Variación visual: 4/10. Estructuras previsibles y jerarquía consistente.
- Intensidad de movimiento: 4/10. Movimiento funcional en orientación, confirmación y estados de éxito.
- Densidad: 7/10. Información operativa abundante, agrupada para evitar ruido.
- Sistema base: tokens y componentes propios sobre Tailwind, sin introducir un segundo sistema visual.

## 2. Principios de producto

1. La información crítica debe entenderse en menos de cinco segundos.
2. Los importes siempre deben distinguir total, base gravada e IGV.
3. Toda acción sensible debe comunicar estado, resultado y posibilidad de recuperación.
4. Las vistas deben funcionar en tema claro y oscuro, escritorio y pantallas reducidas.
5. Las animaciones no pueden bloquear tareas ni ignorar la preferencia de movimiento reducido.
6. El sistema debe conservar estados vacíos, de carga y de error dentro del módulo afectado.
7. Las dependencias visuales deben cargarse bajo demanda cuando no formen parte de la ruta inicial.

## 3. Fases y estado

| Fase | Alcance | Criterio de aceptación | Estado |
| --- | --- | --- | --- |
| 1. Fundamentos | Tokens, fondos, superficies, tipografía, navegación, barra superior, tema claro/oscuro y estados comunes | La aplicación comparte una jerarquía visual coherente y no pierde navegación al fallar un módulo | Completado |
| 2. Acceso y seguridad | Inicio de sesión, registro, CRUD de usuarios, roles, permisos por módulo y recorrido guiado | El administrador puede crear, editar, restringir y desactivar usuarios; el último administrador queda protegido | Completado |
| 3. Operación | Tablero, ventas, detalle de cuarto, comprobantes e IGV | El detalle y los comprobantes muestran base gravada, IGV y total; los estados críticos son visibles | Completado |
| 4. Caja | Rebranding, resumen, entradas, salidas, métodos, filtros horarios, movimientos completos e IGV acumulado | Se puede auditar un turno o intervalo y conciliar total, base e IGV | Completado |
| 5. Reservas | Calendario diario, semanal y mensual; edición y detalle | Las reservas se entienden por fecha y se pueden gestionar desde el calendario | Completado |
| 6. Analítica | Dashboard con gráficos y reportes interactivos/PDF/CSV | Los gráficos responden al periodo y las hojas muestran datos válidos, sin celdas indeterminadas | Completado |
| 7. Configuración | Marca, logo, métodos de pago, varios bancos, QR, CCI/transferencia y credenciales/modo SUNAT | Todo lo configurado en la instalación se puede corregir posteriormente desde Ajustes | Completado |
| 8. Kiosco y confirmaciones | Rebranding, atmósfera visual, éxito de pago y fuegos artificiales | Recepción y kiosco confirman el pago de forma clara, con alternativa de movimiento reducido | Completado |
| 9. Alertas | WebSocket, notificación local, sonido y avisos operativos | Los cambios y vencimientos activos generan aviso visual y sonoro con permiso del usuario | Completado en modo local |
| 10. Instalación | Prerrequisitos, firewall local, asistente inicial y documentación de sistema operativo | El instalador valida/instala dependencias y deja la aplicación lista en Windows compatible | Completado |
| 11. Calidad | Tipado, build, prueba visual, accesibilidad básica, rendimiento e instalación limpia | No hay errores de tipo/build; los flujos clave funcionan en claro/oscuro y el instalador termina correctamente | Completado; prueba en PC limpia recomendada |
| 12. Analítica ampliada | Series de ocupación, flujo de estadías, ventas por hora y gráficos Recharts adicionales | Cada gráfico responde a una pregunta operativa, comparte rango de fechas y tiene estado vacío accesible | Planificado |

## 4. Orden de cierre

1. Corregir y validar el libro de reportes FortuneSheet.
2. Auditar altura dinámica, movimiento reducido, carga diferida y estados de error.
3. Ejecutar typecheck y build de todo el monorepo.
4. Probar visualmente Caja, Reservas, Dashboard, Reportes, Usuarios y Kiosco en claro y oscuro.
5. Compilar el instalador con WebView2, Visual C++ y .NET verificados.
6. Inspeccionar artefactos, versión, tamaño y documentación de instalación.

## 4.1 Resultado de cierre

- Typecheck correcto en los 22 proyectos TypeScript.
- Build de producción correcto para recepción y kiosco.
- FortuneSheet validado visualmente con datos, formato, pestañas y actualización de periodo.
- Tema claro, tema oscuro y navegación compacta validados visualmente.
- Aplicación de escritorio compilada en versión 1.2.0.
- Instalador generado con éxito y prerrequisitos Microsoft con firma válida.
- Queda recomendada una prueba de instalación en una PC limpia o máquina virtual antes de distribuir a producción.

## 5. Criterios de entrega

- Caja permite filtrar por fecha, hora, tipo y método, y presenta todos los movimientos.
- Boleta, factura, borrador y detalle de cuarto presentan desglose de IGV.
- Dashboard usa visualizaciones reales y no barras decorativas sin contexto.
- Reportes pueden revisarse en hoja interactiva y exportarse a CSV/PDF.
- Registro y gestión de usuarios respetan permisos en interfaz y servidor.
- Logo, pagos y SUNAT son editables después del primer inicio.
- Kiosco y recepción comparten lenguaje de marca y confirmación de pago.
- El instalador incluye o resuelve los requisitos necesarios de Windows.
- Las funciones que dependan de infraestructura externa se entregan configurables y no con credenciales ficticias.

## 6. Integración externa pendiente de credenciales

La aplicación ya entrega alertas locales en tiempo real mediante WebSocket, notificaciones del sistema y sonido. Las notificaciones remotas de Firebase Cloud Messaging, necesarias cuando la aplicación está cerrada o fuera de la red local, requieren un proyecto Firebase, VAPID y credenciales de servicio del propietario. Esa integración no debe activarse con secretos inventados ni embebidos en el cliente.
