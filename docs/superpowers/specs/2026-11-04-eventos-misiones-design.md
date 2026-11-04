# Eventos propios, resumen semanal, misiones y frases

Fecha: 2026-11-04 · Estado: aprobada

## Objetivo

1. Poder crear **eventos** en el calendario, sin tener que apuntar como tarea lo que es una cita o algo a lo que asistir.
2. Dar a las criaturas motivos a medio plazo y más personalidad: **resumen semanal**, **misiones** y **frases**.

Éxito = lo que antes se apuntaba como tarea se crea como evento en dos clics, con su aviso; al empezar la semana se ve cómo fue la anterior; siempre hay un objetivo semanal a la vista; y cada criatura se nota distinta de las demás.

Las decisiones marcadas como (asumido) las ha tomado Claude sin preguntar: son las primeras que hay que revisar.

## Parte 1: eventos

### Qué es un evento

- Título, día de inicio y fin, hora de inicio y fin, o **día completo**.
- **Lugar y descripción**, **avisos** y **repetición**, con los mismos controles que las tareas (asumido).
- Sin color propio: todos usan un color fijo, el `--fh-info` (asumido).
- No se completa ni da pesetas o XP: no entra en `computeGame`.
- Se sincroniza y viaja en las copias.
- Editar o borrar un evento repetido afecta a **toda la serie**; no hay excepciones por día (asumido).

### Datos

Migración 5, tabla sincronizable `events`: `title`, `location`, `description`, `all_day`, `start_date`, `start_time`, `end_date`, `end_time`, `rrule`, `reminders` (JSON, como en las tareas). Fechas y horas en hora local de pared. Un evento debe terminar después de empezar (validado con zod). Al borrar se vacía su contenido, como en tareas y notas.

### Núcleo

- `domain/events.ts`: `eventsInRange(events, from, to)` devuelve cada ocurrencia en el rango, con las repeticiones ya expandidas. Tope de 2000 ocurrencias por evento, como en `.ics`.
- `remindersBetween` también devuelve avisos de eventos, con el mismo formato que los de tareas.
- `services/events.ts`: `createEvent`, `updateEvent`, `deleteEvent` y `taskToEvent(db, taskId)`.

### Interfaz

- Botón **Evento** junto a **Tarea** en el Calendario. Pulsar un evento propio abre su editor; los de calendarios suscritos siguen siendo de solo lectura.
- Aparece en las cuatro vistas y en la agenda de Hoy, a través de `calendar-items.ts`.
- **Convertir en evento** en el editor de tareas (asumido): crea el evento con el título, la fecha, la hora, la descripción, los avisos y la repetición de la tarea, y borra la tarea. Sirve para lo que ya tienes apuntado como tarea. Una tarea sin fecha no se puede convertir. Las subtareas se pierden y se avisa antes de confirmar.

## Parte 2: resumen, misiones y frases

Todo se **calcula** desde el historial, como el resto del juego. Los números van en `creature-rules.ts`.

### Resumen semanal

- `weeklySummary(input, weekStart)`: XP y pesetas ganadas, porcentaje de hábitos cumplidos, tareas completadas, mejor racha, nacimientos, evoluciones, retrocesos, misiones cumplidas y la criatura que más XP ganó.
- La semana va de lunes a domingo. La primera vez que se abre la app a partir del lunes se muestra a pantalla completa, una vez por dispositivo (`meta` `summary:seen`), y solo si la semana tuvo actividad (asumido).
- También se puede abrir desde una pestaña nueva, **Semana**, en Criaturas, con flechas para ver semanas anteriores.

### Misiones

- **3 misiones por semana**, elegidas de forma determinista con un hash de la semana y los hábitos que ya existían ese lunes: la misma selección en todos los dispositivos, sin guardar nada.
- Tipos: hacer un hábito concreto N veces (N = lo programado para esa semana), completar N tareas (entre 5 y 10, según lo que hiciste la semana anterior), N días perfectos (todo lo programado hecho) y ganar N XP.
- Premio: 30, 40 o 50 pesetas según el tipo (asumido). Se abona solo el día que se cumple; **no** suman XP.
- Solo cuentan desde la semana del **2 de noviembre de 2026**: si no, tu historial daría de golpe pesetas de todas las semanas pasadas.
- Sin hábitos no hay misiones de hábitos; se sustituyen por misiones de tareas.
- Se ven en **Criaturas → Equipo** y en **Tu equipo** de Hoy, con su progreso.

### Frases

- `game/phrases.ts`: unas 5 frases originales por especie para cada momento (saludo, feliz, triste, al hacer el hábito, al evolucionar). Son unas 400 frases, escritas para cada personaje: Cervantes con tono de escritor, el yorkshire de jefe gruñón, el perezoso quejándose de sueño… Sin citas de obras con derechos.
- Se elige una por criatura, momento y día con `stableRandom`: no cambia cada vez que se pinta.
- Bocadillo en la ficha, en la tarjeta del equipo y unos segundos al marcar el hábito. En Hoy, una sola frase de una criatura distinta cada día.

### Colección al cambiar de especie

Cambiar de especie ya no quita la anterior de la colección. El hábito gana la columna `creature_past` (JSON, migración 5): `[{species, maxStage}]`. Lo que se ve de cada especie es la unión de estos datos con la actual.

## Compatibilidad

- Los archivos de versiones anteriores no traen `events` y entran como lista vacía. Una versión antigua ignora las colecciones que no conoce.
- `creature_past` lleva valor por defecto en zod. Se amplía `keepCreatureFields` para conservarlo si el archivo viene de un esquema anterior al 5.

## Pruebas

- **Eventos:** repeticiones, días completos, eventos de varios días, cambio de hora, validación del fin, avisos, conversión desde tarea, fusión.
- **Resumen:** totales de una semana conocida, semana sin actividad.
- **Misiones:** misma selección sea cual sea el orden de los datos, progreso, premio una sola vez, nada antes de la fecha de inicio, sin hábitos.
- **Frases:** todas las especies tienen frases en todos los momentos; la elección es estable durante el día.
- **Colección:** una especie abandonada sigue vista.
- Revisión visual en `pnpm dev:web` en escritorio y móvil.

## Después

Capturas nuevas del README y demo web actualizada, cuando esté todo.

## Fuera de alcance

Excepciones en eventos repetidos, color por evento, sincronizar con Google Calendar, misiones personalizadas, notificación del resumen.
