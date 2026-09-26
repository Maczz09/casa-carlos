$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Get-OfficialPrerequisite {
  param(
    [Parameter(Mandatory)] [string]$Name,
    [Parameter(Mandatory)] [string]$Uri,
    [Parameter(Mandatory)] [string]$Destination
  )

  $destinationDir = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null

  if (-not (Test-Path -LiteralPath $Destination)) {
    Write-Host "Descargando $Name desde Microsoft..."
    Invoke-WebRequest -Uri $Uri -OutFile $Destination
  }

  $signature = Get-AuthenticodeSignature -LiteralPath $Destination
  if (($signature.Status -ne 'Valid') -or ($signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation')) {
    throw "$Name no tiene una firma digital válida de Microsoft. Se canceló la compilación del instalador."
  }
}

& (Join-Path $PSScriptRoot 'build-desktop.ps1')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la aplicación de escritorio.' }

$webViewDir = Join-Path $root 'vendor\webview2'
$webViewSetup = Join-Path $webViewDir 'MicrosoftEdgeWebview2Setup.exe'
$vcRedistSetup = Join-Path $root 'vendor\windows-prerequisites\VC_redist.x64.exe'
$dotNet48Setup = Join-Path $root 'vendor\windows-prerequisites\ndp48-x86-x64-allos-enu.exe'

# El setup final es autocontenido respecto de los runtimes de Windows que usa
# la aplicación. Todos los binarios se descargan desde enlaces oficiales y se
# valida su firma antes de empaquetarlos.
Get-OfficialPrerequisite `
  -Name 'Microsoft Edge WebView2 Runtime' `
  -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' `
  -Destination $webViewSetup
Get-OfficialPrerequisite `
  -Name 'Microsoft Visual C++ Redistributable x64' `
  -Uri 'https://aka.ms/vs/17/release/vc_redist.x64.exe' `
  -Destination $vcRedistSetup
Get-OfficialPrerequisite `
  -Name '.NET Framework 4.8' `
  -Uri 'https://go.microsoft.com/fwlink/?linkid=2088631' `
  -Destination $dotNet48Setup

$portableNode = Join-Path $root 'vendor\node-win-x64\node.exe'
$portableCorepack = Join-Path $root 'vendor\node-win-x64\corepack.cmd'
if ((-not (Test-Path -LiteralPath $portableNode)) -or (-not (Test-Path -LiteralPath $portableCorepack))) {
  throw 'Falta el Node.js portátil en vendor\node-win-x64. El instalador no dependerá de un Node global del cliente.'
}

$isccCandidates = @(
  'C:\Program Files\Inno Setup 7\ISCC.exe',
  'C:\Program Files (x86)\Inno Setup 7\ISCC.exe',
  'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'
)
$iscc = $isccCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'No se encontró ISCC.exe. Instalá Inno Setup 7 y volvé a ejecutar este comando.' }

Write-Host 'Compilando instalador permanente...'
& $iscc (Join-Path $root 'installer\casacarlos.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC terminó con código $LASTEXITCODE" }

$setup = Join-Path $root 'installer\output\HospedajeCarlos-Setup.exe'
if (-not (Test-Path $setup)) { throw "No se generó $setup" }
Write-Host "Listo: $setup"
