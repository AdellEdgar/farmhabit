# Eventos, resumen semanal, misiones y frases: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir eventos propios al calendario y, a las criaturas, resumen semanal, misiones, frases y una colección que no olvida especies.

**Architecture:** Los eventos son una colección sincronizable nueva que se convierte a la misma forma que los eventos suscritos para pintarse en las vistas existentes. Misiones y estadísticas de la semana se calculan dentro del bucle de días de `computeGame`, sin guardar nada. Las frases son datos del núcleo con elección determinista.

**Tech Stack:** TypeScript 6, React 19, Tailwind 4, Vitest + fast-check, SQLite (migraciones congeladas), zod 4, `rrule`.

**Spec:** `docs/superpowers/specs/2026-11-04-eventos-misiones-design.md`

## Global Constraints

- **Sin commits ni push** salvo que el usuario lo pida. Cada tarea termina con `pnpm check` en verde.
- Interfaz, documentación y comentarios en español; identificadores en inglés. El núcleo no importa React, Tauri ni DOM.
- Migraciones congeladas: se añade la 5, no se edita ninguna.
- Los números del juego van en `creature-rules.ts`. El juego no se guarda: se calcula, y no depende del orden de los datos.
- Las misiones solo cuentan desde la semana del `2026-11-02`.
- Los 5 arreglos anteriores están sin commitear en el árbol de trabajo: forman parte de la base.

## Review Focus

1. **Avisos de un evento repetido:** cada ocurrencia avisa una vez, con su propia clave, sin repetirse al reiniciar. → Task 2.
2. **Evento de día completo con aviso:** no tiene hora; se cuenta desde las 09:00 de ese día, como las tareas sin hora. → Task 2.
3. **Actualizar la app:** el historial no da pesetas de misiones pasadas y no salta un resumen de una semana antigua en el primer arranque. → Tasks 5 y 8.
4. **Borrar o archivar un hábito a mitad de semana:** su misión sigue en la lista y conserva el progreso; no cambian las otras misiones. → Task 5.
5. **Deshacer hoy lo que completó una misión:** el premio desaparece, porque hoy es provisional. → Task 5.

---

### Task 1: Datos (migración 5)

**Files:** Modify `packages/core/src/db/migrations.ts`, `db/tables.ts`, `model/schemas.ts`, `model/types.ts`, `model/collections.ts`, `sync/service.ts`, `test/helpers/fixtures.ts`. Test `test/db.test.ts`, `test/sync-service.test.ts`, `test/smoke.test.ts`.

**Interfaces — Produces:**

- `CalendarEvent` y colección `events`: `{...sync, title (1–200), location (≤200), description (≤5000), allDay: boolean, startDate, startTime: string|null, endDate, endTime: string|null, rrule: string|null, reminders: {offsetMin}[] (≤10)}`. Se nombra `CalendarEvent` porque `Event` es un global del DOM. `purgeOnDelete`: `title: ''`, `location: ''`, `description: ''`, `reminders: []`.
- `Habit.creaturePast: {species: string; maxStage: number}[]`, default `[]`, columna `creature_past` tipo `json` con `NOT NULL DEFAULT '[]'`.
- `makeEvent(over)` en fixtures: evento de 2026-09-01, 10:00–11:00.

- [ ] **Step 1:** Tests: la BD en esquema 4 con un hábito sube a 5 y conserva `creatureSpecies`, con `creaturePast: []` y `events` vacía. `SCHEMA_VERSION` es 5. Crear y leer un evento conserva todos sus campos; borrarlo vacía `title`. En `sync-service.test.ts`: un archivo de esquema 4 (con especie, sin pasado) conserva el `creaturePast` local pero aplica la especie remota; uno de esquema 3 conserva ambos; uno de esquema 5 aplica los dos.
- [ ] **Step 2:** `pnpm --filter @farmhabit/core test` → FALLA.
- [ ] **Step 3:** Implementar. En `keepCreatureFields`: esquema < 5 conserva `creaturePast` local; esquema < 4 conserva además los otros cuatro campos.
- [ ] **Step 4:** `pnpm check` → verde. `demo-data.ts` y `app-context` añaden lo mínimo para compilar: `FIELDS.events: 'events'`, `AppData.events`.

