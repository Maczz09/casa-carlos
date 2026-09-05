# Hospedaje Carlos — Manual de uso

Guía rápida para el personal del hotel. No hace falta saber de computadoras
para seguir esto — son pasos concretos, uno por uno.

---

## 1. Entrar al sistema

- **Recepción**: doble clic en **"Hospedaje Carlos — Recepción"**. Se abre
  como una aplicación de Windows, sin barra ni pestañas del navegador.
- **Kiosco** (la pantalla que ve el cliente): doble clic en **"Hospedaje
  Carlos — Kiosco"**. Se abre directamente a pantalla completa.
- Usuario y contraseña los da el administrador. También se puede entrar con
  PIN rápido para cambiar de recepcionista sin cerrar sesión del todo.
- **¿No aparece el acceso directo en el escritorio?** También están en el
  menú Inicio de Windows, dentro de la carpeta **"Hospedaje Carlos"** — sirven
  exactamente igual. No hace falta reinstalar nada para recuperarlos.

Al abrir cualquiera de los dos accesos, la aplicación comprueba que el
servidor esté encendido. Si Windows todavía lo está iniciando, muestra
**"Esperando al servicio del hotel"** y entra sola apenas esté listo.

El tablero de cuartos se actualiza solo, en vivo — no hace falta recargar
la página para ver un check-in o un pago que se hizo desde otra pantalla.

---

## 2. Si se va la luz o se reinicia la PC

**Tranquilo — no hay que hacer nada.** El sistema corre como un servicio de
Windows: arranca solo apenas la PC prende, sin que nadie tenga que abrir
nada a mano. Esperar uno o dos minutos después de que la PC termine de
prender, y abrir **Hospedaje Carlos — Recepción**.

Si después de un rato la página no carga, ver la sección **7. Problemas
comunes** más abajo.

**Una sola excepción: el asistente de WhatsApp.** Los avisos por WhatsApp los
manda un programita aparte que se abre solo al **iniciar sesión** en Windows
(no apenas prende la PC, como el resto). O sea: si la PC arranca pero nadie
inicia sesión, todo el sistema funciona normal salvo los avisos de WhatsApp.
Con iniciar sesión como siempre, se abre solo y listo. Ver la sección
**8. WhatsApp** para el detalle.

---

## 3. Respaldos — dónde están y cómo restaurar uno

El sistema guarda una copia de seguridad de toda la información **todos los
días automáticamente**, sin que nadie tenga que acordarse de hacerlo. Las
copias quedan en:

```
C:\CasaCarlos\data\backups\
```

Cada archivo se llama `casacarlos-AAAA-MM-DD.db` (la fecha de ese día). Se
guardan los últimos 14 días — los más viejos se borran solos.

### Si hay que restaurar un respaldo (perder datos, base corrupta, etc.)

Esto **reemplaza** la información actual por la del día del respaldo
elegido — cualquier venta o check-in hecho después de esa fecha se pierde.
Solo hacerlo si es realmente necesario, y avisando primero a quien esté a
cargo.

1. Parar el servicio: abrir **"Servicios"** de Windows (buscar
   `services.msc` en el menú de inicio), buscar **CasaCarlos** en la lista,
   click derecho → **Detener**.
