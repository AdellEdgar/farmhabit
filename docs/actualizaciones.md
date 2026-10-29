# Actualizaciones

FarmHabit busca versiones nuevas al abrirse y dos veces al día. Se puede desactivar o buscar a mano en **Ajustes → Actualizaciones**.

| Plataforma       | Qué hace                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| Windows          | Descarga el instalador nuevo, lo instala y reinicia la app.                                                  |
| Linux (AppImage) | Sustituye el AppImage por el nuevo y reinicia.                                                               |
| Linux (.deb)     | Instala el paquete nuevo; el sistema pide la contraseña de administrador.                                    |
| Android          | Avisa y abre la descarga del APK; se instala encima y se conservan los datos (ver [android.md](android.md)). |

La comprobación solo descarga un archivo público (`latest.json` de la última Release): no envía ningún dato del usuario.

## Cómo funciona

1. Al subir una etiqueta `vX.Y.Z`, GitHub Actions compila los instaladores con esa versión y los **firma** con la clave de actualizaciones.
2. La Release incluye `latest.json`, con la versión, el enlace y la firma de cada instalador.
3. La app consulta `https://github.com/AdellEdgar/farmhabit/releases/latest/download/latest.json`. Si la versión es más nueva, ofrece actualizar.
4. Antes de instalar, la app comprueba la firma con la **clave pública** que lleva dentro (`plugins.updater.pubkey` en `tauri.conf.json`). Si alguien manipulase la descarga, la firma no cuadraría y no se instalaría.

`releases/latest` ignora las Releases marcadas como "prerelease", así que todas (también las `-rc`) se publican como Release normal.

## Clave de firma (para quien compila)

Se crea **una sola vez**. Es distinta de la clave de Android.

```bash
pnpm --filter @farmhabit/app tauri signer generate -w ~/.tauri/farmhabit-updater.key
```

Pide una contraseña y crea dos archivos:

- `farmhabit-updater.key`: la clave **privada**. Súbela a GitHub como secreto, junto con su contraseña:

  ```bash
  gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/farmhabit-updater.key
  gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  ```

- `farmhabit-updater.key.pub`: la clave **pública**. Va en `plugins.updater.pubkey` de `apps/app/src-tauri/tauri.conf.json` (no es secreta).

Guarda la clave privada y su contraseña fuera del repositorio. Si se pierden, las apps ya instaladas no aceptarán más actualizaciones y habría que reinstalarlas a mano.
