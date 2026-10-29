# 🐔 FarmHabit

**Tareas, hábitos y notas en una sola app, con una granja que depende de ti.**

FarmHabit es una app de productividad personal _local-first_ para **Windows, Linux y Android**. Cada hábito que cumples hace crecer tu granja; si los descuidas, tus animales enferman… y pueden morir para siempre.

Tus datos se guardan en tu dispositivo, sin cuentas propias ni servidores. Si quieres usarla en varios dispositivos, se sincronizan cifrados a través de tu Google Drive.

> 🚧 **En desarrollo.** Funcionan las tareas, los hábitos, las notas, los avisos y la sincronización. La granja visual, las notas privadas y las estadísticas llegan en la siguiente fase. La interfaz está en español.

## Qué puedes hacer

### ✅ Tareas

- Prioridad (alta, media, baja), etiquetas de colores, fecha límite y hora.
- Tareas que se repiten: cada día, ciertos días de la semana, cada mes, el último día del mes…
- **Varios avisos por tarea**: 1 semana antes, 1 día antes, 1 hora antes, a la hora…
- Vistas **Hoy**, **Próximas**, **Todas** y **Completadas**; orden por fecha o _inteligente_, que combina urgencia y prioridad.

### 🔁 Hábitos

- Frecuencias: cada día, días concretos, N veces por semana o por mes, cada N días.
- Hábitos con **cantidad** (2 L de agua, 8000 pasos) y puntos parciales.
- Marcar como **saltado** (no rompe la racha), rachas y recordatorios configurables.
- Orden manual por importancia.

### 🐔 La granja

- Cada hábito tiene una **importancia** del 1 al 5. Hacerlo suma `10 × importancia` puntos; no hacerlo resta `10 × (6 − importancia)`. **Fallar lo fácil penaliza más.**
- La **XP** solo sube y hace crecer la granja de nivel. El **bienestar** sube o baja cada día según cuánto cumples.
- Con el bienestar bajo, los animales **enferman** y, tras 3 días malos, **mueren** (te avisa antes, con su nombre). Curarlos exige 2 días buenos seguidos.
- Reglas contra trampas: solo se puede apuntar hoy y ayer, los hábitos recién creados no cuentan para recuperar y borrar un hábito no borra sus penalizaciones.
- **Modo vacaciones**, activado por adelantado (el motor ya lo aplica; el botón llega con la granja visual).

### 📝 Notas

- Editor visual (títulos, listas, casillas, citas, código), carpetas, etiquetas, notas fijadas y buscador que ignora acentos.

### 🔔 Avisos

- Notificaciones del sistema para tareas, hábitos y la granja.
- En escritorio, la app puede quedarse en la **bandeja del sistema** y **arrancar con el ordenador**. En Android, los avisos se programan con antelación.

### ☁️ Sincronización y copias

- **Sincronización automática con Google Drive.** Usa una carpeta oculta, solo de la app, y los datos se **cifran en tu dispositivo** con tu frase secreta: Google no puede leerlos.
- **Copias de seguridad** en un archivo `.agx` cifrado con contraseña. Al importarlas se fusionan con tus datos sin perder nada.

## Descargar

Cada vez que se sube código a `main`, GitHub Actions compila la app. Los instaladores están en la pestaña **[Actions](../../actions)**: entra en la última ejecución correcta y baja el _artifact_ que quieras.

| Plataforma    | Archivo                         | Notas                                                                                                                       |
| ------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 | `FarmHabit_x.y.z_x64-setup.exe` | Sin firma digital: Windows mostrará "SmartScreen: aplicación desconocida" → _Más información_ → _Ejecutar de todas formas_. |
| Linux         | `.AppImage` o `.deb`            | AppImage: `chmod +x FarmHabit*.AppImage` y ejecutar. El `.deb` instala las dependencias solo.                               |
| Android       | `.apk`                          | Permite "instalar apps de origen desconocido". Por ahora es una versión de depuración.                                      |

Las descargas en _Releases_ llegarán en la fase de publicación.

## Privacidad y seguridad

- **Sin servidores propios ni cuentas de FarmHabit.** La base de datos (SQLite) vive en tu dispositivo.
- **Cifrado con [libsodium](https://doc.libsodium.org/):** Argon2id para derivar claves y XChaCha20-Poly1305 para cifrar. No hay criptografía casera.
- **La frase secreta y las contraseñas nunca se guardan.** Para sincronizar se guarda solo la clave derivada, en el llavero del sistema (Credential Manager en Windows, Secret Service en Linux).
- **Acceso mínimo a Google Drive** (`drive.appdata`): solo la carpeta de la app, no el resto de tus archivos.

## Desarrollo

**Requisitos:** Node 22.13+, pnpm 10, Rust (rustup) y:

- **en Windows**, las Build Tools de C++ de Visual Studio;
- **en Linux**, `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev` (ver los [requisitos de Tauri](https://v2.tauri.app/start/prerequisites/)).

```bash
pnpm install
pnpm dev          # app de escritorio en modo desarrollo
pnpm dev:web      # solo la interfaz, en el navegador (http://localhost:1420)
pnpm check        # tipos + lint + formato + tests
pnpm build        # instalador de tu sistema
```

La sincronización necesita credenciales de Google propias: sigue [docs/google-drive.md](docs/google-drive.md). Sin ellas, todo lo demás funciona.

### Arquitectura

```
packages/core/   Núcleo en TypeScript, sin interfaz: modelo, SQLite, motor de la granja,
                 cifrado, formato .agx, fusión y sincronización. ~150 tests (Vitest + fast-check).
apps/app/        Interfaz en React 19 + Tailwind 4, empaquetada con Tauri 2.
  src-tauri/     Rust mínimo: SQLite nativo con transacciones atómicas, llavero del sistema,
                 inicio de sesión con Google y bandeja del sistema.
```

- **Local-first con fusión determinista:** cada elemento tiene UUID, `updatedAt` y marca de borrado. Al sincronizar gana el cambio más reciente; la fusión es conmutativa, asociativa e idempotente, y lo comprueban tests de propiedades.
- **La granja se calcula, no se guarda:** el estado sale de reproducir el historial de hábitos día a día, así todos los dispositivos ven exactamente la misma granja.

Las decisiones de diseño, el formato del archivo y todas las reglas del juego están en [CLAUDE.md](CLAUDE.md).

## Hoja de ruta

- [x] Núcleo, base de datos, cifrado y fusión
- [x] Interfaz: Hoy, Tareas, Hábitos, Notas, Ajustes
- [x] Avisos, bandeja del sistema y arranque automático
- [x] Sincronización con Google Drive y copias de seguridad
- [x] Linux y Android (compilación en GitHub Actions)
- [ ] Granja visual con tienda y logros, notas privadas, estadísticas y temas editables
- [ ] Calendario y suscripción a calendarios `.ics`
- [ ] Publicación con Releases

## Licencia

[MIT](LICENSE) © 2026 AdellEdgar