2. Ir a la carpeta `C:\CasaCarlos\data\`.
3. Renombrar `casacarlos.db` a algo como `casacarlos.db.viejo` (por las
   dudas, no borrarlo todavía).
4. Si existen, borrar `casacarlos.db-wal` y `casacarlos.db-shm` (son
   archivos temporales, se recrean solos).
5. Copiar el archivo de respaldo elegido desde `data\backups\` a `data\`, y
   renombrarlo a `casacarlos.db` (sin la fecha).
6. Volver a **Servicios** → **CasaCarlos** → click derecho → **Iniciar**.

---

## 4. Cómo actualizar el sistema (sin perder nada)

Esto lo hace normalmente quien dio soporte técnico — pero si alguna vez hay
que hacerlo en el momento, así de simple es: **un solo doble clic**, nada
más.

1. Se entrega un archivo nuevo, por ejemplo `HospedajeCarlos-Setup.exe`.
2. Se lo hace doble clic y se sigue el asistente (aceptar los permisos de
   administrador que pida Windows).
3. El asistente **detecta solo** que ya hay una instalación funcionando y
   avisa en pantalla "esto es una ACTUALIZACIÓN" antes de instalar — no hay
   que tocar nada más, no vuelve a pedir los datos de SUNAT, ni el
   certificado, ni el nombre y el logo del hotel.
4. Tarda unos minutos (actualiza y recompila las pantallas). Mientras tanto, recepción
   y kiosco van a estar apagados — mejor hacerlo fuera de horario, o cuando
   no haya un huésped a mitad de un check-in en el kiosco.
5. Al terminar, el sistema vuelve a prender solo con el código nuevo.

**Qué se conserva siempre, así se actualice mil veces:** la base de datos
completa (todos los cuartos, ventas, clientes, historial), los respaldos
diarios, las imágenes cargadas de los productos, el logo y el nombre del
hotel, las cuentas de cobro con sus QR, y el archivo `.env` con el
RUC/certificado/credenciales de SUNAT ya cargados. Nada de eso se toca ni se
pisa.

**Lo que NO hay que hacer:** correr un desinstalador aparte antes. Con este
instalador ya no hace falta — un solo archivo alcanza tanto para instalar
por primera vez como para actualizar.

---

## 5. Usar el kiosco desde otro dispositivo en la red

Si el kiosco no está en la misma PC (por ejemplo, una tablet en el
mostrador), hace falta la dirección de red (IP) de la PC principal:

1. En la PC principal, abrir una ventana de comando y escribir `ipconfig`.
2. Buscar la línea **"Dirección IPv4"** (algo como `192.168.100.5`).
3. En el otro dispositivo, entrar a `http://<esa-IP>:4000/kiosk/` (por
   ejemplo `http://192.168.100.5:4000/kiosk/`).

Los dos dispositivos tienen que estar en la misma red WiFi/cableada.

---

## 6. Certificado SUNAT y datos de facturación

Todo esto se administra desde **Ajustes → Facturación SUNAT**, en la barra
lateral de recepción. Solo lo ve el administrador. Sirve tanto para la
primera carga como para corregir algo que quedó mal puesto en la
instalación: los cambios se aplican al instante, sin reinstalar ni reiniciar
el sistema.

### Modo de trabajo

- **MOCK — prueba interna**: no se envía nada a SUNAT. Los comprobantes se
  arman y se guardan, pero no tienen valor legal. Sirve para practicar.
- **BETA — pruebas con SUNAT**: se envía al ambiente de pruebas real de
  SUNAT. Lo que se emita ahí no tiene valor legal.
- **PRODUCCION — facturación real**: cada boleta y factura se emite de
  verdad y queda declarada ante SUNAT.

Arriba de todo, la pantalla muestra siempre en qué modo está funcionando el
sistema. Si dice que la configuración guardada es una y está funcionando en
otra, es porque algo de esa configuración no se pudo usar al arrancar (el
caso típico: el certificado ya no está en su carpeta); abajo aparece la
lista de lo que falta.

### Datos del hotel y clave SOL

- **Datos del hotel**: RUC, razón social, nombre comercial, dirección,
  ubigeo, distrito, provincia y departamento. Van impresos dentro de cada
  comprobante.
- **Clave SOL**: el **usuario secundario** que se crea en el portal SOL de
  SUNAT con el perfil de facturación electrónica. Nunca la clave SOL
  principal del RUC. La clave guardada no se muestra nunca: dejar el campo
  vacío al guardar significa conservar la que ya estaba.

### Certificado digital

