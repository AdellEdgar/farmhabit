# FarmHabit en Android

## Instalar

1. En el móvil, abre la página de [Releases](https://github.com/AdellEdgar/farmhabit/releases) y descarga `FarmHabit_x.y.z_android.apk`.
2. Ábrelo. Android pedirá permiso para **instalar apps de origen desconocido** desde el navegador: concédelo solo para esta instalación.
3. Al abrir FarmHabit por primera vez, acepta el permiso de **notificaciones** para recibir los avisos.

Para actualizar, instala el APK de la versión nueva encima: tus datos se conservan.

Si el móvil tiene "ahorro de batería" agresivo (Xiaomi, Samsung, Huawei…), pon FarmHabit como **Sin restricciones** en los ajustes de batería de la app. Si no, algunos avisos pueden llegar tarde.

## Firma del APK (para quien compila)

Android solo deja instalar una versión encima de otra si las dos están firmadas con **la misma clave**. GitHub Actions firma el APK con una clave fija que se guarda como secreto del repositorio. Sin ese secreto usa una clave de depuración distinta en cada compilación, y para actualizar habría que desinstalar (y perder los datos que no estén sincronizados).

Crear la clave, **una sola vez** (keytool viene con Java):

```bash
keytool -genkeypair -v -keystore farmhabit-release.jks -storetype PKCS12 -alias farmhabit -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=FarmHabit"
```

Te pedirá una contraseña. Después, súbela a GitHub como secretos (con [GitHub CLI](https://cli.github.com/)):

```bash
base64 -w0 farmhabit-release.jks | gh secret set ANDROID_KEYSTORE
gh secret set ANDROID_KEYSTORE_PASSWORD
```

**Guarda `farmhabit-release.jks` y su contraseña fuera del repositorio** (por ejemplo en tu gestor de contraseñas). Si los pierdes, las versiones nuevas no podrán instalarse encima de las antiguas.
