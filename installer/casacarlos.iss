; Instalador de Casa Carlos para Windows.
;
; Qué hace, en orden:
;   1. Copia el código fuente del monorepo + el Node portátil a {app}
;      (default C:\CasaCarlos — sin espacio en la ruta a propósito, ver
;      docs/ARQUITECTURA.md §3 y el plan de F6: node-windows/winsw tiene
;      historial de bugs de comillas con rutas con espacio).
;   2. Un asistente pide los datos de SUNAT y arma {app}\.env.
;   3. Corre `pnpm install` + `pnpm -r run build` con el Node portátil
;      (vía corepack, que ya lee el `packageManager` fijado en package.json —
;      no hace falta instalar pnpm aparte).
;   4. Registra y arranca el servicio de Windows (scripts/service/install-service.cjs).
;   5. Deja 2 accesos directos de escritorio (recepción y kiosco).
;
; No empaqueta todo en un solo .exe (se evaluó @yao-pkg/pkg y se descartó —
; ver docs/ARQUITECTURA.md §3). Corre el código TypeScript tal cual, vía
; `tsx` como loader — el mismo mecanismo que ya usa `pnpm run dev`/`start`.
;
; NOTA PARA QUIEN COMPILE ESTO: compila limpio (ISCC, sin warnings) y ya se
; encontró y arregló un bug real de compilación (.env real quedaba
; empaquetado adentro del instalador — ver el comentario en [Files] abajo).
; Lo que todavía falta probar es CORRER el CasaCarlos-Setup.exe resultante
; contra una carpeta limpia y confirmar que el asistente + pnpm install +
; build + registro del servicio funcionan igual de bien empaquetados que
; corridos a mano (que es como se verificó cada pieza por separado). Antes
; de repartirlo al cliente, hacer esa prueba — ver la sección de
; Verificación en el plan de F6.

#define AppName "Casa Carlos"
#define AppVersion "1.0"
#define AppPublisher "Hoteles Casa Carlos"
#define ServiceName "CasaCarlos"

[Setup]
AppId={{8C6C6C1E-3B0A-4F1E-9C7D-CASACARLOS01}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName=C:\CasaCarlos
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
; Instalador de un solo .exe, comprimido — más simple de repartir.
OutputDir=.\output
OutputBaseFilename=CasaCarlos-Setup
Compression=lzma2
SolidCompression=yes
; Instala un servicio de Windows y escribe en C:\ — necesita administrador.
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Todo el monorepo fuente, menos lo que no hace falta, se regenera solo, o
; NUNCA debería viajar en un instalador:
;   - .env: son los secretos reales de ESTA máquina de desarrollo (RUC,
;     credenciales SOL, etc.) — el asistente arma uno nuevo para el cliente,
;     jamás el nuestro. Excluirlo acá no es opcional.
;   - apps\server\src\daemon: lo genera node-windows/winsw al instalar el
;     servicio EN ESTA máquina — config con rutas absolutas de acá, y
;     mientras el servicio está corriendo sus logs quedan abiertos
;     (bloquea la compilación si no se excluye).
;   - node_modules (se reinstala en destino), .git (no aplica a una
;     instalación), datos de desarrollo (nunca deberían viajar al cliente),
;     dist/ de los frontends (se reconstruye en destino), y el propio
;     `vendor/` de la máquina de build (el Node portátil se agrega aparte,
;     explícito, abajo — evita arrastrar cualquier otra cosa que haya
;     quedado en esa carpeta, como el instalador de Inno Setup descargado).
;   - data\*.pfx: certificado real de pruebas SUNAT de ESTA máquina de
;     desarrollo (data\sunat-beta-test.pfx) — secreto, nunca debe viajar;
;     el asistente pide y copia el certificado del CLIENTE aparte, en
;     WriteEnvFile más abajo.
;   - installer\output: es el propio .exe que este script está generando —
;     incluirlo causa que ISCC intente leer el archivo mientras lo está
;     escribiendo ("el proceso no tiene acceso al archivo").
Source: "..\*"; DestDir: "{app}"; Excludes: ".env,.env.local,node_modules,.git,.turbo,data\*.db,data\*.db-shm,data\*.db-wal,data\backups,data\*.pfx,dist,vendor,apps\server\src\daemon,installer\output,*.tsbuildinfo"; Flags: recursesubdirs ignoreversion

; El Node portátil — runtime propio, sin depender de que el cliente lo tenga instalado.
Source: "..\vendor\node-win-x64\*"; DestDir: "{app}\vendor\node-win-x64"; Flags: recursesubdirs ignoreversion

[Dirs]
Name: "{app}\data"

[Icons]
Name: "{commondesktop}\{#AppName} — Recepción"; Filename: "http://localhost:4000/"
Name: "{commondesktop}\{#AppName} — Kiosco"; Filename: "http://localhost:4000/kiosk/"
Name: "{group}\Manual de uso"; Filename: "{app}\docs\MANUAL-DE-USO.md"

[Run]
; 1) Dependencias + build de las 2 SPA. `corepack` (incluido en el Node
;    portátil) resuelve pnpm en la versión fijada por "packageManager" en
;    package.json — no hace falta instalar pnpm aparte ni que el cliente
;    tenga Node propio.
Filename: "{app}\vendor\node-win-x64\corepack.cmd"; \
  Parameters: "pnpm install"; \
  WorkingDir: "{app}"; \
  StatusMsg: "Instalando dependencias (puede tardar varios minutos la primera vez)..."; \
  Flags: runhidden waituntilterminated

Filename: "{app}\vendor\node-win-x64\corepack.cmd"; \
  Parameters: "pnpm -r run build"; \
  WorkingDir: "{app}"; \
  StatusMsg: "Compilando recepción y kiosco..."; \
  Flags: runhidden waituntilterminated

