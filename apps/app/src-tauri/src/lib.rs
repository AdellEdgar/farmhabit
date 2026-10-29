// Punto de entrada compartido por escritorio y Android.
// La lógica de la app vive en TypeScript (packages/core); aquí solo se abre
// la base de datos local, se registran los plugins y, en escritorio, se
// gestiona la bandeja del sistema para que los avisos lleguen con la ventana cerrada.

mod db;
mod oauth;
mod secrets;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Manager, State};

/// Argumento con el que el arranque automático abre la app escondida en la bandeja.
#[cfg(desktop)]
const MINIMIZED_FLAG: &str = "--minimized";

/// Si es true, cerrar la ventana la esconde en la bandeja en vez de salir.
struct CloseToTray(AtomicBool);

#[tauri::command]
fn set_close_to_tray(state: State<'_, CloseToTray>, enabled: bool) {
    state.0.store(enabled, Ordering::Relaxed);
}

#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(desktop)]
fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

    let open = MenuItem::with_id(app, "open", "Abrir FarmHabit", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("FarmHabit")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // Abrir la app otra vez muestra la ventana existente (la que está en la bandeja).
        builder = builder
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                show_main(app)
            }))
            .plugin(tauri_plugin_autostart::init(
                tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                Some(vec![MINIMIZED_FLAG]),
            ))
            // En Android no hay autoactualización: la app solo avisa (ver src/lib/updates.ts).
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(CloseToTray(AtomicBool::new(!cfg!(target_os = "linux"))))
        .manage(oauth::OAuthListener::default())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(db::Db::open(&dir.join("farmhabit.db"))?);
            #[cfg(mobile)]
            secrets::init(dir.clone());

            #[cfg(desktop)]
            {
                setup_tray(app)?;
                // La ventana se crea oculta; solo se muestra si no venimos del arranque automático.
                if !std::env::args().any(|a| a == MINIMIZED_FLAG) {
                    if let Some(window) = app.get_webview_window("main") {
                        window.show()?;
                    }
                }
            }
            #[cfg(mobile)]
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let to_tray = window.state::<CloseToTray>().0.load(Ordering::Relaxed);
                if cfg!(desktop) && to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            db::db_select,
            db::db_execute,
            db::db_transaction,
            oauth::oauth_listen,
            oauth::oauth_wait,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            set_close_to_tray
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar FarmHabit");
}
