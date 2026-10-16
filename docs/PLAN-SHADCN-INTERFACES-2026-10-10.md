# Plan de implementación: interfaces e iconos con shadcn/ui

Fecha: 10 de octubre de 2026. Estado: implementado en la versión 1.4.0; validación y distribución registradas en `IMPLEMENTACION-SHADCN-2026-10-10.md`.

## Objetivo y alcance

Renovar las interfaces de los 15 módulos de recepción, el acceso, la navegación y las siete pantallas principales del kiosco. El resultado debe facilitar la operación diaria del hospedaje: encontrar un cuarto, cobrar, cerrar una estadía y consultar sus movimientos con claridad.

Se incorporarán componentes de shadcn/ui y un catálogo coherente de iconos Lucide. Cada módulo conservará sus permisos, contratos de datos, rutas, operaciones y registros de auditoría. Los flujos de horas extra, cobro y checkout recientemente corregidos forman parte de la validación obligatoria.

## Diagnóstico del proyecto

- Recepción y kiosco usan React 19, TypeScript, Vite y Tailwind CSS 4.
- `packages/ui` ya es compartido por ambas aplicaciones, pero contiene principalmente iconos, ilustraciones, estilos de estado y efectos visuales.
- Los controles de recepción están concentrados en `apps/web-reception/src/components/ui.tsx`: botones, superficies, formularios, pestañas y estados de pantalla.
- La navegación está en `components/layout.tsx`; los temas claro y oscuro se definen mediante tokens en `src/index.css` y `data-theme`.
- Hay SVG hechos a mano, emojis y controles construidos directamente dentro de los módulos. Los diálogos de caja y checkout también requieren integración con el nuevo catálogo.
- Reservas, gráficos y reportes usan bibliotecas especializadas: FullCalendar, Chart.js/Recharts y FortuneSheet. La migración debe contemplar su estilo e integración, además de los controles de alrededor.
- Ya existe carga diferida de módulos pesados y un instalador Windows con escritorio Tauri.

