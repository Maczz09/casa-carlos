# Requisitos de instalación

Hospedaje Carlos se instala en una computadora Windows de 64 bits. El
instalador incluye los runtimes de la aplicación y guía la configuración
inicial de la marca y de SUNAT.

## Sistema operativo y equipo

- Windows 10 22H2 de 64 bits (build 19045) o Windows 11 de 64 bits.
- Procesador de 2 núcleos a 1 GHz o superior.
- 4 GB de RAM como mínimo; 8 GB recomendados para recepción y kiosco en el
  mismo equipo.
- 4 GB libres en disco para el programa, sus dependencias y las primeras
  copias de seguridad. Conviene reservar más espacio según crezca la base de
  datos y los documentos electrónicos.
- Pantalla mínima de 1366 × 768. Para el kiosco se recomienda Full HD táctil.
- Una cuenta de Windows con permisos de administrador para instalar el
  servicio y crear la regla de red.
- Conexión a Internet durante la primera instalación. También es necesaria
  para enviar comprobantes a SUNAT, sincronizar sus estados y usar avisos
  externos.

## Componentes incluidos

El usuario no necesita instalar herramientas de desarrollo. El mismo setup
incluye y configura:

- Node.js 24 portátil y pnpm mediante Corepack.
- Microsoft Edge WebView2 Runtime.
- Microsoft Visual C++ Redistributable x64.
- .NET Framework 4.8 cuando el sistema todavía no lo tenga.
- El servicio de Windows `CasaCarlos` y sus accesos directos.
- Una regla del Firewall de Windows para TCP 4000, limitada al perfil privado
  y a la subred local. La regla se elimina al desinstalar.

Rust, MinGW, Inno Setup y TypeScript solo hacen falta en la computadora donde
se compila el instalador; no son requisitos de la computadora del hotel.

## Primera instalación

Durante el asistente se puede elegir el nombre, lema y logo del hotel, además
del ambiente inicial de SUNAT (MOCK, BETA o PRODUCCIÓN). Todo se puede corregir
después desde Ajustes sin reinstalar. Las credenciales SOL y la contraseña del
certificado se cargan dentro de la aplicación para que no queden expuestas en
el registro del instalador.

Después de instalar, Windows debe tener la red marcada como **Privada** si el
kiosco u otros equipos accederán al servidor. Para producción se recomienda
mantener Windows Update activo y usar una fuente de alimentación estable.
