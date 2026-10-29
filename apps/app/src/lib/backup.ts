import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { isDesktopApp } from './drivers';

// Copias de seguridad .agx: diálogos nativos en la app y descarga/selección
// de archivo en el modo navegador.

const FILTERS = [{ name: 'Copia de FarmHabit', extensions: ['agx'] }];

export function backupFileName(date: string): string {
  return `farmhabit-copia-${date}.agx`;
}

/** Guarda la copia donde elija el usuario. Devuelve false si cancela. */
export async function saveBackup(bytes: Uint8Array, suggestedName: string): Promise<boolean> {
  if (!isDesktopApp) {
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }
  const path = await save({ defaultPath: suggestedName, filters: FILTERS });
  if (!path) return false;
  await invoke('backup_write', { path, data: Array.from(bytes) });
  return true;
}

/** Pide al usuario un archivo .agx y lo lee. null si cancela. */
export async function pickBackup(): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (!isDesktopApp) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.agx';
      input.onchange = async () => {
        const file = input.files?.[0];
        resolve(file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }
  const path = await open({ multiple: false, directory: false, filters: FILTERS });
  if (!path) return null;
  const data = await invoke<number[]>('backup_read', { path });
  return { name: path.split(/[\\/]/).pop() ?? path, bytes: Uint8Array.from(data) };
}
