# ¡Chambea! (criaturas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la granja por criaturas que evolucionan con cada hábito, con nivel de entrenador, pesetas, comodines, tienda cosmética, y renombrar la app a ¡Chambea!.

**Architecture:** Motor puro y determinista en `packages/core/src/game/` que recalcula todo desde el historial (como `computeFarm`), con datos nuevos mínimos (columnas de criatura en `habits` y tabla `purchases`). La app sustituye la sección Granja por Criaturas y lee el estado del motor desde `useApp()`. Las imágenes llegan después: hasta entonces, marcador con emoji.

**Tech Stack:** TypeScript 6, React 19, Tailwind 4, Vitest + fast-check, SQLite (migraciones SQL congeladas), zod 4, Tauri 2, `sharp` (solo script de imágenes).

**Spec:** `docs/superpowers/specs/2026-11-03-chambea-criaturas-design.md` (léela entera antes de empezar; los números salen de ahí). Prompt de imágenes: `docs/arte/prompt-imagenes.md`.

## Global Constraints

- **No commitear ni hacer push** (regla del proyecto): cada tarea termina con `pnpm check` en verde y los cambios sin commitear; el usuario hace los commits.
- Interfaz, documentación y comentarios en español; identificadores en inglés.
- El núcleo no importa React, Tauri ni DOM (lo vigila ESLint).
- El identificador `io.github.adelledgar.farmhabit`, la clave de actualizaciones y la URL de `latest.json` **no cambian**.
- Migraciones: nunca editar las existentes; se añade la 3.
- Todos los números del juego en `creature-rules.ts`; ninguno escrito a mano en la UI.
- El estado del juego **no se guarda**: se calcula. Resultado independiente del orden de los datos.
- Nada de personajes protegidos: respetar los "límites de estilo" de la spec.

## Review Focus

1. **Dispositivo con versión antigua** que sube hábitos sin los campos de criatura: el parseo no debe fallar (valores por defecto) y la criatura se ve con su especie provisional. → Test en Task 2.
2. **Borrar o archivar un hábito** no debe bajar el nivel de entrenador ni las pesetas ganadas (anti-trampas, como ahora). → Test en Task 3.
3. **Cambio de esfuerzo a mitad de historial**: la XP de antes se calcula con el esfuerzo de antes. → Test en Task 3.
4. **Compras simultáneas desde dos dispositivos** que dejan las pesetas en negativo: las pesetas se quedan en 0 y lo comprado sigue comprado; la app no se rompe. → Test en Task 4.
5. **Tarea completada y luego reabierta** (o borrada): deja de dar pesetas; una tarea creada y completada el mismo día no da nada. → Test en Task 4.

---

### Task 1: Catálogo de especies y reglas

**Files:**

- Create: `packages/core/src/game/species.ts`, `packages/core/src/game/creature-rules.ts`
- Modify: `packages/core/src/index.ts` (exportar ambos)
- Test: `packages/core/test/creatures.test.ts` (nuevo)

**Interfaces:**

- Produces:
  - `type SpeciesId = 'panda' | 'tortuga' | 'rottweiler' | 'yorkshire' | 'napoleon' | 'cervantes' | 'leonidas' | 'cesar' | 'medusa' | 'poseidon' | 'blas' | 'rana' | 'pulpo' | 'balon' | 'perezoso' | 'mimo'`
  - `interface SpeciesInfo { id: SpeciesId; name: string; unlockLevel: number; stageNames: [string, string, string, string]; emoji: string; keywords: string[] }` y `const SPECIES: readonly SpeciesInfo[]` (orden y niveles de la tabla de la spec; `stageNames` son títulos cortos, p. ej. "Pandita"; `emoji` es el marcador provisional; `keywords` para sugerir, p. ej. tortuga: `['leer', 'libro', 'lectura']`).
  - `speciesById(id: string): SpeciesInfo | undefined`, `suggestSpecies(habitName: string, unlocked: SpeciesId[]): SpeciesId`, `defaultSpecies(habitId: string): SpeciesId` (determinista con `fnv1a`, solo entre las de nivel 1).
  - `type Stage = 0 | 1 | 2 | 3 | 4`, `type Mood = 'feliz' | 'normal' | 'cansada' | 'triste'`.
  - `interface CreatureRules` + `DEFAULT_CREATURE_RULES` con: `xpBase 10`, `xpPerEffort 5`, `penaltyPerMissingEffort 5`, `penaltyBase 6`, `streakBonusPerWeek 0.05`, `streakBonusMax 0.5`, `stageXp [0, 50, 500, 1500, 4000]`, `demoteRatio 0.8`, `moodWindow 7`, `moodMinDays 3`, `moodBands {feliz 0.8, normal 0.5, cansada 0.2}`, `pesetasPerEffort 1`, `taskPesetas {1: 3, 2: 2, 3: 1}`, `taskPesetasDailyCap 15`, `freezePrice 50`, `freezeMax 2`, `backgroundPrice 150`, `auraPrice 200`, `BACKGROUNDS ['coliseo','barco','biblioteca','playa','dojo','estadio','templo','cine']`, `AURAS ['dorada','confeti','llamas','estrellas']`.
  - `nextStage(xp: number, current: Stage, rules?): Stage` (sube por umbral; baja solo si `xp < demoteRatio × stageXp[current]`, y entonces recalcula hacia abajo).
  - `trainerLevel(xp: number): number` (`n` desde `100·n·(n−1)`, igual que `levelForXp` actual).
  - `unlockedSpecies(level: number): SpeciesId[]`.

