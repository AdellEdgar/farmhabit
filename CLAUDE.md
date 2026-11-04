# ¡Chambea!: guía del proyecto

App personal **local-first** de productividad: tareas, hábitos con una **criatura por hábito** que evoluciona como sistema de motivación, notas (con notas privadas cifradas) y calendario. Plataformas: **Windows, Linux y Android**. Interfaz en **español**. Antes se llamaba **FarmHabit**: los nombres técnicos (`productName` del instalador, repositorio, identificador `io.github.adelledgar.farmhabit`, paquete `@farmhabit/*`, formato `farmhabit-export`, archivos de sincronización) se mantienen a propósito para no romper datos ni actualizaciones. Cambiar `productName` instalaría la app al lado de la antigua (otra carpeta, otro arranque automático) y, al compartir identificador, la antigua abriría una base de datos más nueva y daría error.

El repositorio es **público** (portfolio). Cualquiera puede instalar la app y usarla con sus propios datos: los datos nunca están en el repo.

## Reglas de trabajo

- Se trabaja por fases, **un commit por fase** (ver "Fases"). No adelantar trabajo de fases futuras sin acordarlo.
- **Commits y push:** por defecto los hace el usuario (Claude deja los cambios sin commitear y le da los comandos y el mensaje). Si el usuario se lo pide, los hace Claude.
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
  src/game/           motor de criaturas (creatures.ts), especies, reglas (creature-rules.ts) y logros
  src/crypto/         envoltorio de libsodium
  src/sync/           formato .agx, migraciones de formato, fusión
  src/util/           reloj monotónico, UUID, fechas locales
apps/app/             React + src-tauri (Windows, Linux, Android)
  src/lib/            drivers SQLite, contexto de datos (AppProvider/useApp), formato de fechas, tema, atajos
  src/components/     componentes base (ui.tsx)
  src/features/       una carpeta por sección: today, tasks, habits, notes, books, calendar, creatures, settings
  src-tauri/src/db.rs comandos db_select, db_execute y db_transaction
