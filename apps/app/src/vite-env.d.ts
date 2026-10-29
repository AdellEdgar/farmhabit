/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ID de cliente OAuth de Google (tipo "App de escritorio"). Ver docs/google-drive.md. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** "Secreto" del cliente de escritorio: Google no lo trata como secreto en apps instaladas. */
  readonly VITE_GOOGLE_CLIENT_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