- [ ] **Step 1: Tests** en `creatures.test.ts`, `describe('catálogo y reglas')`: 16 especies con ids únicos; 6 con `unlockLevel` 1 y exactamente 2 por nivel del 2 al 6; `nextStage(49, 0) === 0`, `nextStage(50, 0) === 1`, `nextStage(4000, 1) === 4`; retroceso con margen: `nextStage(401, 2) === 2`, `nextStage(399, 2) === 1`, `nextStage(10, 3) === 0`; `trainerLevel(0) === 1`, `trainerLevel(200) === 2`; `unlockedSpecies(1).length === 6`, `unlockedSpecies(6).length === 16`; `suggestSpecies('Leer 20 páginas', unlockedSpecies(1)) === 'tortuga'`; `defaultSpecies(x)` siempre de nivel 1 y estable.
- [ ] **Step 2:** `pnpm --filter @farmhabit/core test -- creatures` → FAIL (módulos no existen).
- [ ] **Step 3:** Implementar `species.ts` y `creature-rules.ts`. `suggestSpecies`: primera especie desbloqueada con alguna keyword contenida en el nombre (sin acentos ni mayúsculas); si ninguna, `defaultSpecies` del nombre.
- [ ] **Step 4:** Tests en verde y `pnpm check`.

### Task 2: Datos (migración 3, `purchases`, campos de criatura)

**Files:**

- Modify: `packages/core/src/db/migrations.ts` (migración 3), `db/tables.ts`, `model/schemas.ts`, `model/types.ts`, `model/collections.ts`, `services/habits.ts`
- Test: `packages/core/test/db.test.ts`, `packages/core/test/merge.test.ts`, `packages/core/test/habits.test.ts`

**Interfaces:**

- Produces:
  - `Habit` gana `creatureSpecies: string | null`, `creatureName: string`, `creatureBackground: string | null`, `creatureAura: string | null` (zod con `.default(null)` / `.default('')` para datos antiguos).
  - Colección `purchases`: `Purchase { ...sync, item: string; date: LocalDate; price: number }` (`item` = `'freeze' | 'background:<id>' | 'aura:<id>'`, validado con regex). Se añade a `COLLECTIONS` al final.
  - `NewHabitInput` gana `creatureSpecies?: SpeciesId`, `creatureName?: string`.
  - Migración 3 (`name: 'criaturas'`): `ALTER TABLE habits ADD COLUMN creature_species TEXT`, `creature_name TEXT NOT NULL DEFAULT ''`, `creature_background TEXT`, `creature_aura TEXT`, y `CREATE TABLE purchases (${SYNC_COLUMNS}, item TEXT NOT NULL, date TEXT NOT NULL, price INTEGER NOT NULL)`.