```

**Datos en la UI:** `AppProvider` abre la BD, carga todas las colecciones en memoria y calcula el juego con `computeGame`. Toda escritura pasa por `mutate(fn)`, que ejecuta el cambio, recarga los datos y muestra los errores en un aviso.

**Rendimiento:**

- **Recarga incremental:** antes de releer, `Database.collectionSignatures()` da una huella por colección (filas y suma de `updated_at`). Solo se releen las colecciones cuya huella cambió, y las demás conservan la misma referencia. El juego se memoriza solo sobre `allHabits`, `habitLogs`, `tasks`, `taskCompletions`, `purchases`, `vacations` y `today`: escribir una nota no lo recalcula. Referencia medida (con el motor anterior, de coste parecido): 3 años, 15 hábitos y 13.000 registros dan unos 43 ms el motor y 15 ms las rachas.
- **Carga bajo demanda:** libsodium se importa dinámicamente en `crypto/sodium.ts`. Notas (TipTap), Calendario, Criaturas, Ajustes y Estadísticas van con `React.lazy`. La carga inicial pasó de 1,5 MB a unos 530 KB (de 505 a unos 170 KB comprimido).
- **Hashes deterministas** en `util/hash.ts`: `fnv1a` (el motor depende de él: no cambiarlo, o cambiarían las muertes pasadas) y `stableRandom`.

**Regla de oro:** el núcleo no importa React, Tauri ni nada del DOM. La plataforma se le inyecta mediante interfaces (`SqlDriver`, almacén de claves, notificador). Así se prueba en Node y se reutiliza tal cual en Android.

**SQLite nativo:** no se usa `plugin-sql`, porque su pool de conexiones no garantiza transacciones atómicas. `src-tauri/src/db.rs` mantiene una única conexión `rusqlite` tras un `Mutex` y `db_transaction` ejecuta todas las sentencias en una transacción real. La BD vive en el directorio de datos de la app (`%APPDATA%\io.github.adelledgar.farmhabit\farmhabit.db` en Windows), en modo WAL.

**Avisos (Fase 3):** `remindersBetween` (núcleo, `domain/reminders.ts`) devuelve los avisos de tareas y hábitos con instante en `(from, to]`. No avisa de tareas completadas ni de hábitos ya hechos, saltados o con el objetivo del periodo cumplido. `ReminderScheduler` (app) comprueba cada 20 s desde `meta.reminders:lastCheck`, así nada se repite al reiniciar. Recupera como mucho 12 h de avisos perdidos y agrupa en uno solo si hay más de 3. También avisa de los eventos propios (`events` en la entrada; cada ocurrencia con su clave). A las 20:00 avisa si hay `alerts`. Preferencias del dispositivo en `meta`: `reminders:enabled`, `closeToTray`.

**Bandeja y arranque (escritorio):** la ventana se crea oculta (`visible: false`) y Rust la muestra salvo con `--minimized`, que es el argumento del autoarranque (`tauri-plugin-autostart`). Cerrar la ventana la esconde en la bandeja (comando `set_close_to_tray`); para salir, "Salir" en el menú del icono. `tauri-plugin-single-instance` hace que abrir la app otra vez muestre la ventana existente. En **Linux** "seguir en la bandeja" empieza desactivado (`DEFAULT_CLOSE_TO_TRAY`), porque GNOME sin extensión no muestra la bandeja y la ventana quedaría inaccesible.

**Android (Fase 5):** la app no sigue viva en segundo plano, así que `MobileReminderScheduler` reprograma en el sistema (`Schedule.at`, `allowWhileIdle`) los avisos de los próximos 7 días, como mucho 60, cada vez que cambian los datos. Marcar un hábito como hecho quita su aviso al recalcular la lista. Sin bandeja, autoarranque ni instancia única (dependencias solo de escritorio en `Cargo.toml`). Los secretos, de momento, van en un archivo del directorio privado de la app (pendiente: Keystore). El inicio de sesión con Google usa el mismo flujo de redirección local; **no está probado en un dispositivo real**. El proyecto Android (`gen/android`) no se versiona: lo genera `tauri android init --ci` en GitHub Actions. Después se copia encima `src-tauri/android/MainActivity.kt`: la app va de borde a borde y esa actividad pasa a la web el tamaño de las barras del sistema (`window.FarmHabitInsets`, evento `farmhabit:insets`), que `src/lib/insets.ts` convierte en las variables CSS `--fh-inset-*`. Todo lo que toque los bordes de la pantalla en móvil debe usarlas, no `env(safe-area-inset-*)`.

**CI (`.github/workflows/build.yml`):** tests y lint; instaladores de Windows (NSIS) y Linux (`.deb`, AppImage) con tests de Rust; APK de Android (aarch64). Los instaladores se descargan como artifacts de cada ejecución. Las credenciales de Google salen de los secretos del repositorio `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

**Modo navegador (`pnpm dev:web`):** sin Tauri se usa SQLite en WebAssembly (`sql.js`), con los datos en `localStorage` de ese navegador. Solo sirve para desarrollar y probar la interfaz.

## Modelo de datos

Toda tabla sincronizable tiene: `id` (UUID), `created_at`, `updated_at`, `deleted_at` (tombstone). Instantes en **ms UTC**; fechas del usuario en **hora local de pared** (`YYYY-MM-DD`, `HH:mm`).

