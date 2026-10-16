# Implementación de interfaces shadcn/ui · 1.4.0

Las interfaces de los 15 módulos de recepción, el acceso, la navegación y las siete pantallas principales del kiosco usan ahora controles compartidos de shadcn/ui e iconos Lucide. Se mantienen las operaciones, permisos y contratos contables de la versión 1.3.0.

## Arquitectura implementada

- Componentes oficiales del registro `new-york-v4`, basados en Radix UI, adaptados a React 19 y Tailwind 4. La procedencia y los hashes originales están en `packages/ui/shadcn-registry.json`.
- `packages/ui/components.json`, configuración de ambas aplicaciones y exportaciones por componente. El lockfile fija las versiones instaladas.
- `packages/ui/src/styles/tokens.css` conecta shadcn con las paletas existentes y `data-theme`. Tailwind detecta los componentes compartidos mediante `@source`.
- La capa `components/ui.tsx` de recepción adapta las variantes existentes de botones, campos y superficies. Las tarjetas seleccionables usan `ActionButton`; los selectores de vistas usan botones con estado accesible. El acceso usa Tabs con navegación por flechas.
- Se preservan ilustraciones de habitaciones, FullCalendar, Recharts/Chart.js, FortuneSheet y los formatos térmicos de impresión. El calendario y los controles de la hoja se integran con los tokens. La hoja conserva sus celdas de análisis y sus exportaciones.
- La galería de desarrollo está en `apps/web-reception/ui-gallery.html`: abrir `/ui-gallery.html` con Vite de recepción en funcionamiento. No requiere API, usuario ni base de datos y no forma parte del instalador.

## Cobertura de módulos

| Módulo | Implementación |
| --- | --- |
| Tablero | Cabecera e iconos, tarjetas, búsqueda por número/categoría, filtro de estado y conteo visible |
| Nueva venta | Controles, campos, modalidades, selección y estados del cobro |
| Detalle de cuarto | Acciones y formularios, diálogos de productos y horas extra, revisión de checkout |
| Reservas | Calendario con paleta claro/oscuro, campos y cancelación con motivo dentro de la aplicación |
| Caja | Controles, tablas, subpantallas, anulaciones, detalle de venta y reporte de turno |
| Anulaciones | Filtros, tabla, detalle y avisos al copiar códigos |
| Bodega | Catálogo, formularios, tabla y diálogo de stock; acciones independientes sin botones anidados |
| Categorías | Listado, edición, creación y confirmación de eliminación |
| Cuartos y tarifas | Controles y formularios de habitaciones, categorías, modalidades y precios |
| Comprobantes | Consulta, emisión, cobro de saldo y sus diálogos |
| Dashboard | Cabecera, filtros, cifras y superficies de los gráficos |
| Reportes | Filtros, exportación y adaptación de nombres/teclado en controles de FortuneSheet |
| Notificaciones | Controles de WhatsApp, destinatarios, plantillas y cola |
| Usuarios | Listado con búsqueda y estado, permisos con Checkbox y confirmación de desactivación |
| Ajustes | Marca, apariencia con Switch, turnos, cobros y SUNAT |

La navegación móvil usa Sheet; los avisos usan Popover y la navegación contraída Tooltip. Los diálogos usan portal, foco aislado, Escape y retorno al control que los abrió. El cierre está bloqueado mientras se ejecuta una operación. Los errores siguen visibles junto al formulario; Sonner anuncia las acciones de portapapeles.

El kiosco comparte botones y campos, usa objetivos táctiles de al menos 48 px, respeta el movimiento reducido y permite ampliar la página. Las opciones de pantalla están en un menú para evitar cubrir el botón de volver y los pasos del huésped.

## Validación y límites

La matriz automática está en `scripts/ui-smoke.mjs` y sus datos sintéticos en `scripts/ui-smoke-fixtures.mjs`. Intercepta todas las solicitudes API y reemplaza los WebSockets: no opera sobre la base de datos del hotel. Las capturas y resultados se regeneran en `.cache/ui-smoke`.

El flujo contable se valida por separado con `apps/server/tests/finance.test.ts`, usando bases de datos en memoria. Incluye caja cerrada y cobro en otro turno, horas extra manuales y automáticas, checkout después del pago, salida anticipada, devolución por método, anulaciones y auditoría.

Resultados del 10 de octubre de 2026:

| Comprobación | Resultado |
| --- | --- |
| Tipos de los 22 paquetes del workspace | Correctos |
| Compilación de recepción y kiosco | Correcta |
| Pruebas contables | 19 aprobadas |
| Vistas de recepción | 15 módulos en claro y oscuro: 30 vistas |
| Subpantallas | 14 comprobadas, incluidas caja, tarifas, notificaciones y SUNAT |
| Kiosco | 8 estados comprobados de las siete pantallas principales |
| Accesibilidad automática | 54 análisis con axe, sin incidencias en los estados visitados |
| Errores de ejecución del navegador | Ninguno |
| Interacción | Filtros, revisión de salida anticipada con motivo y devolución obligatorios, foco en confirmación, retorno de foco, Sheet móvil y pestañas de acceso por teclado |

Recepción y kiosco se revisaron con Chrome local a 1440×960; acceso a 1280×800 y navegación móvil a 390×844. Se conservaron capturas de cada vista. La revisión de checkout conserva el selector de hora al volver y evita desbordamiento horizontal del panel de acciones.

El instalador de la versión 1.4.0 se genera en `installer/output/HospedajeCarlos-Setup.exe`; su suma de verificación se entrega en el archivo `.sha256` adyacente. Incluye la aplicación de escritorio compilada y ambas interfaces. La galería de desarrollo está excluida del paquete instalado.

Las comprobaciones automáticas de accesibilidad cubren las vistas y estados visitados; no equivalen a una certificación de accesibilidad ni a una prueba de integración con SUNAT o WhatsApp reales. El contenedor Tauri se compila para Windows x64; esta validación no instala ni opera el sistema de producción del hotel. El zoom físico de Windows, los dispositivos de impresión y la segunda pantalla del hotel requieren comprobación en ese equipo.