- [ ] **Step 1: Tests:**
  - `db.test.ts`: "la migración 3 conserva hábitos y animales y añade criaturas": BD migrada a 2 con un hábito y un animal → migrar a 3 → el hábito tiene `creatureSpecies === null`, `creatureName === ''`, el animal sigue ahí, `purchases` vacía.
  - `merge.test.ts`: "un hábito sin campos de criatura (versión antigua) se importa con valores por defecto" (Review Focus 1): payload con un hábito sin esas claves → `parse` no falla y quedan los defaults. Y "las compras viajan en la copia": exportar/importar con una `purchase` la conserva.
  - `habits.test.ts`: `createHabit` guarda `creatureSpecies` y `creatureName`.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar. `SCHEMA_VERSION` pasa a 3 automáticamente.
- [ ] **Step 4:** Tests en verde y `pnpm check`.

### Task 3: Motor de criaturas (XP, etapas, ánimo, entrenador)

**Files:**

- Create: `packages/core/src/game/creatures.ts`
- Test: `packages/core/test/creatures.test.ts`

**Interfaces:**

- Consumes: Task 1 (reglas, `nextStage`, `trainerLevel`, `unlockedSpecies`, `defaultSpecies`), Task 2 (`Habit`, `Purchase`), `domain/habits` (`configOn`, `isActiveOn`, `isScheduledOn`, `isFlexible`, `logRatio`, `periodOf`), `isVacationDay` (moverlo de `engine.ts` a `game/vacations.ts`).
- Produces:
  - `interface GameInput { habits: Habit[]; logs: HabitLog[]; tasks: Task[]; taskCompletions: TaskCompletion[]; purchases: Purchase[]; vacations: Vacation[]; today: LocalDate; rules?: CreatureRules }` (`habits` incluye archivados y borrados).
  - `type CreatureEvent = { date: LocalDate; type: 'hatch' | 'evolve' | 'demote'; stage: Stage }`.
  - `interface Creature { habitId: string; species: SpeciesId; name: string; xp: number; stage: Stage; mood: Mood; streak: number; history: CreatureEvent[]; xpToday: number; archived: boolean; background: string | null; aura: string | null; maxStageEver: Stage }`.
  - `interface GameState { today; creatures: Creature[] /* sin borrados, en orden de sortKey */; trainerXp: number; level: number; unlockedSpecies: SpeciesId[]; pesetas: number; freezes: number; frozenDays: LocalDate[]; owned: string[]; achievements: Achievement[]; seenStages: Record<SpeciesId, Stage[]>; alerts: { habitId: string; name: string }[] }` (`alerts` = criaturas tristes con hábito pendiente hoy). Pesetas, comodines y logros los rellena la Task 4; aquí devolver `pesetas 0`, `freezes 0`, `frozenDays []`, `owned []`, `achievements []`.
  - `computeGame(input: GameInput): GameState`.

- [ ] **Step 1: Tests** (`describe('motor de criaturas')`, con `makeHabit`/`makeLog` de `test/helpers/fixtures.ts`):
  - hecho con esfuerzo 3 da 25 XP; fallado (día cerrado) con esfuerzo 1 resta 25 y con esfuerzo 5 resta 5;
  - hoy sin hacer no resta; hoy hecho suma y aparece en `xpToday`;
  - saltado, no programado y vacaciones son neutros;
  - frecuencia `timesPerWeek 3` con 2 hechos: al cerrar el domingo resta el que falta;
  - la XP nunca baja de 0;
  - etapas: 2 días hechos (esfuerzo 3) → etapa 1 e `history` con `hatch`; caer por debajo del 80 % del umbral → `demote` en `history`;
  - ánimo: 7 de 7 hechos → `feliz`; 1 de 7 → `triste`; menos de 3 días → `normal`;
  - bonus de racha: tras 7 días seguidos, el 8.º da `25 × 1.05` redondeado;
  - entrenador: `trainerXp` = suma de lo **ganado** (no resta) y `level = trainerLevel(trainerXp)`;
  - Review Focus 2: borrar (tombstone) o archivar un hábito no baja `trainerXp`; el borrado no aparece en `creatures`, el archivado aparece con `archived: true` y su XP no cambia en días posteriores;
  - Review Focus 3: esfuerzo 1 hasta el día 10 y 5 desde el 11 → las ganancias usan el esfuerzo de cada día;
  - hábito sin especie → `species === defaultSpecies(habit.id)`;
  - propiedad (fast-check): barajar `habits` y `logs` no cambia el resultado.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar `computeGame`: un bucle de días desde el primer `startDate` hasta hoy, reutilizando la lógica de programación, flexibles y racha de `engine.ts` (copiarla y adaptarla; `engine.ts` se borra en la Task 5). XP por hecho `round(ratio × (xpBase + xpPerEffort × effort) × multiplicadorRacha)`; penalización `round((1 − ratio) × penaltyPerMissingEffort × (penaltyBase − effort))` solo en días cerrados, no neutros. Etapa y eventos al cierre de cada día (y provisionalmente hoy, solo subidas). Ánimo con los últimos `moodWindow` días programados cerrados no neutros.