- `tags`: nombre y color.
- `tasks`: título, notas, prioridad (1 alta, 2 media, 3 baja), estado (`pending`/`done`), `due_date`, `due_time`, `rrule`, `reminders` (JSON, p. ej. `[{offsetMin:1440},{offsetMin:60}]`), `tag_ids` (JSON), `completed_at`.
- `subtasks` (migración 3): `task_id`, título, `done` y `sort_key` (índice fraccional). Son una colección aparte y no un JSON dentro de `tasks`, así cada subtarea se fusiona por separado y una versión antigua de la app, que no conoce la colección, la ignora sin perderla. `setSubtaskDone` completa la tarea al hacer la última (en las recurrentes, pasa a la siguiente fecha y las subtareas vuelven a por hacer) y la reabre si se desmarca una de una tarea completada; completar la tarea a mano no toca las subtareas. `deleteTask` borra también sus subtareas.
- `task_completions`: historial de tareas recurrentes. id = UUIDv5(tarea + fecha de ocurrencia). Al completar una recurrente se registra aquí y la fecha avanza a la siguiente ocurrencia.
- `habits`: nombre, descripción, icono, color, `sort_key` (índice fraccional), `start_date`, `reminders` (JSON `[{time, days}]`), `archived_at` y `config_history` (JSON): lista de `{since, effort (1–5), schedule, target}`. `schedule` es `daily`, `weekdays{days}`, `timesPerWeek{times}`, `timesPerMonth{times}` o `everyNDays{interval}`; `target` es `{quantity, unit}` o null. Un cambio de configuración se añade con `since` = mañana (o reemplaza si el hábito empieza hoy), para no reescribir el pasado.
- `habit_logs`: id = UUIDv5(hábito + fecha), `date`, `status` (`done`/`skipped`), `value` (cantidad o null). Desmarcar = tombstone.
- `note_folders`: nombre, `parent_id`, `sort_key`.
- `notes`: `folder_id`, título, contenido (JSON de TipTap), texto plano para buscar, `tag_ids`, `pinned`, `is_private`, `private_blob`.
- `animals`: de la antigua granja. Se conserva (y viaja en copias y sincronización) pero ya no se usa.
- Migración 4 (criaturas): `habits` gana `creature_species`, `creature_name`, `creature_background` y `creature_aura` (con valores por defecto en zod para leer datos de versiones anteriores). Tabla `purchases` (sincronizable): `item` (`freeze`, `background:<id>`, `aura:<id>`), `date` y `price`.
- Migración 5: tabla `events` (sincronizable): `title`, `location`, `description`, `all_day`, `start_date`, `start_time`, `end_date`, `end_time`, `rrule`, `reminders`. No entra en el juego. El fin posterior al inicio se valida en `services/events.ts`, no en zod, para que un dato raro de otro dispositivo no rechace un archivo entero. `habits` gana `creature_past` (JSON `[{species, maxStage}]`): las especies abandonadas siguen en la colección, pero no cuentan para el logro Coleccionista (si no, bastaría con ir pulsando especies). `keepCreatureFields` lo conserva si el archivo viene de un esquema anterior al 5.
- Migración 6 (libros): `books` (`title`, `author`, `pages`, `cover_url`, `isbn`, `status`, `current_page`, `started_on`, `finished_on`, `rating`, `review`, `tag_ids`), `book_quotes` (`book_id`, `text`, `page`) y `reading_logs` (id = UUIDv5(libro + fecha), `book_id`, `date`, `from_page`, `page`: lo leído ese día es `page − from_page`). No entran en el juego.
- `vacations`: `start_date`, `end_date`. Solo protegen los días posteriores al día en que se crearon.
- `settings`: clave y valor (sincronizados). Lo que es solo del dispositivo (p. ej. el tema elegido) va en `meta`.
- `calendar_sources` (migración 2): calendarios externos de solo lectura. Tienen nombre, tipo (`url` o `file`), `url`, `ics` (solo para los importados, se sincroniza), color y si están visibles.
- Locales (no se sincronizan): `meta` (deviceId, versión de esquema, `lastClock`, `lastSync:<deviceId>`, `theme`) y `calendar_cache` (lo descargado de cada URL; no está en `COLLECTIONS`, así que no viaja en copias ni en la sincronización). El buscador de notas filtra en memoria sin distinguir acentos ni mayúsculas; si hiciera falta se añadirá un índice FTS5.

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
- Los archivos de copia se leen y escriben con `tauri-plugin-fs` (también abre las rutas `content://` de Android), solo en la ruta que el usuario elige en el diálogo, que es quien da el permiso. Se rechazan las de más de 100 MB.
- **Notas privadas** (`crypto/private-notes.ts`, `services/private-notes.ts`):
  - Una clave aleatoria (DEK) cifra `{title, content, plainText}` de cada nota, con el id de la nota como AAD; el resultado va en `privateBlob` y los campos en claro se vacían.
  - La DEK va envuelta con Argon2id(contraseña de notas privadas) en el ajuste sincronizado `privateNotes.vault`, así los demás dispositivos la abren con la misma contraseña. Cambiar la contraseña solo reenvuelve la DEK.
  - En la app, la DEK vive solo en memoria (`lib/private-session.ts`) y se bloquea sola tras 5 minutos sin uso.
  - En las copias y en la sincronización van doblemente cifradas. El buscador solo las encuentra mientras están desbloqueadas.
  - SQLite usa `secure_delete=ON` para no dejar texto borrado en páginas libres.
