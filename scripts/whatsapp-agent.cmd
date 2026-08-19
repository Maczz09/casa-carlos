@echo off
REM Asistente de WhatsApp de Hospedaje Carlos.
REM
REM Corre APARTE del servicio de Windows, en la sesion del usuario: WhatsApp
REM se maneja automatizando un navegador, y Windows aisla los servicios en la
REM "Sesion 0", sin escritorio, donde el navegador no arranca. Ver
REM services/notifications/src/whatsapp-bridge.ts.
REM
REM Se abre solo al iniciar sesion (acceso directo en la carpeta Inicio que
REM crea el instalador). Se puede cerrar sin afectar al resto del sistema:
REM solo deja de mandarse WhatsApp, recepcion/caja/facturacion siguen igual.
title Hospedaje Carlos - Asistente de WhatsApp
REM El cd tiene que ser a apps\whatsapp-agent, NO a la raiz: "--import tsx"
REM resuelve el paquete "tsx" desde el directorio actual del proceso, y con
REM pnpm (node_modules aislado, sin hoisting) tsx solo existe dentro de
REM apps\whatsapp-agent\node_modules. Desde la raiz falla con
REM "Cannot find package 'tsx'" -- el mismo bug que tuvo el servicio en F6,
REM ver scripts\service\install-service.cjs. El agente ubica data\ por la
REM ruta del propio archivo (import.meta.url), no por el cd, asi que esto no
REM afecta donde busca la sesion ni el token.
cd /d "%~dp0..\apps\whatsapp-agent"
echo.
echo   Hospedaje Carlos - Asistente de WhatsApp
echo   ----------------------------------------
echo   Dejalo abierto para que se manden los avisos por WhatsApp.
echo   Podes minimizarlo. Para vincular el telefono, entra a
echo   Notificaciones - WhatsApp desde el sistema.
echo.
"%~dp0..\vendor\node-win-x64\node.exe" --import tsx "%~dp0..\apps\whatsapp-agent\src\index.ts"
echo.
echo   El asistente se cerro. Cerra esta ventana o volve a abrir el acceso directo.
pause