- [ ] **Step 4:** Tests en verde y `pnpm check`.

### Task 4: Pesetas, comodines, tienda y logros

**Files:**

- Modify: `packages/core/src/game/creatures.ts`, `packages/core/src/game/achievements.ts` (reescribir), `packages/core/src/services/farm.ts` → renombrar a `services/shop.ts` (mantener `scheduleVacation`, `endVacation`, `MAX_VACATION_DAYS`; quitar `buyAnimal` y compañía)
- Test: `packages/core/test/creatures.test.ts`, `packages/core/test/farm-actions.test.ts` → renombrar a `shop.test.ts`

**Interfaces:**

- Consumes: Task 3.
- Produces:
  - En `GameState`: `pesetas`, `freezes` (guardados), `frozenDays`, `owned` (ids de fondos y auras comprados), `achievements`.
  - `interface Achievement { id: string; title: string; description: string; reward: number; unlockedOn: LocalDate | null }` con los ids `primera-eclosion`, `primer-joven`, `primer-adulto`, `primera-leyenda`, `tres-leyendas`, `racha-7`, `racha-30`, `racha-100`, `tareas-10`, `tareas-100`, `coleccion-completa`, `ahorrador` (premios: 20, 30, 50, 100, 200, 20, 60, 200, 20, 100, 300, 50).
  - `class ShopError extends Error`; `buyItem(db: Database, item: string, game: GameState, today: LocalDate): Promise<Purchase>` (valida: item conocido, no comprado ya —salvo `freeze`—, `freezes < freezeMax`, pesetas suficientes).

- [ ] **Step 1: Tests:**
  - pesetas: hábito hecho con esfuerzo 4 da 4; logro desbloqueado suma su premio; compra resta su precio el día de `date`;
  - tareas: alta 3, media 2, baja 1; creada el mismo día que se completa → 0; tope de 15 al día; una ocurrencia de recurrente (en `taskCompletions`) cuenta; Review Focus 5: tarea reabierta (`completedAt` null) o borrada → deja de contar;
  - comodín: comprado el día 5, el día 7 se falla un hábito → el día 7 es neutro (sin penalización ni ruptura de racha), `freezes` baja a 0 y `frozenDays` incluye el 7; un día sin fallos no lo gasta; nunca protege el día de la compra ni anteriores;
  - Review Focus 4: dos compras que dejan el saldo en negativo → `pesetas === 0` y ambos items en `owned`;
  - logros: `unlockedOn` es la fecha en que se cumplió; `coleccion-completa` cuando las 16 especies tienen alguna etapa ≥ 1 vista;
  - `shop.test.ts`: `buyItem` rechaza sin pesetas, con 2 comodines guardados y un fondo ya comprado; vacaciones como antes.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar. Orden del día: compras del día (restan) → hábitos (XP y pesetas) → si el día cerrado tiene fallos y hay comodín disponible, se anula su penalización y racha de ese día → tareas → logros nuevos. Pesetas `max(0, …)` en cada paso.
- [ ] **Step 4:** Tests en verde y `pnpm check`.

### Task 5: Retirar la granja y conectar el motor en la app

**Files:**

- Delete: `packages/core/src/game/engine.ts`, `game/game-rules.ts`, `packages/core/test/game.test.ts`, `apps/app/src/features/farm/` (entera)
- Modify: `packages/core/src/index.ts`, `apps/app/src/lib/app-context.tsx`, `lib/use-app.ts`, `lib/reminder-text.ts`, `lib/ReminderScheduler.tsx`, `lib/MobileReminderScheduler.tsx`, `App.tsx`, `features/habits/HabitsView.tsx`, `features/today/TodayView.tsx` (quitar `FarmSummary`), `lib/demo-data.ts`
- Test: `pnpm check` + revisión en `pnpm dev:web`

**Interfaces:**