- Las claves se manejan como `Uint8Array` y se borran con `sodium.memzero` tras usarlas. Límite asumido: el string de la contraseña en JS no se puede borrar de memoria con garantías.
- Tests: parámetros bajos de Argon2id inyectados para que vayan rápidos, y un test que verifica que producción usa los parámetros fuertes.
- La app abre sin contraseña; solo las notas privadas piden desbloqueo. La protección del disco es del sistema (BitLocker o similar).

## Reglas del juego (criaturas)

Diseño completo en `docs/superpowers/specs/2026-11-03-chambea-criaturas-design.md`. El estado del juego **no se guarda: se calcula** con `computeGame` (`game/creatures.ts`) a partir de hábitos, registros, tareas, compras y vacaciones. Todos los números viven en `game/creature-rules.ts`. El motor recorre los días desde el primer dato hasta hoy; **los días anteriores a hoy están cerrados** y hoy es provisional: suma, pero no resta ni hace retroceder. El resultado no depende del orden de los datos (test con fast-check).

- **Especies** (`game/species.ts`): 16, mezcla de figuras históricas o mitológicas de dominio público y criaturas originales. Nada de personas fallecidas hace menos de un siglo ni personajes con derechos. Un hábito sin especie usa `defaultSpecies(id)` (determinista, de nivel 1).
- **XP de cada criatura:** hacer el hábito da `round(ratio × (10 + 5 × esfuerzo) × bonus de racha)` (+5 % por semana seguida, máx. +50 %); fallar un día cerrado resta `round((1 − ratio) × 5 × (6 − esfuerzo))`. Saltado, no programado, vacaciones y días protegidos por comodín son neutros. Flexibles: lo que falte del objetivo resta al cerrar la semana o el mes. Nunca por debajo de 0.
- **Etapas:** 0 huevo, 1 bebé (50 XP), 2 joven (500), 3 adulto (1.500), 4 leyenda (4.000). Sube al llegar al umbral; **baja solo por debajo del 80 %** del umbral de su etapa. `history` guarda eclosiones, evoluciones y retrocesos.
- **Ánimo:** cumplimiento medio de los últimos 7 días programados y cerrados: ≥ 80 % feliz, ≥ 50 % normal, ≥ 20 % cansada, menos triste; con menos de 3 días, normal. `alerts` = criaturas que retrocederían si hoy se cierra sin hacer su hábito (sin comodín guardado ni vacaciones; en flexibles, solo el día que cierra el periodo). Es el aviso de las 20:00.
- **Entrenador:** XP = suma de lo **ganado** por todas las criaturas (incluye hábitos borrados y archivados), más lo que dan tareas, misiones y logros. Puede bajar si se reabre una tarea o se deshace lo que cumplió una misión. Nivel n desde `100·n·(n−1)`. Desbloquea 6 especies de inicio y 2 más por nivel (todas en el 6).
- **Sin monedas:** las pesetas y la tienda se quitaron. Todos los fondos y auras son gratis desde la ficha. **Tareas** = 5/3/2 XP de entrenador por prioridad alta/media/baja si se creó un día antes o más, con tope de 25 al día. La colección `purchases` se conserva como `animals`: ya no se escribe, y el motor solo lee sus `freeze`, para no cambiar los días que esos comodines ya protegieron.
- **Misiones** (`game/missions.ts`): 3 por semana desde `missionsStart` (2026-11-02), elegidas con un hash de la semana entre los hábitos activos ese lunes; no se guardan. Una de hábito (lo programado esa semana), una de tareas (la semana anterior, entre 5 y 10) y días perfectos (3) o XP (el 90 % de la anterior, mínimo 100: repetir la semana basta). Sin hábitos elegibles, tres de tareas. Premios en `missionRewards`, en XP de entrenador: se abonan el día que se cumplen y antes de los logros; no suman a la criatura. Archivar, borrar o reconfigurar a mitad de semana no las cambia. Día perfecto: todo lo programado hecho (un saltado no cuenta; solo saltados, tampoco). Las tareas cuentan como la XP: creadas un día antes o más.
- **Semanas:** `game.weeks` guarda por lunes XP, veces programadas y hechas, tareas, mejor racha, nacimientos, evoluciones, retrocesos, misiones, días perfectos y criatura estrella. En las flexibles un día cuenta solo si se hizo, y lo que falte al cerrar el periodo suma a lo programado. Los días de vacaciones o comodín sin hacer no cuentan. `summaryToShow` decide el resumen a pantalla completa: la semana anterior si tuvo actividad y no se ha visto (`meta` `summary:seen`); en el primer arranque, nada.
- **Frases** (`game/phrases.ts`): 5 por especie y momento (`saludo`, `feliz`, `triste`, `hecho`, `evolucion`), elegidas con `pickPhrase` por criatura, momento y día. Huevos y criaturas archivadas no hablan.
- **Comodines:** cumplir las misiones de la semana que no son de tareas da 1 (máximo 2 guardados), que sirve desde el día siguiente. Las de tareas no cuentan: una tarea se puede reabrir meses después, y eso reescribiría días cerrados. Se gasta solo el primer día cerrado posterior con algún fallo: ese día es neutro para todas las criaturas.
- **Logros** (`game/creature-achievements.ts`): se cumplen el día en que se da la condición y dan su premio en XP de entrenador.
- **Contra las trampas:** solo se registra hoy y ayer (`setHabitLog` → `ClosedDayError`); borrar o archivar un hábito no quita lo ganado ni las penalizaciones pasadas; cambiar el esfuerzo solo afecta desde el cambio.
- **Vacaciones:** solo protegen los días posteriores a su creación. `scheduleVacation` exige empezar como pronto mañana, máximo 30 días y sin solaparse; `endVacation` borra las futuras y acorta las que están en curso hasta ayer.
- **App:** sección **Criaturas** (`features/creatures/`: equipo, semana, colección, logros y ficha). Imágenes en `apps/app/src/assets/criaturas/` (WebP generados por `pnpm criaturas` desde `art/criaturas/`, que no se versiona; prompt en `docs/arte/prompt-imagenes.md`); sin imagen, `CreatureImage` muestra el emoji de la especie. Ánimo y auras son CSS. La celebración de eclosiones y evoluciones se muestra una vez por dispositivo (`meta` `creatures:seen:<habitId>`).

