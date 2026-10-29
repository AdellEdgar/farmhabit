# FarmHabit: guía del proyecto

App personal **local-first** de productividad: tareas, hábitos con una **granja de animales** como sistema de motivación, notas (con notas privadas cifradas) y calendario. Plataformas: **Windows, Linux y Android**. Interfaz en **español**.

El repositorio es **público** (portfolio). Cualquiera puede instalar la app y usarla con sus propios datos: los datos nunca están en el repo.

## Reglas de trabajo

- Se trabaja por fases, **un commit por fase** (ver "Fases"). No adelantar trabajo de fases futuras sin acordarlo.
- **Los commits y los push los hace el usuario.** Al terminar una fase, Claude deja los cambios sin commitear y le da los comandos y el mensaje de commit.
- Antes de cerrar una fase: `pnpm check` (typecheck + lint + formato + tests) tiene que pasar.
- Idioma: **interfaz y documentación en español**. Identificadores de código en inglés. Comentarios en español, solo cuando aportan.
- Mantener este archivo al día cuando cambie una decisión de arquitectura, el formato del archivo, las reglas del juego o las de seguridad.

## Stack

| Pieza           | Elección                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Lenguaje        | TypeScript 6 (strict)                                                                                           |
| UI              | React 19 + Vite 8 + Tailwind 4 (+ Radix UI desde la Fase 2)                                                     |
| Contenedor      | Tauri 2: Windows, Linux (AppImage/.deb) y Android desde el mismo proyecto. Plan B para Android: Capacitor       |
| Base de datos   | SQLite: `rusqlite` (bundled) con comandos propios en la app, `sql.js` en `pnpm dev:web`, `node:sqlite` en tests |
| Cripto          | libsodium (`libsodium-wrappers-sumo`): Argon2id + XChaCha20-Poly1305                                            |
| Validación      | zod                                                                                                             |
| Editor de notas | TipTap                                                                                                          |
| Recurrencias    | RRULE (RFC 5545), librería `rrule`                                                                              |
| Gráficas        | Recharts                                                                                                        |
| Tests           | Vitest + fast-check                                                                                             |
| Monorepo        | pnpm workspaces                                                                                                 |

Rust se usa lo mínimo: arranque de Tauri, plugins y algún comando nativo puntual.

## Estructura

```
packages/core/        Núcleo SIN UI ni dependencias de plataforma (lo vigila ESLint)
  src/model/          tipos + esquemas zod
  src/db/             SqlDriver (interfaz), migraciones, repositorios
  src/domain/         funciones puras: orden de tareas, recurrencias, frecuencias, rachas, avisos
  src/services/       operaciones sobre la BD (completar tarea, registrar hábito, reordenar…)
  src/game/           motor de la granja + config de reglas (game-rules.ts)
  src/crypto/         envoltorio de libsodium
  src/sync/           formato .agx, migraciones de formato, fusión
  src/util/           reloj monotónico, UUID, fechas locales
apps/app/             React + src-tauri (Windows, Linux, Android)
  src/lib/            drivers SQLite, contexto de datos (AppProvider/useApp), formato de fechas, tema, atajos
  src/components/     componentes base (ui.tsx)
  src/features/       una carpeta por sección: today, tasks, habits, notes, farm, settings
  src-tauri/src/db.rs comandos db_select, db_execute y db_transaction
```

**Datos en la UI:** `AppProvider` abre la BD, carga todas las colecciones en memoria y calcula la granja con `computeFarm`. Toda escritura pasa por `mutate(fn)`, que ejecuta el cambio, recarga los datos y muestra los errores en un aviso. Con volúmenes personales (miles de elementos) recargar todo es instantáneo.

**Regla de oro:** el núcleo no importa React, Tauri ni nada del DOM. La plataforma se le inyecta mediante interfaces (`SqlDriver`, almacén de claves, notificador). Así se prueba en Node y se reutiliza tal cual en Android.

