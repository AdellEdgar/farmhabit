# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [semántico](https://semver.org/lang/es/).

## [2.0.0] - sin publicar

FarmHabit pasa a llamarse **¡Chambea!** y la granja se sustituye por criaturas.

### Criaturas

- Cada hábito tiene su criatura: 16 especies (figuras históricas caricaturizadas y monstruitos propios) con 4 etapas cada una, más el huevo.
- Gana XP al hacer su hábito y la pierde al fallarlo (fallar lo fácil castiga más); evoluciona con la XP y retrocede si la descuidas, pero nunca muere.
- Ánimo según los últimos días, celebración al nacer o evolucionar y aviso a las 20:00 si alguna va a retroceder.
- Nivel de entrenador que desbloquea especies, colección con las 64 etapas y logros nuevos.
- Fondos y auras gratis para cada criatura, y comodines que protegen solos un día malo: se ganan cumpliendo las misiones de hábitos de la semana.
- Selector de criatura al crear o editar un hábito, con sugerencia según el nombre.

### Cambios

- La sección Granja pasa a ser Criaturas; los datos de la granja se conservan pero ya no se usan.
- El instalador, el acceso directo y los archivos de descarga siguen llamándose FarmHabit, para que la versión nueva se instale encima de la anterior.

### Libros

- Sección **Libros** con estanterías, búsqueda en Open Library por título, autor o ISBN, ficha con progreso, nota, reseña y citas, reto anual, estadísticas y "Leyendo ahora" en Hoy. No intervienen en el juego.

### Sin pesetas

- Se quitan las pesetas y la tienda: todos los fondos y auras son gratis.
- Las recompensas pasan a XP de entrenador: tareas (5, 3 o 2 según prioridad, hasta 25 al día), misiones y logros. Se conservan lo ya conseguido y los comodines comprados.

### Eventos

- Crea **eventos** en el calendario: día completo o con hora, lugar, descripción, avisos y repetición. Se ven en todas las vistas y en la agenda de Hoy. Editar o borrar uno que se repite afecta a toda la serie.
- **Convertir en evento** desde el editor de una tarea con fecha, para lo que tenías apuntado como tarea.

### Misiones, resumen y frases

- **3 misiones por semana** con premio en XP de entrenador: hacer un hábito, completar tareas, días perfectos o ganar XP. Cuentan desde la semana del 2 de noviembre de 2026.
- **Resumen semanal** al empezar la semana, una vez por dispositivo, y pestaña **Semana** en Criaturas para ver las anteriores.
- **400 frases** escritas para cada especie, en su tarjeta, en su ficha, al hacer el hábito, al evolucionar y en Hoy.
- Cambiar de especie ya no quita la anterior de la colección.

### Arreglos del juego

- El aviso de las 20:00 avisa solo de las criaturas que retrocederían de verdad, no de las que simplemente están tristes.
- El "+XP" al marcar un hábito coincide con lo que se gana, racha incluida.
- Comodines limitados a 2.

### Tareas

- Subtareas: se añaden, renombran, marcan y borran desde la tarea, y se ven en la lista con su progreso. Al completarlas todas, la tarea se completa sola; en las que se repiten, pasa a la siguiente fecha con las subtareas por hacer.
- La prioridad se muestra como barras de cobertura: 1 barra verde (baja), 2 amarillas (media) o 3 rojas (alta).

### Quitado

- El asistente con IA de la v1.1.0-rc.1: para esta app no hacía falta.

## [1.0.0] - 2026-10-29

Primera versión completa.

### Tareas

- Prioridad, etiquetas, fecha y hora límite, y descripción visible entera en la lista.
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

- Vistas de mes, semana y día (por horas, con los solapes uno al lado del otro) y agenda de 30 días; en escritorio el mes muestra todo lo de cada día.
- Agenda del día en Hoy.
- Suscripción a calendarios iCal por enlace e importación de archivos `.ics`.

### Datos y seguridad

- Todo local en SQLite; sin cuentas de FarmHabit.
- Sincronización automática y cifrada con Google Drive (carpeta oculta de la app): tras cada cambio, cada 5 minutos y al volver a la app.
- Copias de seguridad `.agx` cifradas (Argon2id + XChaCha20-Poly1305).

### Plataformas

- Windows, Linux (AppImage/.deb) y Android (APK).
- Actualizaciones automáticas firmadas en Windows y Linux; aviso de versión nueva en Android.
- Avisos del sistema, bandeja del sistema y arranque con el ordenador en escritorio.
- Temas predefinidos y editor de temas propios.
- En escritorio, cada sección aprovecha el ancho de la ventana.
- Fuente Inter incluida en la app, para que se vea igual en todos los sistemas.
- En Android, la app respeta la barra de estado, los botones de navegación y el teclado.
- Demo web en GitHub Pages.

### Rendimiento

- La app arranca cargando un 65 % menos de código: el cifrado, el editor de notas y las secciones pesadas se descargan al usarlos.
- Solo se releen de la base de datos las colecciones que cambian, y la granja solo se recalcula si cambian los hábitos.
