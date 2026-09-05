; Instalador de Hospedaje Carlos para Windows. Verificado de punta a punta:
; sirve tanto para la instalación de cero como para actualizar una que ya
; está corriendo, sin perder la base de datos ni la configuración de SUNAT.
;
; Instalación nueva, qué hace en orden:
;   1. Copia el código fuente del monorepo + el Node portátil a {app}
;      (default C:\CasaCarlos — sin espacio en la ruta a propósito, ver
;      docs/ARQUITECTURA.md §3 y el plan de F6: node-windows/winsw tiene
;      historial de bugs de comillas con rutas con espacio).
;   2. Un asistente pide los datos de SUNAT y arma {app}\.env.
;   3. Corre `pnpm install` + `pnpm -r run build` con el Node portátil
;      (vía corepack, que ya lee el `packageManager` fijado en package.json —
;      no hace falta instalar pnpm aparte).
;   4. Registra y arranca el servicio de Windows (scripts/service/install-service.cjs).
;   5. Deja accesos directos en el escritorio Y el menú Inicio (recepción y kiosco).
;
; Actualización (mismo .exe, corrido sobre una carpeta {app} que ya existe):
; salta el asistente de SUNAT, PrepareToInstall para y desregistra el
; servicio viejo ANTES de copiar archivos (si no, quedan bloqueados), y el
; .env existente nunca se toca. No hace falta correr unins000.exe a mano
; primero — un solo doble clic alcanza. Ver [Code] más abajo.
;
; No empaqueta todo en un solo .exe (se evaluó @yao-pkg/pkg y se descartó —
; ver docs/ARQUITECTURA.md §3). Corre el código TypeScript tal cual, vía
; `tsx` como loader — el mismo mecanismo que ya usa `pnpm run dev`/`start`.

; "AppName" es lo único que cambió con el rebranding a Hospedaje Carlos —
; el nombre de la carpeta de instalación (DefaultDirName) y el del servicio
; de Windows (ServiceName) quedan igual a propósito: son la instalación que
; YA está corriendo en la máquina del cliente, y este mismo instalador tiene
; que poder actualizarla en el mismo lugar sin dejar una segunda instalación
; huérfana. Ver PrepareToInstall más abajo.
#define AppName "Hospedaje Carlos"
#define AppVersion "1.1"
#define AppPublisher "Hospedaje Carlos"
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
OutputBaseFilename=HospedajeCarlos-Setup
Compression=lzma2
SolidCompression=yes
; Instala un servicio de Windows y escribe en C:\ — necesita administrador.
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; Lista blanca: nunca usar "..\*" acá. El repositorio puede convivir con
; documentos o carpetas personales y no deben terminar dentro del instalador.
; Al copiar únicamente los componentes conocidos también quedan fuera, por
; diseño, .env, bases de datos, certificados, imágenes del hotel, sesiones de
; WhatsApp, node_modules, cachés y artefactos de desarrollo.
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\pnpm-lock.yaml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\pnpm-workspace.yaml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\tsconfig.base.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\.puppeteerrc.cjs"; DestDir: "{app}"; Flags: ignoreversion

Source: "..\apps\server\*"; DestDir: "{app}\apps\server"; Excludes: "node_modules,dist,src\daemon,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\apps\web-reception\*"; DestDir: "{app}\apps\web-reception"; Excludes: "node_modules,dist,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\apps\web-kiosk\*"; DestDir: "{app}\apps\web-kiosk"; Excludes: "node_modules,dist,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\apps\whatsapp-agent\*"; DestDir: "{app}\apps\whatsapp-agent"; Excludes: "node_modules,dist,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\packages\*"; DestDir: "{app}\packages"; Excludes: "node_modules,dist,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\services\*"; DestDir: "{app}\services"; Excludes: "node_modules,dist,*.tsbuildinfo"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\scripts\service\*"; DestDir: "{app}\scripts\service"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\scripts\whatsapp-agent.cmd"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\whatsapp-agent-oculto.vbs"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\docs\*"; DestDir: "{app}\docs"; Flags: recursesubdirs createallsubdirs ignoreversion

; El Node portátil — runtime propio, sin depender de que el cliente lo tenga instalado.
Source: "..\vendor\node-win-x64\*"; DestDir: "{app}\vendor\node-win-x64"; Flags: recursesubdirs ignoreversion

; Aplicación de escritorio Tauri ya compilada. Usa WebView2 del sistema y no
; necesita .NET, Rust, Node global ni herramientas de desarrollo en el cliente.
Source: "..\apps\desktop\publish\*"; DestDir: "{app}\desktop"; Flags: recursesubdirs ignoreversion

