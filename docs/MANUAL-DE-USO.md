# Hospedaje Carlos — Manual de uso

Guía rápida para el personal del hotel. No hace falta saber de computadoras
para seguir esto — son pasos concretos, uno por uno.

---

## 1. Entrar al sistema

- **Recepción**: en el navegador de la PC, entrar a `http://localhost:4000/`.
  Si ya está abierto, seguramente hay un acceso directo en el escritorio que
  dice **"Hospedaje Carlos — Recepción"**.
- **Kiosco** (la pantalla que ve el cliente): acceso directo **"Hospedaje
  Carlos — Kiosco"**, o `http://localhost:4000/kiosk/`.
- Usuario y contraseña los da el administrador. También se puede entrar con
  PIN rápido para cambiar de recepcionista sin cerrar sesión del todo.
- **¿No aparece el acceso directo en el escritorio?** También están en el
  menú Inicio de Windows, dentro de la carpeta **"Hospedaje Carlos"** — sirven
  exactamente igual. No hace falta reinstalar nada para recuperarlos: basta
  con abrirlos desde ahí, o crear uno nuevo apuntando a las mismas
  direcciones de arriba.

El tablero de cuartos se actualiza solo, en vivo — no hace falta recargar
la página para ver un check-in o un pago que se hizo desde otra pantalla.

---

## 2. Si se va la luz o se reinicia la PC

**Tranquilo — no hay que hacer nada.** El sistema corre como un servicio de
Windows: arranca solo apenas la PC prende, sin que nadie tenga que abrir
nada a mano. Esperar uno o dos minutos después de que la PC termine de
prender, y volver a entrar a `http://localhost:4000/`.

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
   que tocar nada más, no vuelve a pedir los datos de SUNAT ni el
   certificado.
4. Tarda unos minutos (recompila las pantallas). Mientras tanto, recepción
   y kiosco van a estar apagados — mejor hacerlo fuera de horario, o cuando
   no haya un huésped a mitad de un check-in en el kiosco.
5. Al terminar, el sistema vuelve a prender solo con el código nuevo.

**Qué se conserva siempre, así se actualice mil veces:** la base de datos
completa (todos los cuartos, ventas, clientes, historial), los respaldos
diarios, y el archivo `.env` con el RUC/certificado/credenciales de SUNAT ya
cargados. Nada de eso se toca ni se pisa.

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

El certificado digital para emitir boletas/facturas electrónicas vence
cada cierto tiempo (SUNAT lo indica al momento de tramitarlo). Cuando haya
que renovarlo, o si hay que cambiar algún dato del hotel (RUC, dirección,
etc.), esos ajustes se hacen en un archivo de configuración
(`C:\CasaCarlos\.env`) — **contactar a quien dio soporte técnico del
sistema** para hacer este cambio, no editarlo sin ayuda.

---

## 7. Problemas comunes

**La página no carga / pantalla en blanco:**
1. Abrir **Servicios** de Windows (`services.msc`).
2. Buscar **CasaCarlos** en la lista.
3. Si dice "Detenido", click derecho → **Iniciar**.
4. Esperar medio minuto y volver a entrar a `http://localhost:4000/`.

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

- **Se abre sola** al iniciar sesión en Windows. Se puede minimizar.
- Se puede **cerrar sin miedo**: no afecta recepción, caja, kiosco ni
  facturación. Lo único que pasa es que dejan de salir los avisos.
- Si en **Notificaciones → WhatsApp** dice **«Agente apagado»**, es
  justamente eso: abrir el acceso directo **«Hospedaje Carlos — WhatsApp»**
  (está en el Escritorio y en el Menú Inicio) y esperar unos segundos.

### Si dejó de andar

1. Ver si la ventana **«Hospedaje Carlos — WhatsApp»** está abierta. Si no,
   abrirla desde el acceso directo del Escritorio.
2. Si dice **«Desconectado»**, apretar **Conectar WhatsApp** de nuevo. Si
   pide QR otra vez, es que alguien desvinculó el dispositivo desde el
   teléfono — volver a escanear.
3. Revisar que el teléfono del hotel tenga internet y que WhatsApp funcione
   normal en él. Si el teléfono está sin señal o sin batería, el sistema no
   puede mandar nada.
