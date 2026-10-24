# FarmHabit: guía del proyecto

App personal **local-first** de productividad: tareas, hábitos con una **granja de animales** como sistema de motivación, notas (con notas privadas cifradas) y calendario. Plataformas: **Windows, Linux y Android**. Interfaz en **español**.

El repositorio es **público** (portfolio). Cualquiera puede instalar la app y usarla con sus propios datos: los datos nunca están en el repo.

## Reglas de trabajo

- Se trabaja por fases, **un commit por fase** (ver "Fases"). No adelantar trabajo de fases futuras sin acordarlo.
- Antes de cerrar una fase: `pnpm check` (typecheck + lint + formato + tests) tiene que pasar.
- Idioma: **interfaz y documentación en español**. Identificadores de código en inglés. Comentarios en español, solo cuando aportan.
- Mantener este archivo al día cuando cambie una decisión de arquitectura, el formato del archivo, las reglas del juego o las de seguridad.

## Stack

| Pieza           | Elección                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Lenguaje        | TypeScript 6 (strict)                                                                                     |
| UI              | React 19 + Vite 8 + Tailwind 4 (+ Radix UI desde la Fase 2)                                               |
| Contenedor      | Tauri 2: Windows, Linux (AppImage/.deb) y Android desde el mismo proyecto. Plan B para Android: Capacitor |
| Base de datos   | SQLite (`@tauri-apps/plugin-sql` en la app; `better-sqlite3` en tests) + FTS5 para el buscador            |
| Cripto          | libsodium (`libsodium-wrappers-sumo`): Argon2id + XChaCha20-Poly1305                                      |
| Validación      | zod                                                                                                       |
| Editor de notas | TipTap                                                                                                    |
| Recurrencias    | RRULE (RFC 5545), librería `rrule`                                                                        |
| Gráficas        | Recharts                                                                                                  |
| Tests           | Vitest + fast-check                                                                                       |
| Monorepo        | pnpm workspaces                                                                                           |

Rust se usa lo mínimo: arranque de Tauri, plugins y algún comando nativo puntual.

## Estructura

```
packages/core/        Núcleo SIN UI ni dependencias de plataforma (lo vigila ESLint)
  src/model/          tipos + esquemas zod
  src/db/             SqlDriver (interfaz), migraciones, repositorios
  src/domain/         orden de tareas, recurrencias, frecuencias, rachas, vista "Hoy"
  src/game/           motor de la granja + config de reglas (game-rules.ts)
  src/crypto/         envoltorio de libsodium
  src/sync/           formato .agx, migraciones de formato, fusión
  src/util/           reloj monotónico, UUID, fechas locales
apps/app/             React + src-tauri (Windows, Linux, Android)
```

**Regla de oro:** el núcleo no importa React, Tauri ni nada del DOM. La plataforma se le inyecta mediante interfaces (`SqlDriver`, almacén de claves, notificador). Así se prueba en Node y se reutiliza tal cual en Android.

**Riesgo conocido:** `plugin-sql` usa un pool de conexiones, por lo que `BEGIN…COMMIT` en llamadas separadas no es seguro. `SqlDriver.transaction(statements[])` debe ser atómico; si el plugin no lo garantiza, se añade un comando Rust pequeño.

## Modelo de datos

Toda tabla sincronizable tiene: `id` (UUID), `created_at`, `updated_at`, `deleted_at` (tombstone). Instantes en **ms UTC**; fechas del usuario en **hora local de pared** (`YYYY-MM-DD`, `HH:mm`).

- `tags`: nombre y color.
- `tasks`: título, notas, prioridad (1 alta, 2 media, 3 baja), estado (`pending`/`done`), `due_date`, `due_time`, `rrule`, `reminders` (JSON, p. ej. `[{offsetMin:1440},{offsetMin:60}]`), `tag_ids` (JSON), `completed_at`.
- `task_completions`: historial de tareas recurrentes. id = UUIDv5(tarea + fecha de ocurrencia). Al completar una recurrente se registra aquí y la fecha avanza a la siguiente ocurrencia.
- `habits`: nombre, icono, color, `effort` (1–5), `sort_key` (índice fraccional), `start_date`, `schedule` (JSON: `daily`, `weekdays{days}`, `timesPerWeek{times}`, `timesPerMonth{times}`, `everyNDays{interval}`), `target` (`{quantity, unit}` o null), `reminders` (JSON `[{time, days}]`), `archived_at`.
- `habit_logs`: id = UUIDv5(hábito + fecha), `date`, `status` (`done`/`skipped`), `value` (cantidad o null). Desmarcar = tombstone.
- `note_folders`: nombre, `parent_id`, `sort_key`.
- `notes`: `folder_id`, título, contenido (JSON de TipTap), texto plano para buscar, `tag_ids`, `pinned`, `is_private`, `private_blob`.
- `animals`: nombre (lo elige el usuario), especie, nacimiento, muerte, origen (comprado/nacido).
- `settings`: clave, valor, si se sincroniza (el tema elegido es por dispositivo; los temas personalizados se sincronizan).
- Locales (no se sincronizan): `meta` (deviceId, versión de esquema, último reloj), índice FTS5, caché de eventos de calendario.