; Bootstrapper oficial de WebView2. En Windows 10/11 normalmente ya está
; instalado; si no, lo agrega silenciosamente durante la instalación. El
; archivo es opcional para que una compilación sin red siga siendo posible.
Source: "..\vendor\webview2\MicrosoftEdgeWebview2Setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall skipifsourcedoesntexist

[Dirs]
Name: "{app}\data"
; Marca del hotel: el nombre y el logo que se eligen en el asistente. Viven
; bajo data\ para que una actualización no los pise (ver apps/server/src/brand-store.ts).
Name: "{app}\data\brand"
Name: "{app}\data\brand-images"

[Icons]
; Duplicados a propósito en Escritorio Y Menú Inicio — si algún día un accesos
; directo del escritorio desaparece (perfil de usuario, limpieza de terceros,
; lo que sea), queda el del Menú Inicio como camino alternativo para prender
; las pantallas sin tener que volver a instalar nada.
Name: "{commondesktop}\{#AppName} — Recepción"; Filename: "{app}\desktop\HospedajeCarlos.exe"; WorkingDir: "{app}"; Comment: "Abrir el sistema de recepción"
Name: "{commondesktop}\{#AppName} — Kiosco"; Filename: "{app}\desktop\HospedajeCarlos.exe"; Parameters: "--kiosk"; WorkingDir: "{app}"; Comment: "Abrir la pantalla para el cliente"
Name: "{group}\{#AppName} — Recepción"; Filename: "{app}\desktop\HospedajeCarlos.exe"; WorkingDir: "{app}"
Name: "{group}\{#AppName} — Kiosco"; Filename: "{app}\desktop\HospedajeCarlos.exe"; Parameters: "--kiosk"; WorkingDir: "{app}"
Name: "{group}\Manual de uso"; Filename: "{app}\docs\MANUAL-DE-USO.md"

; Asistente de WhatsApp: arranca solo al iniciar sesión y corre OCULTO, sin
; ventana -- la persona del mostrador no tiene que saber que existe. No puede
; vivir dentro del servicio de Windows porque automatiza un navegador, y los
; servicios corren en la "Sesión 0" sin escritorio, donde Chromium/Edge no
; arranca (comprobado en la instalación real con dos cuentas distintas y varios
; flags). Ver services/notifications/src/whatsapp-bridge.ts. Se lanza vía
; wscript + .vbs porque un .cmd siempre parpadea una consola negra al arrancar.
; Lo que tenga para decir queda en data\whatsapp-agent.log.
Name: "{commonstartup}\{#AppName} — WhatsApp"; Filename: "wscript.exe"; \
  Parameters: """{app}\scripts\whatsapp-agent-oculto.vbs"""; WorkingDir: "{app}"; \
  Comment: "Mantiene vinculado el WhatsApp del hotel para los avisos automáticos"
; En el Escritorio queda uno igual, solo por si alguien lo cierra sin querer y
; hay que reabrirlo sin reiniciar la PC. Que se lancen dos a la vez no rompe
; nada: el agente tiene candado de instancia única (ver apps/whatsapp-agent).
Name: "{commondesktop}\{#AppName} — WhatsApp"; Filename: "wscript.exe"; \
  Parameters: """{app}\scripts\whatsapp-agent-oculto.vbs"""; WorkingDir: "{app}"; \
  Comment: "Abrilo si los avisos por WhatsApp dejaron de salir"

[Run]
; 1) Asegura WebView2, motor visual de la aplicación de escritorio. Si ya
;    existe, el instalador oficial termina inmediatamente sin cambiar nada.
Filename: "{tmp}\MicrosoftEdgeWebview2Setup.exe"; \
  Parameters: "/silent /install"; \
  StatusMsg: "Preparando la aplicación de escritorio..."; \
  Flags: runhidden waituntilterminated skipifdoesntexist

; 2) Dependencias + build de las 2 SPA. `corepack` (incluido en el Node
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

; 3) Registra y arranca el servicio de Windows.
Filename: "{app}\vendor\node-win-x64\node.exe"; \
  Parameters: "scripts\service\install-service.cjs"; \
  WorkingDir: "{app}"; \
  StatusMsg: "Registrando el servicio de Windows..."; \
  Flags: runhidden waituntilterminated

