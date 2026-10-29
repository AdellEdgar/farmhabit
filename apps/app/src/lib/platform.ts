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

/**
 * Valor inicial de "seguir en la bandeja al cerrar". En Linux empieza
 * desactivado: algunos escritorios (GNOME sin extensión) no muestran la
 * bandeja y la ventana escondida quedaría inaccesible.
 */
export const DEFAULT_CLOSE_TO_TRAY = !/Linux/i.test(navigator.userAgent);

/**
 * App móvil: el sistema la congela en segundo plano, así que los avisos no
 * se pueden comprobar "en vivo"; hay que programarlos por adelantado.
 */
export const isMobileApp = isDesktopApp && isMobile;

export interface ScheduledNotification {
  id: number;
  at: number;
  title: string;
  body: string;
}

/** Sustituye todos los avisos programados en el sistema por estos (solo móvil). */
export async function replaceScheduledNotifications(list: ScheduledNotification[]): Promise<void> {
  if (!isMobileApp) return;
  await notification.cancelAll();
  for (const n of list) {
    notification.sendNotification({
      id: n.id,
      title: n.title,
      body: n.body,
      schedule: notification.Schedule.at(new Date(n.at), false, true),
    });
  }
}

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
