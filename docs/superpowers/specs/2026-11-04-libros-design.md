# Libros

Fecha: 2026-11-04 · Estado: aprobada

## Objetivo

Llevar en ¡Chambea! la lista personal de libros, sin depender de otra app. Es de uso personal: sin parte social. **Los libros no intervienen en el juego**: no dan pesetas, XP, logros ni misiones.

Éxito = añadir un libro con portada y datos en pocos segundos, apuntar la página en un momento desde Hoy y ver cuánto se ha leído este año, en todos los dispositivos.

## Funciones

- **Estanterías:** Leyendo, Por leer, Leídos y Abandonados. Se reutilizan las etiquetas de la app.
- **Añadir:** buscar por título, autor o ISBN, o escribirlo a mano. A mano siempre funciona, también sin internet.
- **Ficha:** estado, página actual con porcentaje, fechas de inicio y fin, nota de media en media estrella, reseña, etiquetas y citas con su página.
- **Reto anual:** "este año, N libros", con barra de progreso. Es un ajuste sincronizado (`books.goal.<año>`).
- **Estadísticas:** libros y páginas por año, libros por mes del año elegido, nota media, días medios por libro, páginas de los últimos 30 días y autores más leídos.
- **En Hoy:** tarjeta "Leyendo ahora" para apuntar la página. Sin libros en lectura no se pinta.

## Reglas del progreso

- La página se limita a entre 0 y el total de páginas, si se conoce.
- Apuntar página en un libro de Por leer o Abandonados lo pasa a Leyendo con la fecha de inicio de hoy, si no tenía.
- Llegar a la última página lo pasa a Leídos con la fecha de hoy. Bajar de la última página en un libro leído lo devuelve a Leyendo y quita la fecha de fin.
- Marcar Leído pone la página en el total, y la fecha de fin de hoy si no tenía.

## Datos

Migración 6, tablas sincronizables:

- `books`: `title`, `author`, `pages`, `cover_url`, `isbn`, `status` (`want`, `reading`, `read`, `abandoned`), `current_page`, `started_on`, `finished_on`, `rating`, `review`, `tag_ids`.
- `book_quotes`: `book_id`, `text`, `page`. Colección aparte, para fusionar cada cita por separado.
- `reading_logs`: id = UUIDv5(libro + fecha), `book_id`, `date`, `from_page`, `page`. Una fila por libro y día: lo leído ese día es `page − from_page`.

Al borrar un libro se borran sus citas y registros y se vacía su contenido. Las versiones anteriores ignoran estas colecciones sin perderlas.

## Búsqueda

- **Open Library** (`search.json`), gratuita y sin clave. Se probó con títulos en español: `q` + `lang=es` encuentra bien y su `editions` da el título y la portada de la edición en español. Google Books sin clave se descartó: la cuota compartida estaba agotada (error 429).
- Lo buscado se envía a Open Library, y las portadas se piden a su servidor al mostrarlas. Se avisa en el diálogo de búsqueda.
- Solo se guarda el enlace de la portada, para no inflar las copias. Solo se muestran enlaces de `https://covers.openlibrary.org/`, y la CSP permite ese dominio y `archive.org`, al que redirigen muchas portadas. Sin portada o sin internet, se pinta una de color con el título.

## Fuera de alcance

Escanear con la cámara, importar de Goodreads, marcar un hábito al apuntar páginas, relecturas y recomendaciones.

## Pruebas

Núcleo: progreso y sus cambios de estado, borrado en cascada, estadísticas, reto, parseo de la búsqueda, ISBN, migración y fusión. Interfaz: revisión en `pnpm dev:web` a 1024 y 360 px.
