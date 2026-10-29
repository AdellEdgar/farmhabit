// Leer y escribir copias de seguridad (.agx) en la ruta que el usuario elige
// en el diálogo de guardar/abrir. Solo se permiten archivos .agx.

use std::path::Path;

const MAX_BYTES: u64 = 100 * 1024 * 1024;

fn check(path: &str) -> Result<&Path, String> {
    let p = Path::new(path);
    match p.extension().and_then(|e| e.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("agx") => Ok(p),
        _ => Err("Solo se pueden usar archivos .agx".to_string()),
    }
}

#[tauri::command]
pub fn backup_write(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(check(&path)?, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn backup_read(path: String) -> Result<Vec<u8>, String> {
    let p = check(&path)?;
    let size = std::fs::metadata(p).map_err(|e| e.to_string())?.len();
    if size > MAX_BYTES {
        return Err("El archivo es demasiado grande".to_string());
    }
    std::fs::read(p).map_err(|e| e.to_string())
}