; 2) Registra y arranca el servicio de Windows.
Filename: "{app}\vendor\node-win-x64\node.exe"; \
  Parameters: "scripts\service\install-service.cjs"; \
  WorkingDir: "{app}"; \
  StatusMsg: "Registrando el servicio de Windows..."; \
  Flags: runhidden waituntilterminated

[UninstallRun]
; Antes de borrar archivos, apaga y desregistra el servicio.
Filename: "{app}\vendor\node-win-x64\node.exe"; \
  Parameters: "scripts\service\uninstall-service.cjs"; \
  WorkingDir: "{app}"; \
  RunOnceId: "UninstallCasaCarlosService"; \
  Flags: runhidden waituntilterminated

[UninstallDelete]
; Nunca borrar la base de datos ni los respaldos al desinstalar — son los
; datos reales del hotel, no archivos de la aplicación.
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\apps\web-reception\dist"
Type: filesandordirs; Name: "{app}\apps\web-kiosk\dist"
; `data\` queda fuera de esta lista a propósito.

[Code]
var
  SunatPage: TInputQueryWizardPage;
  SunatModePage: TInputOptionWizardPage;
  CertPage: TInputFileWizardPage;

procedure InitializeWizard;
begin
  // Datos del emisor — los mismos nombres de variable que ya lee
  // configureSunat() en apps/server/src/index.ts.
  SunatPage := CreateInputQueryPage(wpSelectDir,
    'Datos del hotel (SUNAT)', 'Se usan para armar los comprobantes electrónicos',
    'Podés dejarlos en blanco ahora y completarlos después a mano en el .env de la instalación — el sistema arranca igual, en modo de prueba (MOCK), sin tocar SUNAT de verdad.');
  SunatPage.Add('RUC:', False);
  SunatPage.Add('Razón social:', False);
  SunatPage.Add('Nombre comercial:', False);
  SunatPage.Add('Dirección:', False);
  SunatPage.Add('Ubigeo (6 dígitos):', False);
  SunatPage.Add('Distrito:', False);
  SunatPage.Add('Provincia:', False);
  SunatPage.Add('Departamento:', False);

  SunatModePage := CreateInputOptionPage(SunatPage.ID,
    'Modo de facturación electrónica', 'Elegí con qué ambiente de SUNAT arranca',
    'MOCK no toca la red — sirve para probar el sistema sin certificado. Se puede cambiar después editando el archivo .env de la instalación (SUNAT_MODE).',
    False, False);
  SunatModePage.Add('MOCK — modo de prueba, sin SUNAT real (recomendado para empezar)');
  SunatModePage.Add('BETA — ambiente de pruebas real de SUNAT (necesita certificado)');
  SunatModePage.Add('PRODUCCION — factura de verdad (necesita el certificado MYPE del cliente)');
  SunatModePage.SelectedValueIndex := 0;

  CertPage := CreateInputFilePage(SunatModePage.ID,
    'Certificado digital SUNAT', 'Solo si elegiste BETA o PRODUCCION',
    'Podés saltear esto si vas a arrancar en modo MOCK.');
  CertPage.Add('Archivo del certificado (.pfx):', 'Certificados (*.pfx)|*.pfx|Todos los archivos|*.*', '.pfx');
end;

function GetSunatMode(Param: String): String;
begin
  case SunatModePage.SelectedValueIndex of
    1: Result := 'BETA';
    2: Result := 'PRODUCCION';
  else
    Result := 'MOCK';
  end;
end;

procedure WriteEnvFile;
var
  Lines: TArrayOfString;
  EnvPath: String;
  CertDestPath: String;
begin
  SetArrayLength(Lines, 1);

  Lines[GetArrayLength(Lines) - 1] := 'PORT=4000';
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'LOG_LEVEL=info';
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_MODE=' + GetSunatMode('');
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_RUC=' + SunatPage.Values[0];
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_RAZON_SOCIAL=' + SunatPage.Values[1];
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_NOMBRE_COMERCIAL=' + SunatPage.Values[2];
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_DIRECCION=' + SunatPage.Values[3];
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_UBIGEO=' + SunatPage.Values[4];
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_DISTRITO=' + SunatPage.Values[5];
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_PROVINCIA=' + SunatPage.Values[6];
  SetArrayLength(Lines, GetArrayLength(Lines) + 1);
  Lines[GetArrayLength(Lines) - 1] := 'SUNAT_DEPARTAMENTO=' + SunatPage.Values[7];

  // El .pfx y las credenciales SOL/PRODUCCION no se piden en este asistente —
  // son secretos reales del cliente, mejor que los complete a mano en el
  // .env de la instalación después (queda documentado en el manual de uso)
  // en vez de que pasen por los logs del instalador. Sí copiamos el archivo
  // del certificado si lo seleccionó, para que quede ubicado y listo.
  if CertPage.Values[0] <> '' then
  begin
    CertDestPath := ExpandConstant('{app}\data\sunat-cert.pfx');
    CopyFile(CertPage.Values[0], CertDestPath, False);
    SetArrayLength(Lines, GetArrayLength(Lines) + 1);
    Lines[GetArrayLength(Lines) - 1] := 'SUNAT_CERT_PATH=' + CertDestPath;
    SetArrayLength(Lines, GetArrayLength(Lines) + 1);
    Lines[GetArrayLength(Lines) - 1] := '# Completar a mano: SUNAT_CERT_PASSWORD, SUNAT_SOL_USER, SUNAT_SOL_PASSWORD';
  end;

  EnvPath := ExpandConstant('{app}\.env');
  SaveStringsToFile(EnvPath, Lines, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    WriteEnvFile;
  end;
end;