### Task 2: Eventos en el núcleo

**Files:** Create `packages/core/src/domain/events.ts`, `services/events.ts`, `test/events.test.ts`. Modify `domain/reminders.ts`, `index.ts`, `test/reminders.test.ts`.

**Interfaces:**

- Consumes: `occurrencesBetween(rrule, current, from, to)`, `localDateTimeToEpoch`, `diffDays`, `addDays`, `deleteTask`.
- Produces:
  - `interface EventOccurrence extends CalendarOccurrence { eventId: string }`; `key` = `` `${eventId}|${startDate}` ``.
  - `eventsInRange(events: CalendarEvent[], from: LocalDate, to: LocalDate): EventOccurrence[]`: incluye las que empiezan antes y terminan dentro del rango; ignora borrados; `slice(0, 2000)` por evento. Día completo: `start` = medianoche del inicio, `end` = medianoche del día siguiente al fin.
  - `ReminderEvent` gana `{ kind: 'event'; key; at; occurrence: EventOccurrence; offsetMin }`, con `key` = `` `event|${occurrence.key}|${offsetMin}` ``. `ReminderInput` gana `events?: CalendarEvent[]`.
  - `class EventRangeError`; `createEvent(db, input)`, `updateEvent(db, id, patch)`, `deleteEvent(db, id)`. Lanzan `EventRangeError('El evento termina antes de empezar')` si el fin no es posterior al inicio. Sin hora: `startTime` y `endTime` a null y `allDay` true.
  - `class TaskToEventError`; `taskToEvent(db, taskId): Promise<CalendarEvent>`: copia `title`, `notes` a `description`, `reminders` y `rrule`; `allDay` si no hay hora; con hora, fin = inicio + 1 h, como mucho 23:59. Después llama a `deleteTask`. Sin fecha lanza `TaskToEventError`.

- [ ] **Step 1:** Tests con estos valores:
  - Evento único de 10:00 a 11:00 aparece solo su día; uno de dos días aparece en un rango que empieza en su segundo día; uno de día completo tiene `end` a medianoche del día siguiente.
  - `FREQ=WEEKLY` desde 2026-10-19 a las 09:00: la ocurrencia del 2026-10-26 (tras el cambio de hora) sigue a las 09:00 locales, y el rango de octubre da 2 ocurrencias.
  - Avisos: repetido con `offsetMin: 60` avisa a las 08:00 de cada ocurrencia, con claves distintas; un rango que empieza después del aviso no lo repite. Día completo con `offsetMin: 0` avisa a las 09:00 de ese día. Un aviso de 1440 min para una ocurrencia de mañana cae dentro del rango de hoy. Evento borrado: nada.
  - `createEvent` con fin anterior lanza `EventRangeError`. `taskToEvent`: con fecha y hora da inicio y fin + 1 h; a las 23:30 termina a las 23:59; sin hora da día completo; la tarea queda borrada y sus subtareas también; sin fecha lanza `TaskToEventError` y no borra nada.
- [ ] **Step 2:** Ejecutar → FALLA.
- [ ] **Step 3:** Implementar. Para no perder repeticiones, expandir desde `addDays(from, -duración)` y filtrar. En avisos, expandir hasta `to + mayor offset`. Si `rrule` es null, una sola ocurrencia; una RRULE inválida se trata como evento único.
- [ ] **Step 4:** `pnpm check` → verde.

Desviación de la spec: el fin posterior al inicio se valida en el servicio y no en zod, porque `COLLECTIONS` necesita objetos zod simples para fusionar, y un dato raro de otro dispositivo no debe rechazar todo el archivo.

### Task 3: Eventos en la interfaz

**Files:** Create `apps/app/src/features/calendar/EventEditor.tsx`, `features/tasks/RecurrenceFields.tsx`, `features/tasks/ReminderFields.tsx`. Modify `features/calendar/CalendarView.tsx`, `TodayAgenda.tsx`, `calendar-items.ts`, `features/tasks/TaskEditor.tsx`, `lib/reminder-text.ts`, `lib/ReminderScheduler.tsx`, `lib/MobileReminderScheduler.tsx`, `lib/demo-data.ts`, `lib/calendars.ts`.

