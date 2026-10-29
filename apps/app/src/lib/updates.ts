import { useSyncExternalStore } from 'react';
import { compareSemver } from '@farmhabit/core';
import { errorMessage } from './errors';
import { isDesktopShell, isMobileApp } from './platform';

// Actualizaciones. Cada Release de GitHub publica un `latest.json` con la
// versión y los instaladores firmados (lo genera .github/workflows/build.yml).
// - Escritorio: el plugin updater de Tauri lo descarga, comprueba la firma,
//   instala la versión nueva y reinicia la app.
// - Android: no deja que una app se actualice sola fuera de Google Play, así
//   que solo se avisa y se abre la descarga del APK.

export const RELEASES_URL = 'https://github.com/AdellEdgar/farmhabit/releases/latest';
const MANIFEST_URL = `${RELEASES_URL}/download/latest.json`;

/** Si este dispositivo puede buscar actualizaciones (no en la demo ni en el navegador). */
export const canUpdate = isDesktopShell || isMobileApp;

export interface AvailableUpdate {
  version: string;
  notes: string;
  /** Escritorio: descarga, instala y reinicia. Null en Android. */
  install: ((onProgress: (fraction: number | null) => void) => Promise<void>) | null;
  /** Dónde descargarla a mano (Android). */
  downloadUrl: string;
}

export type UpdateState =
  | { status: 'idle' | 'checking' | 'none' }
  | { status: 'available'; update: AvailableUpdate }
  | { status: 'installing'; update: AvailableUpdate; progress: number | null }
  | { status: 'error'; message: string; update?: AvailableUpdate };

interface Manifest {
  version: string;
  notes?: string;
  downloads?: { android?: string };
}

async function checkDesktop(): Promise<AvailableUpdate | null> {
  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    notes: update.body ?? '',
    downloadUrl: RELEASES_URL,
    install: async (onProgress) => {
      let total: number | null = null;
      let received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? null;
        else if (event.event === 'Progress') {
          received += event.data.chunkLength;
          onProgress(total ? received / total : null);
        }
      });
      // En Windows el instalador ya cierra y vuelve a abrir la app; en Linux hay que reiniciar.
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    },
  };
}

async function checkMobile(): Promise<AvailableUpdate | null> {
  // fetch del plugin http (desde Rust): la CSP de la app no deja conectar a GitHub directamente.
  const { fetch } = await import('@tauri-apps/plugin-http');
  const res = await fetch(MANIFEST_URL);
  // 404: aún no hay ninguna versión publicada con latest.json.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  if (compareSemver(manifest.version, __APP_VERSION__) <= 0) return null;
  return {
    version: manifest.version,
    notes: manifest.notes ?? '',
    downloadUrl: manifest.downloads?.android ?? RELEASES_URL,
    install: null,
  };
}

// ---------- Estado compartido (aviso de la app y sección de Ajustes) ----------

let state: UpdateState = { status: 'idle' };
const listeners = new Set<() => void>();

function setState(next: UpdateState): void {
  state = next;
  listeners.forEach((l) => l());
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/**
 * Busca una versión nueva. Con `quiet` (comprobación automática) un fallo de
 * red no se muestra como error: simplemente no hay aviso.
 */
export async function checkForUpdate({ quiet = false } = {}): Promise<void> {
  if (!canUpdate || state.status === 'checking' || state.status === 'installing') return;
  setState({ status: 'checking' });
  try {
    const update = isDesktopShell ? await checkDesktop() : await checkMobile();
    setState(update ? { status: 'available', update } : { status: 'none' });
  } catch (e) {
    setState(
      quiet
        ? { status: 'idle' }
        : {
            status: 'error',
            message: `No se pudo comprobar si hay versiones nuevas: ${errorMessage(e)}`,
          },
    );
  }
}

/** Instala la versión nueva (escritorio) o abre su descarga (Android). */
export async function installUpdate(): Promise<void> {
  if (state.status !== 'available' && !(state.status === 'error' && state.update)) return;
  const update = state.update!;
  if (!update.install) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(update.downloadUrl);
    return;
  }
  setState({ status: 'installing', update, progress: null });
  try {
    await update.install((progress) => setState({ status: 'installing', update, progress }));
  } catch (e) {
    setState({
      status: 'error',
      message: `No se pudo instalar la actualización: ${errorMessage(e)}`,
      update,
    });
  }
}
