# Añadir otros calendarios (universidad, Google, Outlook…)

FarmHabit puede mostrar en su **Calendario** y en **Hoy** los eventos de otros calendarios, junto a tus tareas. Solo los lee: nunca cambia nada en ellos.

Hay dos formas de añadirlos, desde **Calendario → Calendarios**:

| Forma                                     | Cuándo usarla                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Suscribirse a un enlace** (recomendado) | El calendario cambia a menudo, como los horarios y exámenes de la universidad. FarmHabit lo descarga solo cada 6 horas. |
| **Importar un archivo `.ics`**            | Solo tienes el archivo, o es algo que no cambia. Es una foto fija: si cambia, hay que volver a importarlo.              |

Los dos usan el formato estándar **iCalendar** (`.ics`), que exportan casi todos los calendarios.

## Conseguir el enlace

### Google Calendar

1. Entra en <https://calendar.google.com> desde el ordenador.
2. En la lista de la izquierda, pasa el ratón por el calendario → **⋮ → Configuración y uso compartido**.
3. Baja hasta **Integrar el calendario** y copia la **Dirección secreta en formato iCal** (termina en `basic.ics`).

> Es secreta: quien la tenga puede ver ese calendario. No la compartas.

### Outlook / Microsoft 365 (también el correo de muchas universidades)

1. Entra en Outlook en la web → **Configuración (⚙️) → Calendario → Calendarios compartidos**.
2. En **Publicar un calendario**, elige el calendario y **Puede ver todos los detalles** → **Publicar**.
3. Copia el enlace **ICS**.

### Calendario de la universidad

- **Aula virtual (Moodle):** en **Calendario → Exportar calendario**, elige qué eventos y el periodo, y pulsa **Obtener URL del calendario**.
- **Horarios y exámenes:** busca en la web de tu titulación o en la intranet una opción "Exportar", "iCal", "Suscribirse" o "Añadir a Google Calendar". Ese enlace (o el archivo `.ics` que descarga) es el que necesitas.
- Si solo aparece "Añadir a Google Calendar", añádelo allí y luego copia el enlace iCal de Google como se explica arriba.

### Apple Calendar (iCloud)

1. En el Mac o en <https://www.icloud.com/calendar>, pulsa el icono de compartir del calendario.
2. Activa **Calendario público** y copia el enlace (empieza por `webcal://`; FarmHabit lo acepta tal cual).

## Privacidad

- El enlace se guarda en tus datos de FarmHabit y se sincroniza cifrado con tus otros dispositivos, que descargan el calendario por su cuenta.
- Lo descargado se guarda solo en cada dispositivo y no viaja en las copias de seguridad.
- Solo se aceptan enlaces `https://` o `webcal://`.
