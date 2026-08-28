param(
  [ValidateSet('Release', 'Debug')]
  [string]$Configuration = 'Release'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$desktopDir = Join-Path $root 'apps\desktop'
$generatedDir = Join-Path $desktopDir 'generated'
$publishDir = Join-Path $desktopDir 'publish'
$tauriDir = Join-Path $desktopDir 'src-tauri'
$toolRoot = Join-Path $root 'vendor\tauri-toolchain'
$rustupHome = Join-Path $toolRoot 'rustup'
$cargoHome = Join-Path $toolRoot 'cargo'
$cargo = Join-Path $cargoHome 'bin\cargo.exe'
$rustupInit = Join-Path $toolRoot 'rustup-init.exe'
$w64Archive = Join-Path $toolRoot 'w64devkit-x64.exe'
$w64Bin = Join-Path $toolRoot 'w64devkit\bin'
$gcc = Join-Path $w64Bin 'gcc.exe'
$targetDir = Join-Path $env:LOCALAPPDATA 'HospedajeCarlosBuild\tauri-target'

New-Item -ItemType Directory -Force -Path $toolRoot | Out-Null
$env:RUSTUP_HOME = $rustupHome
$env:CARGO_HOME = $cargoHome

if (-not (Test-Path $cargo)) {
  Write-Host 'Descargando Rust portátil para compilar Tauri...'
  Invoke-WebRequest -Uri 'https://win.rustup.rs/x86_64' -OutFile $rustupInit
  & $rustupInit -y --no-modify-path --default-host x86_64-pc-windows-gnu --profile minimal
  if ($LASTEXITCODE -ne 0) { throw "rustup-init terminó con código $LASTEXITCODE" }
}

if (-not (Test-Path $gcc)) {
  Write-Host 'Descargando toolchain C/MinGW portátil para Tauri...'
  Invoke-WebRequest -Uri 'https://github.com/skeeto/w64devkit/releases/download/v2.9.1/w64devkit-x64-2.9.1.7z.exe' -OutFile $w64Archive
  & $w64Archive -y -o"$toolRoot" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "w64devkit terminó con código $LASTEXITCODE" }
}

# Rust GNU espera la biblioteca histórica libgcc_eh.a. w64devkit 2.9.1
# integra esos símbolos en libgcc.a; crear esta copia con el nombre esperado
# permite que rustc enlace sin instalar un segundo MinGW en Windows.
$libgcc = Get-ChildItem (Join-Path $toolRoot 'w64devkit\lib\gcc\x86_64-w64-mingw32') `
  -Recurse -Filter 'libgcc.a' | Select-Object -First 1
if (-not $libgcc) { throw 'No se encontró libgcc.a en el toolchain Tauri.' }
$libgccEh = Join-Path $libgcc.DirectoryName 'libgcc_eh.a'
if (-not (Test-Path $libgccEh)) {
  Copy-Item -LiteralPath $libgcc.FullName -Destination $libgccEh
}

$env:PATH = "$w64Bin;$(Join-Path $cargoHome 'bin');$env:PATH"
$env:CC = $gcc
$env:CXX = Join-Path $w64Bin 'g++.exe'
# `windres` de MinGW no conserva correctamente las comillas de su directorio
# de salida cuando contiene espacios. Cargo puede compilar fuera del repo sin
# alterar las fuentes; esta ruta temporal evita el problema de "Casa Carlos".
$env:CARGO_TARGET_DIR = $targetDir

New-Item -ItemType Directory -Force -Path $generatedDir | Out-Null

# El icono se genera de forma determinista para no versionar un binario opaco.
$iconPath = Join-Path $generatedDir 'HospedajeCarlos.ico'
if (-not (Test-Path $iconPath)) {
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
}

if (Test-Path $publishDir) {
  Remove-Item -LiteralPath $publishDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $publishDir | Out-Null

Write-Host 'Compilando HospedajeCarlos.exe con Tauri v2 para Windows x64...'
$cargoArgs = @('build', '--manifest-path', (Join-Path $tauriDir 'Cargo.toml'), '--target', 'x86_64-pc-windows-gnu')
if ($Configuration -eq 'Release') { $cargoArgs += '--release' }
& $cargo @cargoArgs
if ($LASTEXITCODE -ne 0) { throw "cargo build terminó con código $LASTEXITCODE" }

$profile = if ($Configuration -eq 'Release') { 'release' } else { 'debug' }
$builtExe = Join-Path $targetDir "x86_64-pc-windows-gnu\$profile\HospedajeCarlos.exe"
if (-not (Test-Path $builtExe)) { throw "No se generó $builtExe" }
Copy-Item -LiteralPath $builtExe -Destination (Join-Path $publishDir 'HospedajeCarlos.exe') -Force
$webViewLoader = Join-Path $targetDir "x86_64-pc-windows-gnu\$profile\WebView2Loader.dll"
if (-not (Test-Path $webViewLoader)) { throw "No se generó $webViewLoader" }
Copy-Item -LiteralPath $webViewLoader -Destination (Join-Path $publishDir 'WebView2Loader.dll') -Force

$exe = Join-Path $publishDir 'HospedajeCarlos.exe'
if (-not (Test-Path $exe)) { throw "No se generó $exe" }
Write-Host "Listo: $exe"