## Calendario (Fase 7)

- **Eventos propios** (Fase 12): `domain/events.ts` (`eventsInRange`) y `services/events.ts` (`createEvent`, `updateEvent`, `deleteEvent`, `taskToEvent`). En la app, `ownEventsAsSource` los da con la forma de un evento suscrito (`ownEventId`, color `--fh-info`) y se pintan igual; `EventEditor` los edita. Editar o borrar uno repetido afecta a toda la serie; no hay excepciones por día.
- **Lector `.ics` propio** (`domain/ics.ts`): líneas partidas, escapes, `VALUE=DATE` (día completo), `TZID` (IANA y nombres de Windows de Outlook, convertidos con `Intl`), `Z`, `DURATION`, `RRULE`, `EXDATE`, `RECURRENCE-ID` (ocurrencias movidas o canceladas), `STATUS:CANCELLED`. Ignora lo que hay dentro de `VALARM`.
  - Las repeticiones se expanden en hora de pared de la zona del evento, así una clase semanal sigue a las 9:00 tras el cambio de hora.
  - Como mucho 2000 ocurrencias por evento.
- `domain/calendar.ts`: cuadrícula del mes (42 días de lunes a domingo) y `tasksInRange`, que incluye las repeticiones futuras de las tareas recurrentes (`upcoming`).
- `services/calendar.ts`: alta de fuentes; `normalizeCalendarUrl` (solo `https://`, y `webcal://` se convierte a `https://`); caché local que solo guarda texto que es un `.ics` válido.
- **App:** `CalendarRefresher` vuelve a descargar las suscripciones de más de 6 h (al abrir y cada 30 min), y `useCalendarEvents` lee y expande las fuentes visibles con caché por fuente. Las descargas pasan por `tauri-plugin-http`, con el scope `https://*/*` porque las URL las pone el usuario.
- Pantalla **Calendario** con cuatro vistas (se recuerda la elegida en `meta` `calendar:view`): **mes** (en `lg` cada casilla muestra todo; debajo, los 3 primeros y el detalle del día al lado), **semana** y **día** (`TimeGrid`: rejilla de 24 h, lo de todo el día arriba y los solapes repartidos con `layoutTimed`) y **agenda** (30 días). `calendar-items.ts` junta eventos y tareas por día para todas. Los eventos abren un diálogo de solo lectura. La agenda del día también sale en **Hoy**. Guía para conseguir enlaces iCal en `docs/calendarios.md`.
- **Ancho:** cada sección tiene su ancho máximo en `SECTION_WIDTH` (`App.tsx`) y crece con la ventana hasta él.

