// Punto de entrada compartido por escritorio y Android.
// La lógica de la app vive en TypeScript (packages/core); aquí solo se
// registran plugins y, si hiciera falta, algún comando nativo puntual.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error al arrancar FarmHabit");
}
