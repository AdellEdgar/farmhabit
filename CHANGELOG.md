# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [semántico](https://semver.org/lang/es/).

## [1.0.0] - 2026-10-29

Primera versión completa.

### Tareas

- Prioridad, etiquetas, fecha y hora límite, notas.
- Repeticiones (cada día, días de la semana, cada mes, último día del mes, cada año…).
- Varios avisos por tarea.
- Vistas Hoy, Próximas, Todas y Completadas; orden por fecha o inteligente.

### Hábitos

- Frecuencias: diaria, días concretos, N veces por semana o mes, cada N días.
- Cantidades con puntos parciales; marcar como saltado; rachas.
- Recordatorios; orden manual; estadísticas con gráfica de 30 días y calendario por hábito.

### Granja

- Puntos según la importancia de cada hábito (fallar lo fácil penaliza más), XP, niveles y grano.
- Bienestar diario, enfermedad, muerte permanente con aviso previo, curación y crías.
- Reglas contra trampas y modo vacaciones.
- Escena animada, tienda, logros y cementerio.

### Notas

- Editor visual, carpetas, etiquetas, notas fijadas y buscador.
- Notas privadas con contraseña propia y bloqueo automático.

### Calendario

- Vista de mes con tareas, detalle del día y agenda en Hoy.
- Suscripción a calendarios iCal por enlace e importación de archivos `.ics`.

### Datos y seguridad

- Todo local en SQLite; sin cuentas de FarmHabit.
- Sincronización automática y cifrada con Google Drive (carpeta oculta de la app).
- Copias de seguridad `.agx` cifradas (Argon2id + XChaCha20-Poly1305).

### Plataformas

- Windows, Linux (AppImage/.deb) y Android (APK).
- Actualizaciones automáticas firmadas en Windows y Linux; aviso de versión nueva en Android.
- Avisos del sistema, bandeja del sistema y arranque con el ordenador en escritorio.
- Temas predefinidos y editor de temas propios.
- Fuente Inter incluida en la app, para que se vea igual en todos los sistemas.
- En Android, la app respeta la barra de estado, los botones de navegación y el teclado.
- Demo web en GitHub Pages.

### Rendimiento

- La app arranca cargando un 65 % menos de código: el cifrado, el editor de notas y las secciones pesadas se descargan al usarlos.
- Solo se releen de la base de datos las colecciones que cambian, y la granja solo se recalcula si cambian los hábitos.