- Consumes: `computeGame` (Task 3–4).
- Produces: `useApp()` expone `game: GameState` en lugar de `farm`. `creatureAlertText(game): NotificationText | null` sustituye a `farmAlertText` (mismo horario `FARM_ALERT_TIME`, renombrado `CREATURE_ALERT_TIME`): "{nombre} está triste: si hoy no haces «{hábito}», retrocederá". `Section` cambia `'granja'` por `'criaturas'` (icono `PawPrint` de lucide); el punto rojo del menú sale si `game.alerts.length > 0`. `HabitsView` muestra la XP del día con `game.creatures`.

- [ ] **Step 1:** Añadir `purchases` a `FIELDS` y a `AppData` (y quitar `animals`) y sustituir el `useMemo` de la granja por `computeGame` con dependencias `allHabits` (ya incluye los borrados, necesarios para el Review Focus 2), `habitLogs, tasks, taskCompletions, purchases, vacations, today`.
- [ ] **Step 2:** Actualizar los avisos y sus textos; borrar la granja; `?section=granja` redirige a `criaturas`.
- [ ] **Step 3:** Datos de ejemplo: especie y nombre en cada hábito, algunas compras; sin animales.
- [ ] **Step 4:** `pnpm check` en verde; en `pnpm dev:web?demo` no hay errores de consola (la sección Criaturas puede ser un marcador hasta la Task 7).

### Task 6: Imágenes (script, carga y marcadores)

**Files:**

- Create: `scripts/criaturas.mjs`, `apps/app/src/features/creatures/CreatureImage.tsx`, `apps/app/src/features/creatures/assets.ts`
- Modify: `.gitignore` (`art/`), `package.json` (script `criaturas` y `sharp` en devDependencies), `docs/arte/prompt-imagenes.md` (sección "Después de generarlas")
- Test: ejecución del script con PNG de prueba

**Interfaces:**

- Produces:
  - `node scripts/criaturas.mjs`: lee `art/criaturas/*.png` (nombres de la spec), recorta el margen transparente, centra en cuadrado y escribe `apps/app/src/assets/criaturas/<nombre>-512.webp` y `-128.webp` (fondos solo 1024 → `fondo-<id>.webp`); avisa de los archivos que faltan respecto a la lista esperada.
  - `assets.ts`: `creatureImageUrl(species: SpeciesId, stage: Stage, size: 128 | 512): string | null` y `backgroundUrl(id): string | null` con `import.meta.glob('../../assets/criaturas/*.webp', { eager: false, query: '?url' })` (null si no existe la imagen).
  - `<CreatureImage species stage size mood? aura? className? />`: imagen o, si no hay, marcador (huevo 🥚 o `emoji` de la especie en un círculo de color); aplica clases de ánimo y aura.
- [ ] **Step 1:** Escribir el script y probarlo con 2 PNG generados a mano (p. ej. con `sharp` en un script temporal) → salen los WebP y el aviso de faltantes.
- [ ] **Step 2:** Componente y estilos de ánimo en `styles.css` (`.mood-feliz` salto suave, `.mood-cansada` opacidad y bostezo, `.mood-triste` gris + nube; respetar `prefers-reduced-motion`) y auras (`.aura-dorada`, `-confeti`, `-llamas`, `-estrellas`, solo CSS).
- [ ] **Step 3:** `pnpm check`.

### Task 7: Sección Criaturas

**Files:**

- Create: `apps/app/src/features/creatures/CreaturesView.tsx` (pestañas), `TeamTab.tsx`, `CollectionTab.tsx`, `ShopTab.tsx`, `CreatureCard.tsx`, `CreatureSheet.tsx`, `TrainerCard.tsx`; mover `VacationCard.tsx` y los logros aquí (`AchievementsTab.tsx`)
- Modify: `App.tsx` (lazy `CreaturesView`)
- Test: revisión en `pnpm dev:web?demo&section=criaturas` a 1280 px y 412 px

**Interfaces:**

- Consumes: `useApp().game`, `CreatureImage`, `buyItem`, `SPECIES`, `DEFAULT_CREATURE_RULES`.
- Produces: `CreatureSheet({ habitId, onClose })` (la usan Hoy y Hábitos). Editar nombre, especie (solo desbloqueadas), fondo y aura (solo `owned`) actualiza el hábito con `db.repo('habits').update`.

