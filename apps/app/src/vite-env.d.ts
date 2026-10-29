/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ID de cliente OAuth de Google (tipo "App de escritorio"). Ver docs/google-drive.md. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** "Secreto" del cliente de escritorio: Google no lo trata como secreto en apps instaladas. */
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
  /** '1' en la demo web (GitHub Pages): carga datos de ejemplo. */
  readonly VITE_DEMO?: string;
}

/** Versión de la app (de apps/app/package.json). */
declare const __APP_VERSION__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
