fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "save_export_file",
                "move_to_screen",
                "move_to_secondary_screen",
                "get_screens_info",
            ]),
        ),
    )
    .expect("No se pudo generar la política de comandos de Tauri");
}