## Libros

- Sección **Libros** (`features/books/`): estanterías Leyendo, Por leer, Leídos y Abandonados, ficha con progreso, nota de media en media estrella, reseña, etiquetas y citas, reto anual (ajuste sincronizado `books.goal.<año>`), estadísticas y "Leyendo ahora" en Hoy. **No intervienen en el juego.**
- **Progreso** (`setBookProgress`): apuntar página pasa el libro a Leyendo; llegar a la última, a Leídos; bajar de ella, a Leyendo. Sin total de páginas nunca pasa a Leídos solo.
- **Búsqueda** (`domain/book-search.ts`, `lib/book-search.ts`): Open Library, sin clave. `q` + `lang=es` y los campos `editions.*` dan el título y la portada en español; sin el campo `key`, `editions` llega vacío. Google Books sin clave se descartó por la cuota compartida. Solo se guarda el enlace de la portada, y solo se muestran los de `https://covers.openlibrary.org/` (`isAllowedCover`). La CSP permite ese dominio y `archive.org`, porque muchas portadas redirigen allí; `pnpm dev:web` no tiene CSP, así que esto solo se nota en la app instalada.

## Prioridad de las tareas

Se dibuja como las barras de cobertura del móvil (`PriorityBars.tsx`): baja llena la primera barra en verde (`--fh-exito`), media las dos primeras en amarillo (`--fh-aviso`) y alta las tres en rojo (`--fh-peligro`). Las barras vacías usan `--fh-borde`. La casilla de completar ya no se colorea según la prioridad.

## Estadísticas y temas