**Interfaces:**

- Consumes: Task 2.
- Produces: `SourceEvent` gana `ownEventId?: string`. `ownEventsAsSource(events, from, to): SourceEvent[]` en `lib/calendars.ts`, con `color: 'var(--fh-info)'` y `sourceName: 'Mis eventos'`. `<EventEditor event={CalendarEvent | null} defaultDate onClose />`.

- [ ] **Step 1:** Extraer de `TaskEditor` los controles de repetición y de avisos a `RecurrenceFields` y `ReminderFields`, sin cambiar su aspecto. Comprobar en `pnpm dev:web` que el editor de tareas funciona igual.
- [ ] **Step 2:** `EventEditor`: título, interruptor Todo el día, inicio y fin (día y hora), lugar, descripción, repetición y avisos; Guardar y Borrar con confirmación. Al cambiar el inicio, el fin se mueve manteniendo la duración. Errores con `mutate`, que ya los muestra.
- [ ] **Step 3:** `CalendarView`: botón **Evento** junto a **Tarea**; concatenar `ownEventsAsSource` a los eventos de `itemsByDay`; `openItem` abre `EventEditor` si hay `ownEventId` y el diálogo de solo lectura si no. Igual en el panel del día. `TodayAgenda` incluye los propios.
- [ ] **Step 4:** `TaskEditor`: botón **Convertir en evento** cuando la tarea existe y tiene fecha; confirma con «Se perderán sus N subtareas» si tiene. Al terminar cierra el editor y muestra un aviso.
- [ ] **Step 5:** `reminderText` añade `kind === 'event'`: título `` `📅 ${title}` ``, cuerpo con la hora y el lugar. Los dos programadores pasan `events: data.events`.
- [ ] **Step 6:** `demo-data.ts`: 3 eventos (uno repetido, uno de día completo, uno con lugar).
- [ ] **Step 7:** `pnpm check`. En `pnpm dev:web?demo`, a 1024 y 412 px, sin errores de consola: crear, editar, repetir y borrar un evento; verlo en las cuatro vistas y en Hoy; convertir una tarea.

### Task 4: La colección no olvida especies

**Files:** Modify `packages/core/src/game/creatures.ts`, `services/habits.ts`, `apps/app/src/features/creatures/CreatureSheet.tsx`, `features/habits/HabitEditor.tsx`. Test `test/creatures.test.ts`, `test/habits.test.ts`.

**Interfaces — Produces:** `changeCreatureSpecies(db, habitId, species: SpeciesId, maxStageEver: number): Promise<Habit>`, que añade o actualiza `{species: anterior, maxStage}` en `creaturePast` si la especie cambia.

- [ ] **Step 1:** Tests: un hábito con `creaturePast: [{species:'medusa', maxStage:2}]` da `seenStages.medusa = [1,2]` y `speciesSeen` la cuenta; una especie desconocida se ignora. `changeCreatureSpecies` guarda la anterior; volver a ella conserva el mayor `maxStage`; elegir la misma no cambia nada.
- [ ] **Step 2:** Ejecutar → FALLA.
- [ ] **Step 3:** Implementar. En el motor, los logros también cuentan el pasado. `CreatureSheet` y `HabitEditor` usan `changeCreatureSpecies`.
- [ ] **Step 4:** `pnpm check` → verde.

### Task 5: Misiones y estadísticas de la semana

**Files:** Create `packages/core/src/game/missions.ts`, `test/missions.test.ts`. Modify `game/creatures.ts`, `game/creature-rules.ts`, `index.ts`.

**Interfaces — Produces:**