; 4) Arranca el asistente de WhatsApp ya mismo y oculto -- si no, recién
;    saldría al próximo inicio de sesión (ver el acceso directo en
;    {commonstartup}) y quien acaba de instalar vería "Agente apagado" sin
;    entender por qué. Sin "postinstall": eso lo dejaba como casilla opcional
;    en la última pantalla, y si nadie la marcaba WhatsApp quedaba muerto
;    -- pasó de verdad en la instalación real. Ahora es parte de la
;    instalación, no una opción.
Filename: "wscript.exe"; \
  Parameters: """{app}\scripts\whatsapp-agent-oculto.vbs"""; \
  WorkingDir: "{app}"; \
  StatusMsg: "Iniciando el asistente de WhatsApp..."; \
  Flags: nowait

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
Type: filesandordirs; Name: "{app}\desktop"
; `data\` queda fuera de esta lista a propósito.

[Code]
var
  BrandPage: TInputQueryWizardPage;
  LogoPage: TInputFileWizardPage;
  SunatPage: TInputQueryWizardPage;
  SunatModePage: TInputOptionWizardPage;
  CertPage: TInputFileWizardPage;

/// <summary>
/// True cuando {app}\.env ya existe -- significa que esto es una
/// ACTUALIZACIÓN sobre una instalación que ya está corriendo, no la primera
/// vez. Se usa para saltar el asistente de SUNAT (no tiene sentido volver a
/// pedir esos datos, y hacerlo pisaría credenciales SOL/certificado que se
/// hayan completado a mano después de instalar) y para no volver a escribir
/// el .env encima.
/// </summary>
function EsActualizacion: Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\.env'));
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  if EsActualizacion then
  begin
    if (PageID = BrandPage.ID) or (PageID = LogoPage.ID) or (PageID = SunatPage.ID) or (PageID = SunatModePage.ID) or (PageID = CertPage.ID) then
      Result := True;
  end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo + NewLine + NewLine;
  if EsActualizacion then
    Result := Result + 'Se detectó una instalación existente en esta carpeta: esto es una ACTUALIZACIÓN.' + NewLine
      + 'Se van a conservar los datos del hotel (base de datos, respaldos) y la configuración de SUNAT (.env) que ya están ahí.'
  else
    Result := Result + 'Instalación nueva.';
end;

/// <summary>
/// Corre justo antes de que Inno empiece a copiar archivos. Si ya hay una
/// instalación corriendo, el servicio de Windows tiene los .ts/módulos
/// abiertos y copiar encima falla con "Acceso denegado" -- por eso antes
/// había que correr unins000.exe a mano primero. Parando y desregistrando
/// acá, un solo .exe alcanza para actualizar.
/// </summary>
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
  Intentos: Integer;
begin
  Result := '';
  if EsActualizacion then
  begin
    Exec('sc.exe', 'stop casacarlos.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(3000);
    Exec('sc.exe', 'delete casacarlos.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    // "sc delete" no borra el servicio al instante -- Windows lo deja
    // "marcado para eliminar" hasta que se cierra el último handle abierto
    // (confirmado en una actualización real: el registro seguía "instalado"
    // para el paso de más abajo que lo vuelve a crear, con un Sleep fijo de
    // apenas 1s). Se espera activamente, con "sc query", a que el nombre
    // quede libre de verdad antes de seguir, hasta 10s -- si no alcanza,
    // install-service.cjs igual se autorecupera (ver ese archivo).
    Intentos := 0;
    while Intentos < 20 do
    begin
      Exec('sc.exe', 'query casacarlos.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      if ResultCode <> 0 then
        break;
      Sleep(500);
      Intentos := Intentos + 1;
    end;
  end;
end;

procedure InitializeWizard;
begin
  // Identidad visible del hotel. No va al .env ni a la base: el servidor la
  // lee de data\brand (ver apps/server/src/brand-store.ts), que es lo único
  // que este asistente puede escribir y que además sobrevive a las
  // actualizaciones. Se puede cambiar después desde Ajustes → Marca.
  BrandPage := CreateInputQueryPage(wpSelectDir,
    'Nombre del hotel', 'Es el nombre que van a ver en pantalla el personal y los huéspedes',
    'Si lo dejás en blanco se usa "Hospedaje Carlos". Se puede cambiar después desde Ajustes → Marca, sin reinstalar nada.');
  BrandPage.Add('Nombre del hotel:', False);
  BrandPage.Add('Bajada (opcional):', False);
  BrandPage.Values[0] := 'Hospedaje Carlos';
  BrandPage.Values[1] := 'Sistema de hospedaje';

  LogoPage := CreateInputFilePage(BrandPage.ID,
    'Logo del hotel', 'La imagen que acompaña al nombre',
    'Se muestra en la barra lateral de recepción, en la pantalla de acceso, en el kiosco del huésped y arriba de los comprobantes impresos. JPG, PNG o WebP; se ve mejor cuadrado y con fondo transparente. Podés saltear esto y cargarlo después desde Ajustes → Marca.');
  LogoPage.Add('Archivo del logo:', 'Imágenes (*.png;*.jpg;*.jpeg;*.webp)|*.png;*.jpg;*.jpeg;*.webp|Todos los archivos|*.*', '.png');

  // Datos del emisor — los mismos nombres de variable que ya lee
  // configureSunat() en apps/server/src/index.ts.
  SunatPage := CreateInputQueryPage(LogoPage.ID,
    'Datos del hotel (SUNAT)', 'Se usan para armar los comprobantes electrónicos',
    'Podés dejarlos en blanco ahora: el sistema arranca igual en modo de prueba (MOCK), sin tocar SUNAT de verdad, y todo esto se completa o se corrige después desde Ajustes → Facturación SUNAT, sin reinstalar nada.');
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
    'MOCK no toca la red — sirve para probar el sistema sin certificado. El modo se puede cambiar cuando haga falta desde Ajustes → Facturación SUNAT.',
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

  // Las credenciales SOL no se piden en este asistente: son secretos reales
  // del cliente y no tienen por qué pasar por los logs del instalador. Se
  // cargan después desde Ajustes → Facturación SUNAT, que además verifica el
  // certificado contra su contraseña. Sí copiamos el archivo del certificado
  // si lo seleccionó, para que quede ubicado y listo.
  if CertPage.Values[0] <> '' then
  begin
    CertDestPath := ExpandConstant('{app}\data\sunat-cert.pfx');
    CopyFile(CertPage.Values[0], CertDestPath, False);
    SetArrayLength(Lines, GetArrayLength(Lines) + 1);
    Lines[GetArrayLength(Lines) - 1] := 'SUNAT_CERT_PATH=' + CertDestPath;
    SetArrayLength(Lines, GetArrayLength(Lines) + 1);
    Lines[GetArrayLength(Lines) - 1] := '# La contraseña del certificado y las credenciales SOL se cargan desde Ajustes → Facturación SUNAT';
  end;

  EnvPath := ExpandConstant('{app}\.env');
  SaveStringsToFile(EnvPath, Lines, False);
end;

/// <summary>
/// Escapa una cadena para meterla dentro de un string JSON.
/// </summary>
function JsonEscape(Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
end;

/// <summary>
/// Deja el nombre y el logo elegidos donde el servidor los busca:
/// data\brand\brand.json y data\brand-images\logo.<ext>. El servidor
/// revalida la imagen por sus bytes reales al leerla, así que un archivo que
/// no sea una imagen de verdad se ignora en vez de romper la pantalla.
/// </summary>
procedure WriteBrandFiles;
var
  Lines: TArrayOfString;
  Nombre: String;
  Lema: String;
  Extension: String;
  LogoDest: String;
  LogoArchivo: String;
begin
  Nombre := Trim(BrandPage.Values[0]);
  if Nombre = '' then
    Nombre := 'Hospedaje Carlos';
  Lema := Trim(BrandPage.Values[1]);

  LogoArchivo := '';
  if LogoPage.Values[0] <> '' then
  begin
    Extension := LowerCase(ExtractFileExt(LogoPage.Values[0]));
    if Extension = '.jpeg' then
      Extension := '.jpg';
    if (Extension <> '.png') and (Extension <> '.jpg') and (Extension <> '.webp') then
      Extension := '.png';
    LogoArchivo := 'logo' + Extension;
    LogoDest := ExpandConstant('{app}\data\brand-images\') + LogoArchivo;
    if not CopyFile(LogoPage.Values[0], LogoDest, False) then
      LogoArchivo := '';
  end;

  SetArrayLength(Lines, 4);
  Lines[0] := '{';
  Lines[1] := '  "nombre": "' + JsonEscape(Nombre) + '",';
  if LogoArchivo <> '' then
    Lines[2] := '  "lema": "' + JsonEscape(Lema) + '",'
  else
    Lines[2] := '  "lema": "' + JsonEscape(Lema) + '"';
  if LogoArchivo <> '' then
  begin
    SetArrayLength(Lines, 5);
    Lines[3] := '  "logoArchivo": "' + JsonEscape(LogoArchivo) + '"';
    Lines[4] := '}';
  end
  else
    Lines[3] := '}';

  // UTF-8: el nombre del hotel puede llevar tildes o ñ, y del otro lado lo lee
  // Node como UTF-8. El BOM que agrega esta función lo descarta brand-store.ts.
  SaveStringsToUTF8File(ExpandConstant('{app}\data\brand\brand.json'), Lines, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // Si ya había un .env (actualización), no se toca -- son los secretos y
    // la configuración real del cliente. Solo se escribe uno nuevo la
    // primera vez que se instala. Lo mismo con la marca: en una actualización
    // el logo y el nombre que ya cargó el hotel se quedan como están.
    if not EsActualizacion then
    begin
      WriteEnvFile;
      WriteBrandFiles;
    end;
  end;
end;
