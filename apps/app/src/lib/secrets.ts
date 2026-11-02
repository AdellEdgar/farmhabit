import { invoke } from '@tauri-apps/api/core';
import { isDesktopApp } from './drivers';

// Secretos del dispositivo en el llavero del sistema (ver src-tauri/src/secrets.rs).
// En el modo navegador no hay llavero: la sincronización no está disponible.

export const SECRET_KEYS = {
  vaultKey: 'sync:vaultKey',
  googleRefreshToken: 'google:refreshToken',
} as const;

export async function getSecret(name: string): Promise<string | null> {
  if (!isDesktopApp) return null;
  return invoke<string | null>('secret_get', { name });
}

export async function setSecret(name: string, value: string): Promise<void> {
  if (!isDesktopApp)
    throw new Error('El llavero del sistema solo está disponible en la app instalada');
  await invoke('secret_set', { name, value });
}

export async function deleteSecret(name: string): Promise<void> {
  if (isDesktopApp) await invoke('secret_delete', { name });
}