**SQLite nativo:** no se usa `plugin-sql`, porque su pool de conexiones no garantiza transacciones atómicas. `src-tauri/src/db.rs` mantiene una única conexión `rusqlite` tras un `Mutex` y `db_transaction` ejecuta todas las sentencias en una transacción real. La BD vive en el directorio de datos de la app (`%APPDATA%\io.github.adelledgar.farmhabit\farmhabit.db` en Windows), en modo WAL.

**Avisos (Fase 3):** `remindersBetween` (núcleo, `domain/reminders.ts`) devuelve los avisos de tareas y hábitos con instante en `(from, to]`. No avisa de tareas completadas ni de hábitos ya hechos, saltados o con el objetivo del periodo cumplido. `ReminderScheduler` (app) comprueba cada 20 s desde `meta.reminders:lastCheck`, así nada se repite al reiniciar. Recupera como mucho 12 h de avisos perdidos y agrupa en uno solo si hay más de 3. A las 20:00 avisa si hay `deathWarning`. Preferencias del dispositivo en `meta`: `reminders:enabled`, `closeToTray`.

**Bandeja y arranque (escritorio):** la ventana se crea oculta (`visible: false`) y Rust la muestra salvo con `--minimized`, que es el argumento del autoarranque (`tauri-plugin-autostart`). Cerrar la ventana la esconde en la bandeja (comando `set_close_to_tray`); para salir, "Salir" en el menú del icono. `tauri-plugin-single-instance` hace que abrir la app otra vez muestre la ventana existente. En Android (Fase 5) habrá que programar las notificaciones con antelación, porque la app no sigue viva en segundo plano.

**Modo navegador (`pnpm dev:web`):** sin Tauri se usa SQLite en WebAssembly (`sql.js`), con los datos en `localStorage` de ese navegador. Solo sirve para desarrollar y probar la interfaz.

## Modelo de datos

Toda tabla sincronizable tiene: `id` (UUID), `created_at`, `updated_at`, `deleted_at` (tombstone). Instantes en **ms UTC**; fechas del usuario en **hora local de pared** (`YYYY-MM-DD`, `HH:mm`).

- `tags`: nombre y color.
- `tasks`: título, notas, prioridad (1 alta, 2 media, 3 baja), estado (`pending`/`done`), `due_date`, `due_time`, `rrule`, `reminders` (JSON, p. ej. `[{offsetMin:1440},{offsetMin:60}]`), `tag_ids` (JSON), `completed_at`.
- `task_completions`: historial de tareas recurrentes. id = UUIDv5(tarea + fecha de ocurrencia). Al completar una recurrente se registra aquí y la fecha avanza a la siguiente ocurrencia.
- `habits`: nombre, descripción, icono, color, `sort_key` (índice fraccional), `start_date`, `reminders` (JSON `[{time, days}]`), `archived_at` y `config_history` (JSON): lista de `{since, effort (1–5), schedule, target}`. `schedule` es `daily`, `weekdays{days}`, `timesPerWeek{times}`, `timesPerMonth{times}` o `everyNDays{interval}`; `target` es `{quantity, unit}` o null. Un cambio de configuración se añade con `since` = mañana (o reemplaza si el hábito empieza hoy), para no reescribir el pasado.
- `habit_logs`: id = UUIDv5(hábito + fecha), `date`, `status` (`done`/`skipped`), `value` (cantidad o null). Desmarcar = tombstone.
- `note_folders`: nombre, `parent_id`, `sort_key`.
- `notes`: `folder_id`, título, contenido (JSON de TipTap), texto plano para buscar, `tag_ids`, `pinned`, `is_private`, `private_blob`.
- `animals`: nombre (lo elige el usuario), especie, `acquired_on`, origen (`starter`/`bought`/`born`) y precio. La muerte **no** se guarda: la calcula el motor. Las crías tienen id = UUIDv5(padre + fecha); si el usuario les pone nombre se guarda una fila con ese id.
- `vacations`: `start_date`, `end_date`. Solo protegen los días posteriores al día en que se crearon.
- `settings`: clave y valor (sincronizados). Lo que es solo del dispositivo (p. ej. el tema elegido) va en `meta`.
- Locales (no se sincronizan): `meta` (deviceId, versión de esquema, `lastClock`, `lastSync:<deviceId>`, `theme`) y caché de eventos de calendario. El buscador de notas filtra en memoria sin distinguir acentos ni mayúsculas; si hiciera falta se añadirá un índice FTS5.

