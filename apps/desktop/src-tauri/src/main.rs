#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use fs2::FileExt;
use std::{
    env,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream},
    path::PathBuf,
    process::{Command, Stdio},
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    thread,
    time::Duration,
};
use tauri::{
    Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    webview::NewWindowResponse,
};
use url::Url;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Clone, Copy, Debug)]
enum Mode {
    Reception,
    Kiosk,
}

impl Mode {
    fn from_args(args: &[String]) -> Self {
        if args.iter().any(|argument| argument.eq_ignore_ascii_case("--kiosk")) {
            Self::Kiosk
        } else {
            Self::Reception
        }
    }

    fn lock_name(self) -> &'static str {
        match self {
            Self::Reception => "desktop-reception.lock",
            Self::Kiosk => "desktop-kiosk.lock",
        }
    }

    fn title(self) -> &'static str {
        match self {
            Self::Reception => "Hospedaje Carlos — Recepción",
            Self::Kiosk => "Hospedaje Carlos — Kiosco",
        }
    }

    fn loading_label(self) -> &'static str {
        match self {
            Self::Reception => "SISTEMA DE RECEPCIÓN",
            Self::Kiosk => "PANTALLA DEL CLIENTE",
        }
    }

    fn profile_name(self) -> &'static str {
        match self {
            Self::Reception => "Reception",
            Self::Kiosk => "Kiosk",
        }
    }
}

#[derive(Clone)]
struct ServerConfig {
    start_url: Url,
    port: u16,
}

impl ServerConfig {
    fn from_args(args: &[String], mode: Mode) -> Result<Self, String> {
        let configured = args
            .iter()
            .find_map(|argument| argument.strip_prefix("--url="))
            .map(ToOwned::to_owned)
            .or_else(|| env::var("HOSPEDAJE_CARLOS_URL").ok())
            .unwrap_or_else(|| "http://127.0.0.1:4000/".to_owned());

        let mut base_url = Url::parse(&configured)
            .map_err(|_| "La dirección del servidor no es válida.".to_owned())?;
        let host = base_url.host_str().unwrap_or_default();
        if base_url.scheme() != "http" || (host != "127.0.0.1" && host != "localhost") {
            return Err("La dirección debe apuntar a localhost o 127.0.0.1.".to_owned());
        }
        if base_url.port_or_known_default().is_none() {
            return Err("La dirección del servidor necesita un puerto.".to_owned());
        }
        base_url.set_path("/");
        base_url.set_query(None);
        base_url.set_fragment(None);

        let start_url = base_url
            .join(if matches!(mode, Mode::Kiosk) { "kiosk/" } else { "" })
            .map_err(|_| "No se pudo construir la dirección de inicio.".to_owned())?;
        let port = base_url.port_or_known_default().unwrap_or(4000);

        Ok(Self { start_url, port })
    }

    fn allows(&self, url: &Url) -> bool {
        match url.scheme() {
            "tauri" | "about" | "data" | "blob" => true,
            "http" => {
                matches!(url.host_str(), Some("127.0.0.1" | "localhost"))
                    && url.port_or_known_default() == Some(self.port)
            }
            _ => false,
        }
    }
}

fn app_data_dir() -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(env::temp_dir)
        .join("HospedajeCarlos")
}

fn write_log(message: impl AsRef<str>) {
    let directory = app_data_dir();
    if fs::create_dir_all(&directory).is_err() {
        return;
    }
    let path = directory.join("desktop.log");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{:?} {}", std::time::SystemTime::now(), message.as_ref());
    }
}

fn acquire_instance_lock(mode: Mode) -> Option<File> {
    let directory = app_data_dir();
    fs::create_dir_all(&directory).ok()?;
    let lock = OpenOptions::new()
        .create(true)
        .read(true)
        .write(true)
        .open(directory.join(mode.lock_name()))
        .ok()?;
    lock.try_lock_exclusive().ok()?;
    Some(lock)
}

fn test_exit_after(args: &[String]) -> Option<u64> {
    args.iter()
        .find_map(|argument| argument.strip_prefix("--test-exit-after="))
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|seconds| *seconds > 0)
}

fn should_test_popup(args: &[String]) -> bool {
    args.iter().any(|argument| argument == "--test-popup")
}

fn server_is_ready(port: u16) -> bool {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), port);
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(700)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(900)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(900)));
    if stream
        .write_all(b"GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut response = [0_u8; 96];
    let Ok(read) = stream.read(&mut response) else {
        return false;
    };
    let status = String::from_utf8_lossy(&response[..read]);
    status.starts_with("HTTP/1.1 200") || status.starts_with("HTTP/1.0 200")
}

fn try_start_service() {
    let mut command = Command::new("sc.exe");
    command
        .args(["start", "casacarlos.exe"])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    match command.spawn() {
        Ok(mut child) => {
            let _ = child.wait();
        }
        Err(error) => write_log(format!("No se pudo solicitar el inicio del servicio: {error}")),
    }
}

fn update_loading_status(window: &WebviewWindow, message: &str) -> bool {
    let escaped = message.replace('\\', "\\\\").replace('"', "\\\"");
    window
        .eval(format!("window.setStartupStatus(\"{escaped}\")"))
        .is_ok()
}