El archivo `.pfx` que entrega SUNAT (el certificado gratuito para MYPE dura
tres años). Se sube junto con su contraseña y **se verifica antes de
reemplazar al anterior**: si la contraseña está mal, no se toca nada y el
sistema sigue facturando con el certificado viejo. Una vez cargado, la
pantalla muestra a nombre de quién está y hasta qué fecha sirve — ahí se ve
de un vistazo cuándo hay que renovarlo.

### Probar conexión

El botón **Probar conexión** consulta a SUNAT sin emitir nada, para
confirmar que la PC llega al servicio. En **producción** también avisa si
SUNAT rechaza el usuario o la clave. En **BETA no sirve para probar
credenciales**: ese ambiente responde igual con la clave correcta y con una
equivocada.

El archivo de configuración (`C:\CasaCarlos\.env`) sigue existiendo y es el
mismo que edita esta pantalla; ya no hace falta tocarlo a mano.

---

## 7. Problemas comunes

**La aplicación no carga / pantalla en blanco:**
1. Abrir **Servicios** de Windows (`services.msc`).
2. Buscar **CasaCarlos** en la lista.
3. Si dice "Detenido", click derecho → **Iniciar**.
4. Esperar medio minuto y volver a abrir **Hospedaje Carlos — Recepción**.

**El kiosco quedó trabado en una pantalla:** el kiosco se reinicia solo a
los 20 segundos de terminar una operación, o a los 2 minutos de no tocarse
— no hace falta apagar nada, solo esperar.

**No llegan los avisos por WhatsApp:** ver la sección **8. WhatsApp** acá
abajo.

**Nada de esto funcionó:** contactar a quien dio soporte técnico del
sistema, indicando qué se ve en pantalla (o una foto) y qué se estaba
haciendo justo antes.

---

## 8. WhatsApp — vincular el teléfono del hotel

El sistema avisa por WhatsApp cuando un cuarto se pasa del tiempo, cuando un
producto queda con poco stock y cuando una caja cierra con diferencia. Para
que eso funcione hay que vincular **una sola vez** el WhatsApp del hotel.

### Vincular por primera vez

1. Entrar al sistema como **administrador**.
2. Ir a **Notificaciones** → pestaña **WhatsApp**.
3. Apretar **Conectar WhatsApp** y esperar unos segundos (la primera vez
   puede tardar hasta medio minuto).
4. Cuando aparezca el código QR en pantalla: en el **teléfono del hotel**,
   abrir WhatsApp → **Dispositivos vinculados** → **Vincular un dispositivo**,
   y escanear el código.
5. Listo. Queda vinculado para siempre — no hay que repetirlo cada día ni
   después de reiniciar la PC.

En **Notificaciones → Destinatarios** se elige a qué números avisar y de qué
cosas. En **Cola** se ve qué se mandó y qué falló.

### El asistente de WhatsApp

WhatsApp funciona automatizando la versión web de WhatsApp, y eso necesita
correr dentro de la sesión de Windows — no puede ir junto con el resto del
sistema, que arranca antes de que nadie inicie sesión. Por eso va aparte, en
una ventanita llamada **«Hospedaje Carlos — WhatsApp»**.

- **Arranca sola y en segundo plano** al iniciar sesión en Windows. No se ve
  ninguna ventana: es normal, está trabajando igual.
- **Se reconecta sola.** Después de apagar y prender la PC no hay que hacer
  nada ni volver a escanear el QR: la vinculación se conserva y el asistente
  se reconecta a los pocos segundos.
- Si en **Notificaciones → WhatsApp** dice **«Agente apagado»**, esperar unos
  segundos (al prender la PC tarda un poco). Si persiste, abrir el acceso
  directo **«Hospedaje Carlos — WhatsApp»** del Escritorio — no pide QR de
  nuevo.

### Si dejó de andar

1. Ver si la ventana **«Hospedaje Carlos — WhatsApp»** está abierta. Si no,
   abrirla desde el acceso directo del Escritorio.