`updated_at` es monotónico por dispositivo: `max(ahora, último + 1)`, persistido en `meta.lastClock` en la misma transacción que cada escritura; tras importar, el reloj avanza hasta la marca más alta importada. Los tombstones no se purgan, y al borrar tareas y notas se vacía su contenido. Las migraciones del esquema son SQL congelado (`db/migrations.ts`): nunca se editan, se añade una nueva.

## Sincronización y fusión

- **Copia de seguridad:** exportar o importar un archivo `.agx` cifrado con una contraseña (Argon2id por archivo). Al importar se fusiona.
- **Sincronización automática con Google Drive** (`appDataFolder`, scope `drive.appdata`: carpeta oculta, solo para la app). Se descartó Syncthing porque el usuario tiene iPhone y Syncthing no tiene app oficial en iOS.
  - **Baúl:** `farmhabit-vault.json` guarda la sal de Argon2id, los parámetros y una comprobación cifrada (`sync/vault.ts`). El primer dispositivo lo crea con una **frase secreta**; los demás se unen con la misma frase. La clave derivada se guarda en el llavero del sistema, y los archivos de sincronización usan `kdf: {alg: "vault", vaultId}` en la cabecera.
  - **Un archivo por dispositivo:** `farmhabit-<deviceId>.agx`. Cada uno escribe solo el suyo y lee los demás, así no hay conflictos de archivo (`syncWithRemote` en `sync/service.ts`). No se vuelven a leer los archivos cuyo `modifiedAt` no ha cambiado (`meta.sync:seen:<archivo>`) y no se sube nada si el reloj local no ha avanzado (`meta.sync:lastUploadClock`).
  - **Almacenamiento intercambiable:** `RemoteStore` (list/read/write) se implementa con `DriveStore` (`apps/app/src/lib/google-drive.ts`); en los tests, con `MemoryStore`. Añadir otro proveedor (carpeta local, WebDAV…) es implementar esa interfaz.
  - **Cuándo:** al abrir la app, cada 5 minutos y 15 s después de un cambio local (`SyncProvider`).
  - **Inicio de sesión:** OAuth para apps instaladas con PKCE y redirección a `127.0.0.1:<puerto>` (`src-tauri/src/oauth.rs`). Credenciales en `apps/app/.env` (no se sube; guía en `docs/google-drive.md`). Las llamadas HTTP a Google pasan por `tauri-plugin-http`, limitado a `oauth2.googleapis.com` y `www.googleapis.com`.
- **Fusión por elemento:** gana el `updated_at` mayor; si hay empate, gana el tombstone; si sigue el empate, gana el JSON canónico mayor (determinista). Una copia antigua nunca resucita algo borrado; una edición posterior a un borrado sí lo resucita.
- **Notas:** si ambas versiones cambiaron desde la última sincronización con ese dispositivo (`meta.lastSync:<deviceId>`), la perdedora se conserva como "Título (conflicto)" con id = UUIDv5(nota + updatedAt perdedora), así los dos dispositivos crean la misma copia.
- **Limitación aceptada:** las cantidades de hábitos editadas en dos dispositivos antes de sincronizar se quedan con el último valor.
- Propiedades exigidas a `merge`: conmutativa, idempotente, asociativa (tests con fast-check). Se avisa si llegan marcas de tiempo más de 5 min en el futuro.

## Formato del archivo `.agx` (formatVersion 1)

