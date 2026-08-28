$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot 'build-desktop.ps1')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la aplicación de escritorio.' }

$webViewDir = Join-Path $root 'vendor\webview2'
$webViewSetup = Join-Path $webViewDir 'MicrosoftEdgeWebview2Setup.exe'
if (-not (Test-Path $webViewSetup)) {
  New-Item -ItemType Directory -Force -Path $webViewDir | Out-Null
  Write-Host 'Descargando instalador oficial de WebView2...'
  try {
    Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile $webViewSetup
  }
  catch {
    Write-Warning 'No se pudo descargar WebView2. El instalador se compilará sin el bootstrapper; Windows 10/11 normalmente ya lo incluye.'
  }
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
