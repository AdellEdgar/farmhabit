// Punto de entrada compartido por escritorio y Android.
// La lógica de la app vive en TypeScript (packages/core); aquí solo se abre
// la base de datos local y se registran los comandos nativos.

mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(db::Db::open(&dir.join("farmhabit.db"))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_select,
            db::db_execute,
            db::db_transaction
        ])
        .run(tauri::generate_context!())
        .expect("error al arrancar FarmHabit");
}