`updated_at` es monotónico por dispositivo: `max(ahora, último + 1)`. Los tombstones no se purgan.

## Sincronización y fusión

- **Exportar/importar** un archivo cifrado `.agx` con la contraseña maestra.
- **Sincronización por carpeta** (Syncthing): un archivo por dispositivo, `farmhabit-<deviceId>.agx`. Cada uno escribe solo el suyo y lee los demás, así no hay conflictos de archivo.
- **Fusión por elemento:** gana el `updated_at` mayor; si hay empate, gana el tombstone; si sigue el empate, decide un hash del contenido (determinista). Una copia antigua nunca resucita algo borrado; una edición posterior a un borrado sí lo resucita.
- **Notas:** si ambas versiones cambiaron desde la última sincronización con ese dispositivo, se conservan las dos ("Nota (conflicto)").
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
- Errores: `InvalidFileError`, `UnsupportedVersionError`, `DecryptionError` ("Contraseña incorrecta o archivo dañado": el cifrado autenticado no permite distinguir los dos casos) y `PayloadValidationError`.

## Reglas de seguridad

- **No inventar criptografía.** Solo primitivas de libsodium.
- Las contraseñas (maestra y de notas privadas) **nunca** se guardan en disco, `localStorage` ni logs, y no aparecen en mensajes de error.
- Para la sincronización automática se guarda la **clave derivada** (nunca la contraseña) en el almacén seguro del sistema: Credential Manager, Secret Service o Android Keystore.
- Notas privadas: una clave aleatoria (DEK) cifra `{título, cuerpo}`. Esa DEK está envuelta con Argon2id(contraseña de notas privadas) y viaja en `privateVault`. En el archivo exportado van doblemente cifradas.
- Las claves se manejan como `Uint8Array` y se borran con `sodium.memzero` tras usarlas. Límite asumido: el string de la contraseña en JS no se puede borrar de memoria con garantías.
- Tests: parámetros bajos de Argon2id inyectados para que vayan rápidos, y un test que verifica que producción usa los parámetros fuertes.
- La app abre sin contraseña; solo las notas privadas piden desbloqueo. La protección del disco es del sistema (BitLocker o similar).

## Reglas del juego (granja)

El estado de la granja **no se guarda: se calcula** a partir de los registros de hábitos (más las compras y los nombres de los animales, que sí son datos). Todos los números viven en `packages/core/src/game/game-rules.ts` para poder ajustarlos sin tocar la lógica.

- **Puntos:** si haces el hábito, `+10 × effort`; si no lo haces, `−10 × (6 − effort)` (fallar lo fácil penaliza más). "Saltado" y los días no programados son neutros. Las cantidades dan puntos parciales. Bonus de racha de +5 % por semana, hasta +50 %.
- **XP:** solo sube. Hace subir de nivel la granja y desbloquea especies, edificios y decoración. **Grano:** moneda para comprar.
- **Bienestar (0–100 %):** depende del **cumplimiento del día** = puntos conseguidos / puntos posibles de los hábitos programados.
  - Menos del 40 %: −15. Entre 40 y 69 %: −5. Entre 70 y 89 %: +8. 90 % o más: +12.
  - Un día solo cuenta como "bueno" si se hicieron al menos 3 hábitos (o todos, si ese día tocaban menos de 3).
- **Enfermedad y muerte:** con el bienestar por debajo del 30 % los animales enferman. Si pasan 3 días seguidos por debajo del 30 %, un animal **muere para siempre** y va al cementerio (nombre y fechas). Antes de morir hay un aviso con su nombre.
- **Curación:** 2 días seguidos con al menos un 70 % de cumplimiento y el bienestar por encima del 30 %.
- **Contra las trampas:** los hábitos creados hace menos de 7 días no cuentan para recuperar bienestar. Borrar o archivar un hábito no borra las penalizaciones pasadas. Cambiar el esfuerzo solo afecta a los días siguientes. Solo se puede registrar hasta el día anterior: los días cerrados no se editan.
- **Modo vacaciones:** se activa por adelantado y pausa las penalizaciones.
- Gráficos: solo recursos con licencia libre (CC0, p. ej. Kenney.nl), con la atribución en `CREDITS.md`.

## Repositorio público

- Nunca se suben bases de datos, archivos `.agx`, exportaciones ni `.env` (ver `.gitignore`). Los datos de prueba y los fixtures son inventados.
- Nada de claves, tokens ni rutas personales en el código.
- Licencia MIT.

## Fases

0. Estructura del monorepo, esqueleto de Tauri y este documento. ✅
1. Núcleo: modelo, SQLite, migraciones, repositorios, recurrencias, frecuencias y rachas, motor del juego, cripto, formato `.agx`, fusión y tests.
2. Interfaz base: Hoy, Tareas, Hábitos (con puntos), Notas, tema oscuro. **Primera entrega usable** (instalador de Windows).
3. Avisos: notificaciones, bandeja del sistema, arranque automático.
4. Exportar/importar cifrado y sincronización por carpeta.
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
pnpm build            # instalador de escritorio
```
