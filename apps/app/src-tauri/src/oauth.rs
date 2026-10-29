// Inicio de sesión con Google para apps de escritorio ("loopback"): la app
// escucha en 127.0.0.1 en un puerto libre, abre el navegador con la página de
// Google y Google redirige aquí con el código de autorización.
// Ver https://developers.google.com/identity/protocols/oauth2/native-app

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::State;

#[derive(Default)]
pub struct OAuthListener(Mutex<Option<TcpListener>>);

const PAGE: &str = "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><title>FarmHabit</title>\
<body style=\"font-family:system-ui;background:#101318;color:#e8ecf1;display:grid;place-items:center;height:100vh;margin:0\">\
<div style=\"text-align:center\"><p style=\"font-size:48px;margin:0\">🐔</p><h1>Listo</h1>\
<p>Ya puedes cerrar esta pestaña y volver a FarmHabit.</p></div></body></html>";

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Abre el puerto local y devuelve su número (para la redirect_uri).
#[tauri::command]
pub fn oauth_listen(state: State<'_, OAuthListener>) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(err)?;
    let port = listener.local_addr().map_err(err)?.port();
    *state.0.lock().map_err(err)? = Some(listener);
    Ok(port)
}

/// Espera (máx. 5 min) la redirección de Google y devuelve su query string.
#[tauri::command]
pub async fn oauth_wait(state: State<'_, OAuthListener>) -> Result<String, String> {
    let listener = state
        .0
        .lock()
        .map_err(err)?
        .take()
        .ok_or("No se ha iniciado el inicio de sesión")?;
    tauri::async_runtime::spawn_blocking(move || {
        wait_for_redirect(listener, Duration::from_secs(300))
    })
    .await
    .map_err(err)?
}

/// Acepta conexiones hasta recibir una petición con query string y la devuelve.
fn wait_for_redirect(listener: TcpListener, timeout: Duration) -> Result<String, String> {
    listener.set_nonblocking(true).map_err(err)?;
    let deadline = Instant::now() + timeout;
    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                stream.set_nonblocking(false).map_err(err)?;
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .map_err(err)?;
                let mut buf = [0u8; 8192];
                let n = stream.read(&mut buf).map_err(err)?;
                let request = String::from_utf8_lossy(&buf[..n]);
                // Primera línea: "GET /?code=...&state=... HTTP/1.1"
                let target = request.split_whitespace().nth(1).unwrap_or("");
                let Some((_, query)) = target.split_once('?') else {
                    // Peticiones sin query (p. ej. /favicon.ico): seguir esperando.
                    let _ =
                        stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
                    continue;
                };
                let body = PAGE.as_bytes();
                let head = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    );
                let _ = stream.write_all(head.as_bytes());
                let _ = stream.write_all(body);
                return Ok(query.to_string());
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() > deadline {
                    return Err("Se agotó el tiempo para iniciar sesión".to_string());
                }
                std::thread::sleep(Duration::from_millis(150));
            }
            Err(e) => return Err(err(e)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpStream;

    #[test]
    fn devuelve_la_query_de_la_redireccion_e_ignora_otras_peticiones() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let client = std::thread::spawn(move || {
            let mut favicon = TcpStream::connect(("127.0.0.1", port)).unwrap();
            favicon
                .write_all(b"GET /favicon.ico HTTP/1.1\r\n\r\n")
                .unwrap();
            let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
            s.write_all(b"GET /?state=abc&code=4%2F0xyz HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
                .unwrap();
            let mut response = String::new();
            s.read_to_string(&mut response).unwrap();
            response
        });
        let query = wait_for_redirect(listener, Duration::from_secs(10)).unwrap();
        assert_eq!(query, "state=abc&code=4%2F0xyz");
        assert!(client.join().unwrap().contains("Ya puedes cerrar"));
    }

    #[test]
    fn se_rinde_si_no_llega_nada() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        assert!(wait_for_redirect(listener, Duration::from_millis(300)).is_err());
    }
}
