// Secretos del dispositivo (clave del baúl de sincronización, token de Google).
// En escritorio van al llavero del sistema: Credential Manager en Windows y
// Secret Service en Linux. Nunca se guarda la frase secreta, solo la clave
// derivada. En móvil (Fase 5) se guardan en el almacenamiento privado de la app.

const SERVICE: &str = "io.github.adelledgar.farmhabit";

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[cfg(desktop)]
mod store {
    use super::{err, SERVICE};
    use keyring::{Entry, Error};

    pub fn get(name: &str) -> Result<Option<String>, String> {
        match Entry::new(SERVICE, name).map_err(err)?.get_password() {
            Ok(v) => Ok(Some(v)),
            Err(Error::NoEntry) => Ok(None),
            Err(e) => Err(err(e)),
        }
    }

    pub fn set(name: &str, value: &str) -> Result<(), String> {
        Entry::new(SERVICE, name)
            .map_err(err)?
            .set_password(value)
            .map_err(err)
    }

    pub fn delete(name: &str) -> Result<(), String> {
        match Entry::new(SERVICE, name).map_err(err)?.delete_credential() {
            Ok(()) | Err(Error::NoEntry) => Ok(()),
            Err(e) => Err(err(e)),
        }
    }
}

#[cfg(mobile)]
mod store {
    // TODO(Fase 5): usar el Keystore de Android. De momento, un archivo en el
    // directorio privado de la app (otras apps no pueden leerlo).
    use super::err;
    use std::collections::HashMap;
    use std::sync::OnceLock;

    pub static DIR: OnceLock<std::path::PathBuf> = OnceLock::new();

    fn path() -> Result<std::path::PathBuf, String> {
        Ok(DIR
            .get()
            .ok_or("almacén de secretos no inicializado")?
            .join("secrets.json"))
    }

    fn load() -> Result<HashMap<String, String>, String> {
        match std::fs::read(path()?) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(err),
            Err(_) => Ok(HashMap::new()),
        }
    }

    fn save(map: &HashMap<String, String>) -> Result<(), String> {
        std::fs::write(path()?, serde_json::to_vec(map).map_err(err)?).map_err(err)
    }

    pub fn get(name: &str) -> Result<Option<String>, String> {
        Ok(load()?.get(name).cloned())
    }

    pub fn set(name: &str, value: &str) -> Result<(), String> {
        let mut map = load()?;
        map.insert(name.to_string(), value.to_string());
        save(&map)
    }

    pub fn delete(name: &str) -> Result<(), String> {
        let mut map = load()?;
        map.remove(name);
        save(&map)
    }
}

#[cfg(mobile)]
pub fn init(dir: std::path::PathBuf) {
    let _ = store::DIR.set(dir);
}

#[tauri::command]
pub fn secret_get(name: String) -> Result<Option<String>, String> {
    store::get(&name)
}

#[tauri::command]
pub fn secret_set(name: String, value: String) -> Result<(), String> {
    store::set(&name, &value)
}

#[tauri::command]
pub fn secret_delete(name: String) -> Result<(), String> {
    store::delete(&name)
}

#[cfg(all(test, desktop))]
mod tests {
    use super::store;

    #[test]
    fn guarda_lee_y_borra_en_el_llavero() {
        let name = "test:farmhabit-cargo-test";
        store::delete(name).unwrap();
        assert_eq!(store::get(name).unwrap(), None);
        store::set(name, "valor-secreto").unwrap();
        assert_eq!(store::get(name).unwrap().as_deref(), Some("valor-secreto"));
        store::delete(name).unwrap();
        assert_eq!(store::get(name).unwrap(), None);
    }
}
