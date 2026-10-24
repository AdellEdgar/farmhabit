import { invoke } from '@tauri-apps/api/core';
import * as autostart from '@tauri-apps/plugin-autostart';
import * as notification from '@tauri-apps/plugin-notification';
import type { Database } from '@farmhabit/core';
import { isDesktopApp } from './drivers';

// Funciones que dependen de la plataforma: notificaciones, bandeja y
// arranque automático. En el modo navegador se usa la API web o no hacen nada.

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

/** Escritorio con bandeja del sistema y arranque automático. */
export const isDesktopShell = isDesktopApp && !isMobile;

export async function notificationPermission(): Promise<PermissionState> {
  if (isDesktopApp) return (await notification.isPermissionGranted()) ? 'granted' : 'default';
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (isDesktopApp) return (await notification.requestPermission()) as PermissionState;
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

export async function showNotification(title: string, body: string): Promise<void> {
  if (isDesktopApp) {
    notification.sendNotification({ title, body });
    return;
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// ---------- Preferencias del dispositivo (se guardan en `meta`) ----------

export const PREF_KEYS = {
  remindersEnabled: 'reminders:enabled',
  lastCheck: 'reminders:lastCheck',
  closeToTray: 'closeToTray',
} as const;

export async function getFlag(db: Database, key: string, fallback: boolean): Promise<boolean> {
  const v = await db.getMeta(key);
  return v === null ? fallback : v === '1';
}

export async function setFlag(db: Database, key: string, value: boolean): Promise<void> {
  await db.setMeta(key, value ? '1' : '0');
}

/** Cerrar la ventana la esconde en la bandeja (true) o cierra la app (false). */
export async function applyCloseToTray(enabled: boolean): Promise<void> {
  if (isDesktopShell) await invoke('set_close_to_tray', { enabled });
}

export async function getAutostart(): Promise<boolean | null> {
  if (!isDesktopShell) return null;
  return autostart.isEnabled();
}

export async function setAutostart(enabled: boolean): Promise<void> {
  if (!isDesktopShell) return;
  if (enabled) await autostart.enable();
  else await autostart.disable();
}