- `domain/stats.ts`: `habitCalendar` da el estado de cada día (hecho, a medias, saltado, fallado, pendiente, no tocaba), `completionRate` el porcentaje y `dailyCompletion` los datos de la gráfica de 30 días. Las gráficas son SVG propio, sin librerías.
- **Temas** (`lib/themes.ts`): 7 predefinidos y temas personalizados creados a partir de 4 colores (fondo, tarjetas, texto, acento); el resto se deriva mezclándolos. Los personalizados se sincronizan (ajuste `themes.custom`); el elegido es de cada dispositivo (`meta.theme`). Se aplican como variables `--fh-*` en `<html>`.

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
5. Android y Linux: avisos programados en móvil, copias con plugin-fs, compilación en GitHub Actions y README. ✅ (Android sin probar en un dispositivo real: el autor usa iPhone.)
6. Granja visual (escena, tienda, logros, vacaciones, cementerio), notas privadas, estadísticas y temas editables. ✅
7. Calendario y suscripciones `.ics` (p. ej. el calendario de la universidad). ✅
8. Publicación: versión 1.0.0, README con capturas, CHANGELOG, Release automática y demo web en GitHub Pages. ✅
9. Asistente con IA (OpenRouter). Publicado en la v1.1.0-rc.1 y retirado después: para esta app no hacía falta. El código sigue en el historial (commit 488c4b5).
10. Subtareas que completan la tarea y prioridad con barras de cobertura. ✅
11. 2.0: criaturas en lugar de la granja, tienda con pesetas, nombre ¡Chambea!, actualizaciones automáticas y vistas del calendario. ✅
12. Eventos propios, misiones semanales, resumen semanal, frases y colección que no olvida especies. ✅
13. Sección Libros y fin de las pesetas: recompensas en XP y personalización gratis. ✅

## Publicación (Fase 8)

- **Versión:** `apps/app/package.json` es la fuente; `tauri.conf.json` la lee de ahí (`"version": "../package.json"`) y la UI la recibe como `__APP_VERSION__` (Vite `define`). Hay que subirla también en el `package.json` raíz, en `packages/core/package.json` y en `Cargo.toml`, y apuntarla en `CHANGELOG.md`.
- **Release:** al subir una etiqueta `vX.Y.Z`, el trabajo `release` de `build.yml` descarga los artifacts y crea la Release con `gh release create`; el APK se renombra a `FarmHabit_X.Y.Z_android.apk`.
- **Demo web:** el trabajo `pages` compila con `VITE_DEMO=1` y `VITE_BASE=/<repo>/` y publica en GitHub Pages. Necesita activar Pages en el repositorio (Settings → Pages → Source: GitHub Actions); si no está activado, ese trabajo falla sin marcar en rojo toda la ejecución (`continue-on-error`).
- **Datos de ejemplo** (`apps/app/src/lib/demo-data.ts`): solo en modo navegador y con la base vacía, con `VITE_DEMO=1` o `?demo` en la URL. Son deterministas (hash + fmix32). `?section=<id>` abre una sección concreta.
- **Capturas** (`docs/screenshots/`): se generaron con Edge headless contra `pnpm dev:web` y `?demo&section=…`, a 1280×800 en escritorio y 500×1000 a escala 2 en móvil (Edge no baja de unos 500 px de ancho).
- **Instalador:** NSIS en español (`languages: ["Spanish"]`), con editor, copyright y web. El MSI no se publica: no admite versiones con prerelease (`1.0.0-rc.2`).
- **Versión en CI:** en las etiquetas, `npm pkg set version` pone en `apps/app/package.json` la versión de la etiqueta antes de compilar.
- **Actualizaciones** (`src/lib/updates.ts`, `docs/actualizaciones.md`): en escritorio, `tauri-plugin-updater` (NSIS, AppImage y `.deb`) con clave pública en `plugins.updater.pubkey`; CI firma los instaladores con `tauri signer sign` (secretos `TAURI_SIGNING_PRIVATE_KEY` y `_PASSWORD`) y el trabajo `release` genera `latest.json` con `jq`. En Android solo se avisa: se lee `latest.json` con plugin-http (la CSP no deja `fetch` a GitHub) y se compara con `compareSemver` del core; `downloads.android` lleva el enlace al APK. Endpoint: `releases/latest/download/latest.json`, que ignora las prerelease, así que todas las Releases (también `-rc`) son normales.
- **APK:** release firmado con `apksigner` y la clave fija de los secretos `ANDROID_KEYSTORE` (base64) y `ANDROID_KEYSTORE_PASSWORD` (`docs/android.md`); sin ellos, firma de depuración.

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
