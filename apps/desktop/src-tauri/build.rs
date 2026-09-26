fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["save_export_file"]),
        ),
    )
    .expect("No se pudo generar la política de comandos de Tauri");
}