2. Si dice **«Desconectado»**, apretar **Conectar WhatsApp** de nuevo. Si
   pide QR otra vez, es que alguien desvinculó el dispositivo desde el
   teléfono — volver a escanear. **Ojo:** el botón **Desvincular** borra la
   vinculación a propósito y obliga a escanear de nuevo; usarlo solo para
   cambiar de teléfono.
3. Revisar que el teléfono del hotel tenga internet y que WhatsApp funcione
   normal en él. Si el teléfono está sin señal o sin batería, el sistema no
   puede mandar nada.

---

## 9. Productos, imágenes y precios

### Administrador

1. Ir a **Bodega** y abrir un producto.
2. En **Ficha del producto** se pueden cambiar nombre, categoría, descripción,
   costo, precio, stock mínimo y estado.
3. En **Galería** se pueden agregar hasta cuatro imágenes JPG, PNG o WebP de
   hasta 3 MB. La primera es la portada que aparece en el kiosco.
4. Las flechas cambian el orden. Para eliminar, pulsar **Eliminar** y luego
   **Confirmar**.

Las imágenes quedan en `C:\CasaCarlos\data\product-images\`, sobreviven a las
actualizaciones y se copian junto con el respaldo diario.

### Recepción

En **Bodega**, recepción ve una pantalla simplificada. Puede consultar imagen,
nombre, categoría y disponibilidad, pero solamente puede modificar el precio
de venta. No puede alterar stock, costo, ficha, categoría ni imágenes.

### Pantalla del cliente

El kiosco muestra la portada, nombre, descripción, categoría, precio y si el
producto está disponible o agotado. Precio, imagen y disponibilidad se
actualizan en vivo sin recargar la pantalla.

---

## 10. Logo, nombre del hotel y formas de cobro

Todo esto se administra desde **Ajustes**, en la barra lateral de recepción.
Solo lo ve el administrador.

### Al instalar por primera vez

El asistente de instalación pregunta el **nombre del hotel** y deja elegir el
**archivo del logo** (JPG, PNG o WebP). Los dos se pueden saltear y cargar
después desde Ajustes; y una vez cargados, ninguna actualización los pisa.

### Ajustes → Marca

- **Cargar logo** / **Cambiar logo**: la imagen aparece en la barra lateral de
  recepción, en la pantalla de acceso, en el kiosco del huésped y arriba de
  los comprobantes impresos. Hasta 3 MB; se ve mejor cuadrada y con fondo
  transparente.
- **Nombre del hotel** y **bajada**: el texto que acompaña al logo en esas
  mismas pantallas.

El logo queda en `C:\CasaCarlos\datarand-images\` y el nombre en
`C:\CasaCarlos\datarandrand.json`.

### Ajustes → Cobros

Acá se carga **por dónde cobra el hotel**. Lo que esté cargado y activo es
exactamente lo que el kiosco le ofrece al huésped al momento de pagar: si no
hay ninguna cuenta de Plin, Plin no aparece.

- **Billeteras digitales** (Yape, Plin, Lemon, Agora): se agrega la billetera,
  el titular y el teléfono. Después, desde la fila de esa billetera, se sube
  la **foto del QR** con **Subir QR**.
  > El QR tiene que ser el que exporta la app de la billetera desde el
  > teléfono del hotel — es el único que cobra de verdad. El sistema no
  > inventa ninguno.
- **Cuentas bancarias**: se pueden cargar **varias, de bancos distintos**, con
  número de cuenta y **CCI**. El huésped que elige Transferencia las ve todas
  y transfiere a la que le quede cómoda.
- **Nota para el huésped** (opcional): una línea corta que se muestra debajo
  de los datos, por ejemplo "cuenta en soles".
- **Editar** cambia cualquier dato. **Desactivar** saca ese medio de la
  pantalla del kiosco sin borrar nada — los pagos que ya entraron por ahí
  quedan intactos en el historial. La **✕** roja lo borra de verdad.

En recepción, al registrar un pago, la lista de métodos también se acomoda a
lo que esté cargado. Efectivo y POS (crédito/débito) están siempre, porque no
dependen de ninguna cuenta.
