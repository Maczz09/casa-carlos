param(
  [ValidateSet('Release', 'Debug')]
  [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$desktopDir = Join-Path $root 'apps\desktop'
$generatedDir = Join-Path $desktopDir 'generated'
$publishDir = Join-Path $desktopDir 'publish'
$dotnet = Join-Path $root 'vendor\dotnet-sdk\dotnet.exe'
$dotnetInstall = Join-Path $env:TEMP 'dotnet-install-hospedaje.ps1'

if (-not (Test-Path $dotnet)) {
  Write-Host 'Descargando SDK de .NET 8 portátil (solo para compilar)...'
  Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $dotnetInstall
  & $dotnetInstall -Channel 8.0 -InstallDir (Split-Path -Parent $dotnet) -NoPath
}

New-Item -ItemType Directory -Force -Path $generatedDir | Out-Null

# El icono se genera de forma determinista para no versionar un binario opaco.
Add-Type -AssemblyName System.Drawing
$bitmap = [System.Drawing.Bitmap]::new(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(15, 45, 75))
$goldBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(217, 164, 65))
$whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
$graphics.FillEllipse($goldBrush, 84, 34, 88, 88)
$font = [System.Drawing.Font]::new('Segoe UI', 70, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$format = [System.Drawing.StringFormat]::new()
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$graphics.DrawString('HC', $font, $whiteBrush, [System.Drawing.RectangleF]::new(0, 102, 256, 126), $format)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath = Join-Path $generatedDir 'HospedajeCarlos.ico'
$stream = [System.IO.File]::Create($iconPath)
$icon.Save($stream)
$stream.Dispose()
$icon.Dispose()
$format.Dispose()
$font.Dispose()
$whiteBrush.Dispose()
$goldBrush.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

if (Test-Path $publishDir) {
  Remove-Item -LiteralPath $publishDir -Recurse -Force
}

Write-Host 'Publicando HospedajeCarlos.exe autocontenido para Windows x64...'
& $dotnet publish (Join-Path $desktopDir 'HospedajeCarlos.Desktop.csproj') `
  --configuration $Configuration `
  --runtime win-x64 `
  --self-contained true `
  --output $publishDir `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -p:DebugType=None `
  -p:DebugSymbols=false

if ($LASTEXITCODE -ne 0) { throw "dotnet publish terminó con código $LASTEXITCODE" }

$exe = Join-Path $publishDir 'HospedajeCarlos.exe'
if (-not (Test-Path $exe)) { throw "No se generó $exe" }
Write-Host "Listo: $exe"