```
[4 B]  magic "AGX1"
[4 B]  longitud de la cabecera (uint32 LE)
[N B]  cabecera JSON UTF-8
[resto] ciphertext XChaCha20-Poly1305 (tag de 16 B incluido)
```

Cabecera: `format: "farmhabit-export"`, `formatVersion`, `createdAt`, `deviceId`, `kdf {alg: "argon2id13", opsLimit: 3, memLimitBytes: 67108864, salt}`, `aead {alg: "xchacha20poly1305-ietf", nonce}`, `compression: "none"`.

- **AAD = los bytes exactos del magic + longitud + cabecera.** Tocar la cabecera hace fallar el descifrado.
- Salt (16 B) y nonce (24 B) nuevos en cada exportación.
- Contenido descifrado (validado con zod): `{formatVersion, schemaVersion, exportedAt, sourceDeviceId, collections: {...}, privateVault}`. Las colecciones van por nombre, así que añadir colecciones no rompe el formato.
- Migraciones de formato encadenadas: `migrations[v](payload_v) → payload_v+1`. Un archivo con una versión más nueva que la app se rechaza.
- Errores: `InvalidFileError`, `UnsupportedVersionError`, `DecryptionError` ("Contraseña incorrecta o archivo dañado": el cifrado autenticado no permite distinguir los dos casos), `PayloadValidationError` y `PasswordTooShortError` (mínimo 8 caracteres al exportar).
- Al leer, se rechazan cabeceras de más de 64 KB y parámetros de Argon2id fuera de rango (1–20 pasadas, 8 KB–1 GB), para que un archivo malicioso no agote la memoria.

## Reglas de seguridad

- **No inventar criptografía.** Solo primitivas de libsodium.
- Las contraseñas (maestra y de notas privadas) **nunca** se guardan en disco, `localStorage` ni logs, y no aparecen en mensajes de error.
- Para la sincronización automática se guarda la **clave derivada** del baúl (nunca la frase secreta) y el refresh token de Google en el llavero del sistema, con el crate `keyring` (`src-tauri/src/secrets.rs`): Credential Manager en Windows, Secret Service en Linux. En Android, de momento, en un archivo del directorio privado de la app (pendiente: Keystore).
- Los archivos de copia solo se leen y escriben con extensión `.agx` y hasta 100 MB (`src-tauri/src/files.rs`), en la ruta que el usuario elige en el diálogo.
- Notas privadas: una clave aleatoria (DEK) cifra `{título, cuerpo}`. Esa DEK está envuelta con Argon2id(contraseña de notas privadas) y viaja en `privateVault`. En el archivo exportado van doblemente cifradas.
- Las claves se manejan como `Uint8Array` y se borran con `sodium.memzero` tras usarlas. Límite asumido: el string de la contraseña en JS no se puede borrar de memoria con garantías.
- Tests: parámetros bajos de Argon2id inyectados para que vayan rápidos, y un test que verifica que producción usa los parámetros fuertes.
- La app abre sin contraseña; solo las notas privadas piden desbloqueo. La protección del disco es del sistema (BitLocker o similar).

## Reglas del juego (granja)

El estado de la granja **no se guarda: se calcula** a partir de los registros de hábitos (más las compras y los nombres de los animales, que sí son datos). Todos los números viven en `packages/core/src/game/game-rules.ts` para poder ajustarlos sin tocar la lógica.

El motor (`game/engine.ts`, `computeFarm`) recorre los días desde el primer hábito o animal hasta hoy. **Los días anteriores a hoy están cerrados**; hoy es provisional: suma los puntos de lo hecho, pero no penaliza ni cambia bienestar, salud o animales. El resultado no depende del orden de los datos.

