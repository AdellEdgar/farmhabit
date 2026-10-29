import { useEffect } from 'react';
import { localDateOf, localDateTimeToEpoch, remindersBetween } from '@farmhabit/core';
import { FARM_ALERT_TIME, farmAlertText, reminderText } from './reminder-text';
import {
  getFlag,
  notificationPermission,
  PREF_KEYS,
  replaceScheduledNotifications,
  type ScheduledNotification,
} from './platform';
import { useApp } from './use-app';

/** Cuántos días por adelantado se programan los avisos. */
const HORIZON_MS = 7 * 86_400_000;
/** Android limita las alarmas por app: no programar más de esto. */
const MAX_SCHEDULED = 60;
/** Esperar a que se calmen los cambios antes de reprogramar. */
const DEBOUNCE_MS = 1_500;

/** Id numérico estable para la notificación a partir de la clave del aviso. */
function notificationId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 1 || 1;
}

/**
 * Programador de avisos para móvil. Android congela la app en segundo plano,
 * así que, cada vez que cambian los datos, se reprograman en el sistema los
 * avisos de los próximos 7 días. Si marcas un hábito como hecho, su aviso de
 * hoy desaparece porque se recalcula la lista.
 */
export function MobileReminderScheduler() {
  const { db, data, farm } = useApp();

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        try {
          const enabled = await getFlag(db, PREF_KEYS.remindersEnabled, true);
          if (!enabled || (await notificationPermission()) !== 'granted') {
            await replaceScheduledNotifications([]);
            return;
          }
          const now = Date.now();
          const list: ScheduledNotification[] = remindersBetween({
            tasks: data.tasks,
            habits: data.habits,
            logs: data.habitLogs,
            from: now,
            to: now + HORIZON_MS,
          }).map((e) => ({
            id: notificationId(e.key),
            at: e.at,
            ...reminderText(e, data.habitLogs),
          }));

          // Aviso de la granja: hoy a las 20:00, si algún animal está a punto de morir.
          const farmText = farmAlertText(farm);
          const farmAt = localDateTimeToEpoch(localDateOf(now), FARM_ALERT_TIME);
          if (farmText && farmAt > now)
            list.push({ id: notificationId('farm-alert'), at: farmAt, ...farmText });

          list.sort((a, b) => a.at - b.at);
          await replaceScheduledNotifications(list.slice(0, MAX_SCHEDULED));
        } catch {
          // Si falla, se reintenta con el próximo cambio de datos.
        }
      })();
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [db, data, farm]);

  return null;
}
