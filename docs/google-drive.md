# Configurar la sincronización con Google Drive

FarmHabit sincroniza tus dispositivos a través de una **carpeta oculta de la app** en tu Google Drive (`appDataFolder`):

- No aparece en tu Drive.
- FarmHabit no puede ver el resto de tus archivos.
- Todo se sube **cifrado** con tu frase secreta: Google no puede leerlo.

Para que la app pueda iniciar sesión con Google hace falta crear unas credenciales **una sola vez**. Son gratis y se tarda unos 10 minutos.

## 1. Crear el proyecto en Google Cloud

1. Entra en <https://console.cloud.google.com/> con tu cuenta de Google.
2. Arriba, en el selector de proyectos, pulsa **Nuevo proyecto**, llámalo `FarmHabit` y créalo.
3. Con el proyecto seleccionado, ve a **APIs y servicios → Biblioteca**, busca **Google Drive API** y pulsa **Habilitar**.

## 2. Pantalla de consentimiento

1. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth** (o **Google Auth Platform**).
2. Tipo de usuario: **Externo**. Nombre de la app: `FarmHabit`. Pon tu correo como correo de asistencia y de contacto.
3. En **Acceso a los datos** (en la consola antigua, **Permisos** o _scopes_), pulsa **Agregar o quitar permisos** y añade `https://www.googleapis.com/auth/drive.appdata`. Si no sale en la lista, pégalo en **Agregar permisos manualmente**.
4. En **Público** (en la consola antigua, **Usuarios de prueba**), baja hasta **Usuarios de prueba**, pulsa **Add users** y añade tu cuenta de Google y la de cualquiera que vaya a usar tu compilación.

Mientras la app esté "en pruebas", Google mostrará un aviso de "app no verificada" al iniciar sesión. Es normal: pulsa **Continuar**.

## 3. Crear el cliente OAuth

1. Ve a **Google Auth Platform → Clientes → Crear cliente** (en la consola antigua, **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**).
2. Tipo de aplicación: **App de escritorio**. Nombre: `FarmHabit escritorio`.
3. Copia el **ID de cliente** y el **Secreto del cliente**.

## 4. Ponerlas en el proyecto

1. Copia `apps/app/.env.example` como `apps/app/.env`. Este archivo **no se sube a GitHub**.
2. Rellénalo:

   ```
   VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
   VITE_GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
   ```

3. Vuelve a ejecutar `pnpm dev` o `pnpm build`. Las credenciales se incluyen al compilar.

En las apps instaladas, Google no considera secreto el "secreto del cliente" de escritorio: la seguridad viene de PKCE y de la redirección a `127.0.0.1`. Aun así lo dejamos fuera del repositorio.

## 5. Usarla

1. En FarmHabit: **Ajustes → Sincronización con Google Drive → Conectar**. Se abre el navegador para iniciar sesión. Si Google avisa de que la app no está verificada, pulsa **Continuar**. En la pantalla de permisos, **marca la casilla** de acceso a Drive: si no, la app no puede usar su carpeta (error 403).
2. **En el primer dispositivo** eliges una **frase secreta**. Si la olvidas, nadie puede recuperar los datos sincronizados.
3. **En los demás dispositivos** conectas la misma cuenta y escribes la misma frase. Solo se pide una vez: después la clave se guarda en el llavero del sistema.

A partir de ahí sincroniza sola: al abrir la app, al volver a ella, cada 5 minutos y poco después de cada cambio.