La documentación oficial describe la integración de shadcn en [Vite](https://ui.shadcn.com/docs/installation/vite), el [soporte de React 19 y Tailwind 4](https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4) y su [organización en monorepos](https://ui.shadcn.com/docs/monorepo). La configuración concreta se fijará sobre este repositorio existente.

## Dirección visual propuesta

Una interfaz de recepción sobria, con estados de habitación reconocibles y cifras fáciles de comparar. Las acciones principales deben ser visibles y las operaciones secundarias ocupar un lugar consistente.

| Aspecto | Decisión propuesta |
| --- | --- |
| Paleta | Blanco `#ffffff`, fondo `#f4f7fb`, texto azul `#0f1b33`, acento teal `#0d9488`, alerta `#d97706`, error `#e11d48`; son referencias del tema existente y se ajustarán según contraste |
| Tema oscuro | Azul profundo basado en los tokens actuales, con contraste verificado para cifras, formularios y estados |
| Tipografía | Segoe UI local y su fallback de sistema; escala consistente para título, sección, contenido y ayuda; cifras tabulares para dinero y horas |
| Densidad | Recepción compacta y legible; kiosco con controles grandes, texto breve y objetivos táctiles de al menos 48 px |
| Jerarquía | Cabecera con título y acción principal, filtros agrupados y contenido de trabajo; panel de resumen fijo solo cuando ayude al cobro |
| Estados | Color, etiqueta e icono juntos: disponible, reservado, ocupado, tolerancia, excedido, limpieza y fuera de servicio |
| Movimiento | Transiciones breves al responder a acciones; respeto por la preferencia de movimiento reducido |
| Iconos | Una familia, tamaño y grosor coherentes; acciones importantes con texto y controles solo con icono con nombre accesible |

## Arquitectura de componentes

Ubicar los componentes reutilizables en `packages/ui`, con exportaciones por componente para recepción y kiosco. Las composiciones específicas —cuenta de una habitación, formulario de cobro, historial de venta— permanecerán cerca de sus módulos.

Estructura prevista, sujeta a la configuración final del CLI:

```text
packages/ui/
  components.json
  src/
    components/       # componentes shadcn y composiciones generales
    lib/utils.ts     # combinación de clases
    styles/tokens.css
    icons.tsx        # catálogo semántico de iconos
apps/web-reception/
  components.json
  src/components/    # composiciones operativas
apps/web-kiosk/
  components.json
  src/components/    # composiciones para huéspedes
```

Configurar `components.json` y los alias en los tres workspaces, con las mismas opciones de estilo e iconos y `rsc: false`. Para Tailwind 4, la documentación indica dejar vacío el campo de archivo de configuración de Tailwind. Añadir exportaciones del paquete compartido y comprobar que Vite y TypeScript resuelven las mismas rutas. [Referencia oficial](https://ui.shadcn.com/docs/monorepo).

La elección de primitivas de shadcn se fijará en la primera fase y se aplicará de forma uniforme. También se fijarán versiones y el lockfile. El CSS generado se integrará con los tokens existentes mediante cambios revisados. Tailwind deberá detectar las clases de los componentes compartidos, verificando sus rutas de fuentes cuando sea necesario.

Durante la transición, `components/ui.tsx` podrá adaptar la API existente (`block`, `icon`, `warn`, etc.) a los componentes nuevos. Cada adaptación tendrá una correspondencia definida; se retirarán las que dejen de usarse al finalizar la migración.

Catálogo inicial:

- Controles: Button, Input, Textarea, Label/Field, Select, Checkbox, RadioGroup y Switch.
- Información: Badge, Card, Separator, Skeleton, Alert y mensajes de resultado con Sonner.
- Navegación: Sidebar, Sheet, Tabs, Breadcrumb y DropdownMenu.
- Interacciones: Dialog, AlertDialog, Popover, Tooltip y Combobox cuando facilite búsquedas.
- Datos: Table, Pagination y DatePicker; composición de tabla con búsqueda y ordenación cuando el volumen lo justifique.

Los importes, el DNI/RUC y las fechas conservarán sus validaciones específicas. Las fechas se mostrarán con criterio de Lima y las monedas como soles. Los errores de formularios seguirán asociados al campo correspondiente; un aviso temporal no sustituirá un error persistente que impida continuar.

## Plan por fases

| Fase | Trabajo | Resultado verificable |
| --- | --- | --- |
| 1. Base visual y técnica | Inventario de componentes, tokens, catálogo de iconos, configuración shadcn, exportaciones y primeros controles compartidos | Galería interna con variantes y estados; Button, Input, Dialog y Select funcionando en recepción y kiosco, en ambos temas |
| 2. Navegación y piloto | Sidebar, cabecera, acceso y formularios de Categorías y Usuarios | Patrón completo de listado, filtros, formulario, confirmación y error; navegación por permisos y teclado validada |
| 3. Operación diaria | Tablero, nueva venta, detalle de cuarto y reservas | Estados de habitaciones claros; formularios de venta y checkout coherentes; calendario integrado con el tema |
| 4. Dinero y auditoría | Caja, anulaciones y comprobantes, incluidos sus diálogos e impresión | Cobro, vuelto, saldo, devolución y motivo visibles; historial y operaciones auditadas conservados |
| 5. Administración | Bodega, administración de cuartos, ajustes y notificaciones | Tablas y formularios consistentes; subpantallas, canales de cobro y permisos cubiertos |
| 6. Análisis y kiosco | Dashboard, reportes y siete pantallas del huésped | Filtros, gráficos y exportaciones coherentes; flujo táctil completo y sincronización con recepción |
| 7. Cierre y distribución | Revisión visual, accesibilidad, regresión funcional y compilación | Matriz de módulos completa, pruebas aprobadas e instalador actualizado |

Cada fase produce cambios revisables y capturas de las pantallas afectadas. Los patrones se corrigen en el piloto antes de extenderlos a los módulos restantes. El calendario de trabajo se estimará después del piloto, según el volumen real de adaptación y las pruebas en Tauri.

## Cobertura de todos los módulos

| Módulo o pantalla | Mejora prevista | Fase |
| --- | --- | --- |
| Acceso y navegación | Login/PIN, errores visibles, Sidebar, sesión del operador, estado de conexión y menú móvil | 2 |
| Categorías | Listado, búsqueda, formulario y confirmación de eliminación | 2 |
| Usuarios | Lista, permisos legibles, formulario y confirmaciones de cambios | 2 |
| Tablero de cuartos | Filtros por piso/estado, leyenda, tarjetas con tiempo y saldo, acceso claro a acciones | 3 |
| Nueva venta | Pasos visibles, selección de modalidad/huésped/productos y resumen del cobro | 3 |
| Detalle del cuarto | Jerarquía de estadía, cargos y pagos; diálogos de horas extra, anulación de cargo y revisión de checkout | 3 |
| Reservas | Barra de filtros, calendario, detalle y formulario con fechas y disponibilidad | 3 |
| Caja | Resumen del turno, métodos, tablas y filtros; arqueo, cierre y reporte detallado con Dialog/Sheet | 4 |
| Anulaciones | Usuario, motivo, fecha e importe; confirmación explícita e historial accesible | 4 |
| Comprobantes | Estados, filtros, acciones de impresión/emisión y confirmaciones para notas o bajas | 4 |
| Bodega | Catálogo, ficha de producto, movimientos, stock bajo y formularios de ingreso/salida | 5 |
| Administración de cuartos | Pisos, categorías, capacidades, atributos y estado operativo | 5 |
| Ajustes | Navegación consistente entre marca, tema/horario, tarifas, canales de cobro y configuración de SUNAT | 5 |
| Notificaciones | Destinatarios, plantillas, cola y conexión WhatsApp, con estados y acciones uniformes | 5 |
| Dashboard | Indicadores legibles, rango de fechas, gráficos y accesos a pendientes | 6 |
| Reportes | Filtros, vista de resultados y exportación; integración visual de gráficos y hoja de cálculo | 6 |
| Kiosco | Inicio, pisos, cuartos, productos, pago, espera y resultado; botones táctiles y mensajes de conexión | 6 |

La cobertura incluye estados de carga, vacío, error, acceso restringido y operación en curso, así como las ventanas secundarias de cada módulo.

## Propuesta de iconos

Mapeo semántico inicial; los nombres de exportación disponibles se verificarán con la versión de Lucide fijada al implementar.

| Uso | Icono propuesto |
| --- | --- |
| Tablero | LayoutGrid |
| Cuartos | BedDouble |
| Nueva venta | ShoppingCart |
| Reservas | CalendarDays |
| Caja | Wallet |
| Anulaciones | FileX |
| Bodega | Package |
| Categorías | Tags |
| Comprobantes | ReceiptText |
| Dashboard | ChartNoAxesCombined |
| Reportes | FileChartColumn |
| Notificaciones | Bell |
| Usuarios | Users |
| Ajustes | Settings2 |
| Horas extra | ClockPlus |
| Checkout | LogOut |
| Cobro | Banknote |
| Devolución | Undo2 |
| Auditoría | History |
| Impresión | Printer |

Usar importaciones explícitas de iconos para incluir únicamente los necesarios; Lucide documenta el ajuste de tamaño, color y grosor, soporte TypeScript y eliminación de iconos no usados en el bundle. [Lucide para React](https://lucide.dev/guide/react/).

Las billeteras y tarjetas tendrán iconografía de método de pago y su nombre visible. Logos del hotel, QR y gráficos propios de habitaciones seguirán tratados como contenido visual específico, con tamaño y contraste armonizados con los controles nuevos.

## Validación y criterios de aceptación

- Los 15 módulos, el acceso y el kiosco usan el catálogo compartido de controles e iconos; las composiciones específicas quedan documentadas.
- Temas claro y oscuro legibles, foco visible, botones con nombre accesible, etiquetas de campos y estados que no dependan únicamente del color.
- Diálogos con foco gestionado, navegación por teclado y retorno al control que los abrió. El cierre de un diálogo con operación en curso debe tener comportamiento explícito.
- Revisar recepción a 1366×768 y 1920×1080, panel móvil a 390 px y kiosco a la resolución real de la segunda pantalla; probar zoom al 125 % y 150 % en Windows.
- Formularios largos, tablas, calendarios y diálogos mantienen acceso a sus acciones y se pueden desplazar sin quedar recortados.
- Verificar las 19 pruebas contables existentes y probar en interfaz: agregar/pagar horas, checkout con saldo, salida anterior, devolución, cambio de caja, anulación y consulta de venta cerrada.
- Comprobar autorización por roles, sincronización WebSocket, captura de efectivo recibido/vuelto, impresión y exportaciones.
- Mantener la carga diferida de vistas pesadas y comparar el tamaño de bundles y la apertura inicial frente a la versión previa.
- Ejecutar tipos y builds de todos los paquetes; verificar en Tauri/WebView2; compilar el instalador cuando la migración esté completa.

La entrega incluirá capturas antes/después, matriz de cobertura con estado por módulo, resultados de validación y el instalador correspondiente a la nueva interfaz.

## Riesgos y tratamiento

| Riesgo | Tratamiento previsto |
| --- | --- |
| Clases o tokens propios en conflicto con shadcn | Mapa de tokens y galería de componentes en fase 1; revisar CSS generado y probar ambos temas |
| Diferencias de API entre controles existentes y nuevos | Adaptaciones temporales, migración por módulo y comprobación de validaciones/eventos |
| Portales y foco en diálogos superpuestos | Probar Select/Popover dentro de Dialog, teclas, capas y retorno del foco en navegador y Tauri |
| Estilos compartidos ausentes en el build del kiosco | Verificar fuentes de Tailwind y exportaciones desde ambas aplicaciones |
| Cambio accidental en cobros o checkout | Mantener contratos y cálculos, usar las pruebas contables y verificar el flujo completo desde la interfaz |
| Bibliotecas grandes o especializadas con estilo propio | Integrar contenedores y temas, conservar carga diferida y revisar rendimiento/exportaciones |

## Primer bloque de implementación

Configurar el catálogo compartido, el tema y los iconos; preparar Button, Input, Badge, Dialog, AlertDialog y Table; renovar la navegación y completar Categorías como piloto. Ese bloque establece el patrón que se aplicará al resto de módulos y proporciona una primera entrega visual concreta.