- Reglas: `missionsStart: '2026-11-02'`, `missionRewards: {habit: 30, tasks: 40, perfect: 50, xp: 40}`, `missionTasksMin: 5`, `missionTasksMax: 10`, `missionPerfectDays: 3`, `missionXpMin: 100`.
- `interface Mission { id: string; week: LocalDate; kind: 'habit'|'tasks'|'perfect'|'xp'; habitId: string|null; target: number; progress: number; reward: number; doneOn: LocalDate|null }`. `id` = `` `${week}|${kind}|${n}` ``.
- `selectMissions({week, habits, prevTasksDone, prevXp, rules}): Omit<Mission,'progress'|'doneOn'>[]`: 3 misiones.
  - Elegibles: con `startDate < week`, sin borrar ni archivar ese lunes, y programados esa semana.
  - Con elegibles: una de `habit` (el de menor `fnv1a(week|id)`), una de `tasks`, y `perfect` si `fnv1a(week)` es par, `xp` si es impar.
  - Sin elegibles: tres de `tasks` con objetivo base, +5 y +10.
  - Objetivos: `habit` = veces programadas esa semana (fijos: días; `timesPerWeek`: times; `timesPerMonth`: `ceil(times / 4)`); `tasks` = `clamp(prevTasksDone, 5, 10)`; `perfect` = 3; `xp` = `max(100, round(prevXp × 1.1 / 10) × 10)`.
- `interface WeekStats { week; xp; pesetas; scheduled; done; tasksDone; bestStreak; hatched; evolved; demoted; missionsDone; topHabitId: string|null }`.
- `GameState` gana `missions: Mission[]` (la semana de hoy) y `weeks: Record<LocalDate, WeekStats>`.

- [ ] **Step 1:** Tests de `missions.test.ts`, con los valores de arriba:
  - La misma selección al barajar los hábitos. Sin hábitos, tres de tareas con 5, 10 y 15.
  - `tasks` se queda entre 5 y 10 con 0 y con 30 tareas previas. `xp` con 50 XP previas da 100.
  - Progreso: 3 veces de un hábito de objetivo 3 cumple la misión, `doneOn` es ese día y el premio se suma a `pesetas` una sola vez.
  - Hoy: desmarcar lo que la cumplía quita el premio (Review Focus 5).
  - Historial anterior a `2026-11-02`: sin premios ni misiones (Review Focus 3).
  - Borrar o archivar el hábito a mitad de semana: la misión sigue con su progreso y las otras dos no cambian (Review Focus 4). Para esto la elegibilidad se evalúa con el estado de ese lunes (`isActiveOn(h, week)`), no con el actual.
  - Día perfecto: todo lo programado hecho; un día sin nada programado no cuenta; un día con un saltado sí, si el resto está hecho.
  - `weeks[...]`: totales de una semana conocida; `topHabitId` es el de más XP; una semana sin datos no existe.
- [ ] **Step 2:** Ejecutar → FALLA.
- [ ] **Step 3:** Implementar en el bucle de días: al entrar en un lunes `>= missionsStart`, seleccionar con los totales de la semana anterior; al final de cada día, actualizar progreso y abonar antes de los logros. Las compras siguen al final.
- [ ] **Step 4:** `pnpm check` → verde, incluida la propiedad de orden de los datos.

### Task 6: Frases

**Files:** Create `packages/core/src/game/phrases.ts`, `test/phrases.test.ts`. Modify `index.ts`.

**Interfaces — Produces:** `type PhraseMoment = 'saludo'|'feliz'|'triste'|'hecho'|'evolucion'`; `PHRASES: Record<SpeciesId, Record<PhraseMoment, string[]>>`; `pickPhrase(species, moment, seed: string): string` con `stableRandom`.

- [ ] **Step 1:** Tests: las 16 especies tienen al menos 5 frases por momento, no vacías y de 90 caracteres o menos; `pickPhrase` da lo mismo con la misma semilla y varía entre semillas.
- [ ] **Step 2:** Ejecutar → FALLA.
- [ ] **Step 3:** Escribir las frases originales, con la voz del catálogo de la spec de criaturas. Sin citas de obras con derechos, sin alusiones a personas reales modernas y con respeto en Blas de Lezo (héroe, no burla de sus heridas).
- [ ] **Step 4:** `pnpm check` → verde.

### Task 7: Misiones y frases en la interfaz