- [ ] **Step 1:** Equipo: `TrainerCard` (nivel, barra con `trainerLevel`, pesetas, comodines) + rejilla de `CreatureCard` (imagen, nombre, especie, hábito, barra hasta la siguiente etapa con `stageXp`, ánimo) + "Descansando" plegado.
- [ ] **Step 2:** Colección: 16 × 4 con `seenStages` (color / silueta con `brightness-0 opacity-30` / candado y "Nivel N").
- [ ] **Step 3:** Tienda (comodín, 8 fondos, 4 auras, precio, botón deshabilitado con motivo) y Logros + Vacaciones.
- [ ] **Step 4:** `CreatureSheet`: imagen 512 con fondo y aura, progreso, `history` legible ("Eclosionó el 3 nov"), últimos 7 días, enlace a estadísticas del hábito.
- [ ] **Step 5:** Revisión visual en escritorio y móvil y `pnpm check`.

### Task 8: Hábitos, Hoy y celebraciones

**Files:**

- Create: `apps/app/src/features/creatures/Celebration.tsx`, `features/creatures/TeamStrip.tsx`
- Modify: `features/habits/HabitRow.tsx`, `features/habits/HabitEditor.tsx`, `features/today/TodayView.tsx`, `App.tsx`
- Test: revisión en `pnpm dev:web?demo`

**Interfaces:**

- Consumes: `CreatureSheet`, `CreatureImage`, `suggestSpecies`, `game.creatures[].history`.
- Produces: `meta` `creatures:seen:<habitId>` (última etapa celebrada en este dispositivo).

- [ ] **Step 1:** `HabitRow`: avatar 40 px de la criatura en lugar del emoji (abre la ficha); al marcar como hecho, "+N XP" flotante (N = XP ganada) y salto del avatar.
- [ ] **Step 2:** `HabitEditor`: rejilla de especies desbloqueadas (preseleccionada con `suggestSpecies` al escribir el nombre, si el usuario no ha elegido) y campo "Nombre de la criatura"; bloqueadas con candado. Para hábitos sin especie, aviso "Elige su criatura".
- [ ] **Step 3:** `TeamStrip` en Hoy (caritas con ánimo, nivel y pesetas; abre Criaturas).
- [ ] **Step 4:** `Celebration`: al cargar, para cada criatura con etapa mayor que la guardada en `meta`, pantalla completa con la nueva imagen ("¡{nombre} ha evolucionado a {etapa}!", "¡{nombre} ha nacido!"); la primera vez solo guarda sin celebrar (para no lanzar decenas al actualizar). Retroceso: aviso (`toast`) discreto.
- [ ] **Step 5:** Revisión visual y `pnpm check`.

### Task 9: ¡Chambea! (nombre, iconos, documentación)

**Files:**

- Modify: `packages/core/src/index.ts` (`APP_NAME = '¡Chambea!'`), `apps/app/src-tauri/tauri.conf.json` (`productName: "Chambea"`, título de ventana, descripciones), `apps/app/index.html` (`<title>`), `src-tauri/src/lib.rs` (textos de bandeja), textos con "FarmHabit" en la app, `README.md`, `CLAUDE.md` (reglas del juego nuevas, estructura, fases), `CHANGELOG.md` (versión 2.0.0 sin fecha), `docs/*.md`, `.github/workflows/build.yml` (nombres de artefactos y copia de iconos Android), `src-tauri/icons/*`
- Test: `pnpm check`, `pnpm test:rust`, build de CI

- [ ] **Step 1:** Renombrar textos (`grep -ri farmhabit` fuera de identificadores, URLs del repo y `io.github.adelledgar.farmhabit`).
- [ ] **Step 2:** Iconos: cuando exista `art/criaturas/icono.png`, `pnpm --filter @farmhabit/app tauri icon ../../art/criaturas/icono.png` y en `build.yml`, tras `tauri android init`, copiar `src-tauri/icons/android/*` a `gen/android/app/src/main/res/`. Mientras no exista, dejar los iconos actuales.
- [ ] **Step 3:** Documentación: CLAUDE.md sustituye "Reglas del juego (granja)" por las de criaturas (números de `creature-rules.ts`), README con la sección nueva, docs de actualizaciones y Drive con el nombre nuevo.
- [ ] **Step 4:** `pnpm check` y `pnpm test:rust` en verde; dar al usuario los comandos de commit y de la etiqueta `v2.0.0-rc.1`.