fn wait_for_server(window: WebviewWindow, server: ServerConfig, test_popup: bool) {
    thread::spawn(move || {
        let mut attempt = 0_u32;
        loop {
            attempt += 1;
            if server_is_ready(server.port) {
                write_log(format!("Servidor disponible después de {attempt} intento(s)."));
                if let Err(error) = window.navigate(server.start_url.clone()) {
                    write_log(format!("No se pudo navegar a la aplicación: {error}"));
                }
                if test_popup {
                    thread::sleep(Duration::from_secs(2));
                    let _ = window.eval(
                        "window.open('about:blank','_blank','width=420,height=640')",
                    );
                }
                break;
            }

            if attempt == 1 || attempt % 30 == 0 {
                try_start_service();
            }

            let message = if attempt <= 45 {
                format!("Esperando al servicio del hotel… ({attempt}/45)")
            } else {
                "El servicio aún no responde. Reintentando automáticamente…".to_owned()
            };
            if !update_loading_status(&window, &message) {
                break;
            }
            thread::sleep(Duration::from_secs(if attempt <= 45 { 1 } else { 3 }));
        }
    });
}

fn webview_profile(mode: Mode) -> PathBuf {
    app_data_dir().join("WebView2").join("Tauri").join(mode.profile_name())
}

fn internal_navigation(server: &ServerConfig, url: &Url) -> bool {
    server.allows(url)
}

fn build_main_window(
    app: &tauri::App,
    mode: Mode,
    server: ServerConfig,
) -> tauri::Result<WebviewWindow> {
    let navigation_server = server.clone();
    let popup_server = server.clone();
    let popup_handle = app.handle().clone();
    let popup_counter = Arc::new(AtomicU64::new(1));
    let popup_counter_for_handler = Arc::clone(&popup_counter);

    let mut builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title(mode.title())
        .maximized(true)
        .min_inner_size(1050.0, 700.0)
        .data_directory(webview_profile(mode))
        .devtools(false)
        .zoom_hotkeys_enabled(false)
        .initialization_script(
            "document.addEventListener('contextmenu',event=>event.preventDefault());\
             document.addEventListener('keydown',event=>{if(event.key==='F12'){event.preventDefault();}});",
        )
        .on_navigation(move |url| internal_navigation(&navigation_server, url))
        .on_new_window(move |url, features| {
            if !popup_server.allows(&url) {
                write_log(format!("Ventana externa bloqueada: {url}"));
                return NewWindowResponse::Deny;
            }

            let label = format!(
                "comprobante-{}",
                popup_counter_for_handler.fetch_add(1, Ordering::Relaxed)
            );
            let popup_navigation_server = popup_server.clone();
            let popup = WebviewWindowBuilder::new(
                &popup_handle,
                label,
                WebviewUrl::External("about:blank".parse().expect("about:blank válido")),
            )
            .window_features(features)
            .title("Hospedaje Carlos — Comprobante")
            .inner_size(470.0, 760.0)
            .min_inner_size(380.0, 560.0)
            .center()
            .devtools(false)
            .zoom_hotkeys_enabled(false)
            .on_navigation(move |popup_url| {
                internal_navigation(&popup_navigation_server, popup_url)
            })
            .on_document_title_changed(|window, title| {
                if !title.trim().is_empty() {
                    let _ = window.set_title(&title);
                }
            })
            .build();

            match popup {
                Ok(window) => {
                    write_log("Ventana de comprobante creada correctamente.");
                    NewWindowResponse::Create { window }
                }
                Err(error) => {
                    write_log(format!("No se pudo abrir la ventana de comprobante: {error}"));
                    NewWindowResponse::Deny
                }
            }
        });

    if matches!(mode, Mode::Kiosk) {
        builder = builder
            .fullscreen(true)
            .decorations(false)
            .min_inner_size(800.0, 600.0);
    }

    builder.build()
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    let mode = Mode::from_args(&args);
    let server = ServerConfig::from_args(&args, mode)?;
    let Some(instance_lock) = acquire_instance_lock(mode) else {
        write_log(format!("Se bloqueó una segunda instancia en modo {mode:?}."));
        return Ok(());
    };
    write_log(format!("Inicio Tauri. Modo={mode:?}; URL={}", server.start_url));

    let exit_after = test_exit_after(&args);
    let test_popup = should_test_popup(&args);
    tauri::Builder::default()
        .setup(move |app| {
            app.manage(instance_lock);
            let window = build_main_window(app, mode, server.clone())?;
            let label = mode.loading_label().replace('\\', "\\\\").replace('"', "\\\"");
            let _ = window.eval(format!("window.setDesktopMode(\"{label}\")"));
            wait_for_server(window, server.clone(), test_popup);

            if let Some(seconds) = exit_after {
                let handle = app.handle().clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_secs(seconds));
                    handle.exit(0);
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .map_err(|error| format!("No se pudo ejecutar Hospedaje Carlos: {error}"))?;
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        write_log(&error);
        show_error(&error);
    }
}

#[cfg(windows)]
fn show_error(message: &str) {
    let title: Vec<u16> = "Hospedaje Carlos\0".encode_utf16().collect();
    let body: Vec<u16> = format!("{message}\0").encode_utf16().collect();
    unsafe {
        MessageBoxW(std::ptr::null_mut(), body.as_ptr(), title.as_ptr(), 0x10);
    }
}

#[cfg(not(windows))]
fn show_error(message: &str) {
    eprintln!("{message}");
}

#[cfg(windows)]
#[link(name = "user32")]
unsafe extern "system" {
    fn MessageBoxW(
        window: *mut std::ffi::c_void,
        text: *const u16,
        caption: *const u16,
        kind: u32,
    ) -> i32;
}