**Files:** Create `apps/app/src/features/creatures/MissionsCard.tsx`, `SpeechBubble.tsx`. Modify `TeamTab.tsx`, `TeamStrip.tsx`, `CreatureCard.tsx`, `CreatureSheet.tsx`, `features/habits/HabitRow.tsx`, `styles.css`.

**Interfaces:** Consumes `game.missions`, `pickPhrase`. Produces `<MissionsCard compact? />` y `<SpeechBubble text />`.

- [ ] **Step 1:** `MissionsCard`: título legible por tipo («Haz “Leer” 5 veces», «Completa 7 tareas», «3 días perfectos», «Gana 300 XP»), barra, premio y marca de cumplida. La versión `compact` va en `TeamStrip`; sin misiones no se pinta.
- [ ] **Step 2:** `SpeechBubble`. Semilla: `` `${habitId}|${today}|${moment}` ``. Momento en la tarjeta y la ficha según el ánimo: `feliz`, `triste` o `saludo`. En `HabitRow`, `hecho` junto al «+XP» durante el mismo tiempo. En `Celebration`, `evolucion`. En `TeamStrip`, una sola frase de la criatura elegida con `stableRandom(today)`.
- [ ] **Step 3:** `pnpm check`. Revisión en `pnpm dev:web?demo` a 1024 y 412 px, sin errores de consola y sin desbordes con las frases largas.

### Task 8: Resumen semanal

**Files:** Create `apps/app/src/features/creatures/WeekTab.tsx`, `WeekSummary.tsx`, `packages/core/src/game/week-summary.ts`. Modify `CreaturesView.tsx`, `App.tsx`. Test `packages/core/test/missions.test.ts`.

**Interfaces — Produces:** `summaryToShow(game: GameState, seen: LocalDate|null): LocalDate|null`: el lunes de la semana anterior si tuvo actividad (`xp > 0` o `tasksDone > 0`), y si es posterior a `seen`. Con `seen === null` devuelve `null` (primer arranque). `meta` `summary:seen`.

Desviación de la spec: en lugar de `weeklySummary(input, weekStart)`, el resumen lee `game.weeks[weekStart]`, que el motor ya calcula y evita recorrer el historial dos veces.

- [ ] **Step 1:** Tests de `summaryToShow`: primer arranque sin `seen` da null, y se guarda la semana actual sin mostrar nada (Review Focus 3); un lunes con semana anterior activa la devuelve; ya vista, null; sin actividad, null.
- [ ] **Step 2:** Ejecutar → FALLA.
- [ ] **Step 3:** `WeekSummary`: contenido compartido con XP, pesetas, % de hábitos, tareas, mejor racha, nacimientos, evoluciones, retrocesos, misiones y la criatura estrella con su imagen. Se muestra a pantalla completa desde `App` con el mismo patrón que `Celebration`, y después de las celebraciones.
- [ ] **Step 4:** `WeekTab`: pestaña **Semana** con flechas por `Object.keys(game.weeks)`; arranca en la anterior; sin semanas, estado vacío.
- [ ] **Step 5:** `pnpm check` y revisión en `pnpm dev:web?demo`.

### Task 9: Documentación, capturas y demo

**Files:** Modify `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `docs/screenshots/*`, `.github/workflows/build.yml` si hace falta.

- [ ] **Step 1:** `CLAUDE.md`: modelo de datos (migración 5, `events`, `creature_past`), misiones, semana, frases; arreglar lo que aún cita `deathWarning` y `features/.../farm`. Nueva fase 12. `README.md` y `CHANGELOG.md` con las novedades. Marcar la spec como aprobada.
- [ ] **Step 2:** Regenerar las capturas del README con Edge headless contra `pnpm dev:web` y `?demo&section=…`, como dice `CLAUDE.md`: Hoy, Calendario, Hábitos, Notas, Criaturas (nueva, sustituye a la granja) y móvil. Quitar `granja.png`.
- [ ] **Step 3:** Comprobar en `gh run list` si el trabajo `pages` publicó la demo en el último push a `main`. La demo se actualiza sola con el siguiente push: verificarla entonces con `curl` y en el navegador.
- [ ] **Step 4:** `pnpm check` y `pnpm test:rust` en verde.