- **Puntos:** si haces el hábito, `+10 × effort`; si no lo haces, `−10 × (6 − effort)` (fallar lo fácil penaliza más). "Saltado" y los días no programados son neutros. Las cantidades dan puntos y penalización proporcionales. Bonus de racha de +5 % por semana, hasta +50 %.
- **Frecuencias flexibles** (N veces por semana o mes): hacerlo suma ese día; lo que falte del objetivo se penaliza al cerrar el periodo (domingo o fin de mes). Un día saltado cuenta para el objetivo.
- **XP:** suma solo lo ganado y nunca baja. Nivel n a partir de `100·n·(n−1)` XP. **Grano:** lo ganado menos penalizaciones y compras, nunca por debajo de 0.
- **Bienestar (0–100, empieza en 80):** depende del **cumplimiento del día** = puntos conseguidos / puntos posibles (sin bonus) de los hábitos que tocan y no se saltaron.
  - Menos del 40 %: −15. Entre 40 y 69 %: −5. Entre 70 y 89 %: +8. 90 % o más: +12.
  - Si no se hicieron al menos 3 hábitos (o todos, si tocaban menos), un día con un 70 % o más cuenta como −5 y no es "bueno".
  - Un día sin hábitos que cuenten no cambia el bienestar.
- **Enfermedad y muerte:** por debajo del 30 % los animales enferman. Al tercer día seguido por debajo del 30 % muere un animal (elegido de forma determinista) **para siempre** y el contador vuelve a 0. `deathWarning` da el animal y los días que le quedan.
- **Curación:** 2 días buenos seguidos y el bienestar en el 30 % o más.
- **Crías:** 7 días seguidos con bienestar de 70 o más y sin enfermedad hacen nacer una cría de la especie de un padre, si cabe (capacidad `4 + 2·nivel`).
- **Contra las trampas:** los hábitos con menos de 7 días no cuentan para el cumplimiento (sí dan puntos). Borrar o archivar un hábito no borra las penalizaciones pasadas. Cambiar el esfuerzo solo afecta a partir del cambio. Solo se puede registrar hoy y ayer (`setHabitLog` → `ClosedDayError`).
- **Modo vacaciones:** solo protege los días posteriores al día en que se creó. Esos días no hay penalizaciones ni cambios de bienestar o salud.
- Gráficos: solo recursos con licencia libre (CC0, p. ej. Kenney.nl), con la atribución en `CREDITS.md`.

## Repositorio público

- Nunca se suben bases de datos, archivos `.agx`, exportaciones ni `.env` (ver `.gitignore`). Los datos de prueba y los fixtures son inventados.
- Nada de claves, tokens ni rutas personales en el código.
- Licencia MIT.

## Fases

0. Estructura del monorepo, esqueleto de Tauri y este documento. ✅
1. Núcleo: modelo, SQLite, migraciones, repositorios, recurrencias, frecuencias y rachas, motor del juego, cripto, formato `.agx`, fusión y tests. ✅
2. Interfaz base: Hoy, Tareas, Hábitos (con puntos), Notas, granja básica (adoptar, nombres, cementerio), Ajustes (tema oscuro/claro/sistema), atajos N y /. **Primera entrega usable** (instalador de Windows). ✅
3. Avisos: notificaciones, bandeja del sistema, arranque automático. ✅
4. Copia de seguridad cifrada y sincronización automática con Google Drive. ✅
5. Android (y Linux).
6. Granja visual (animales con nombre, tienda, cementerio, logros), notas privadas, estadísticas, temas editables.
7. Calendario y suscripciones `.ics` (p. ej. el calendario de la universidad).
8. Publicación: README con capturas, GitHub Actions y Releases.

Fuera de alcance: gestor de contraseñas (descartado). Google Calendar: posible ampliación futura.

## Comandos

```
pnpm install          # dependencias
pnpm dev              # app de escritorio (Tauri) en desarrollo
pnpm dev:web          # solo la interfaz en el navegador (http://localhost:1420)
pnpm test             # tests
pnpm check            # typecheck + lint + formato + tests
pnpm test:rust        # tests de Rust (llavero, receptor OAuth)
pnpm build            # instalador de escritorio
```
