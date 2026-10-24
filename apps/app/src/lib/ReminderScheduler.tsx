import { useEffect, useRef } from 'react';
import { remindersBetween } from '@farmhabit/core';
import { farmAlertDue, farmAlertText, reminderText, type NotificationText } from './reminder-text';
import { getFlag, notificationPermission, PREF_KEYS, showNotification } from './platform';
import { useApp } from './use-app';

/** Cada cuánto se comprueba si toca algún aviso. */
const TICK_MS = 20_000;
/** Avisos perdidos con la app cerrada: solo se recuperan los de las últimas horas. */
const MAX_BACKLOG_MS = 12 * 3_600_000;
/** Si se acumulan más que esto, se agrupan en una sola notificación. */
const MAX_SEPARATE = 3;

/**
 * Programador de avisos. No tiene interfaz: cada pocos segundos mira qué
 * avisos han vencido desde la última comprobación (guardada en `meta`, así no
 * se repiten al reiniciar) y los muestra como notificaciones del sistema.
 */
export function ReminderScheduler() {
  const { db, data, farm } = useApp();
  const latest = useRef({ data, farm });
  useEffect(() => {
    latest.current = { data, farm };
  });

  useEffect(() => {
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const now = Date.now();
        const stored = Number(await db.getMeta(PREF_KEYS.lastCheck));
        // Primera vez: empezar desde ahora, sin avisos atrasados.
        const from = Math.max(
          Number.isFinite(stored) && stored > 0 ? stored : now,
          now - MAX_BACKLOG_MS,
        );
        await db.setMeta(PREF_KEYS.lastCheck, String(now));

        if (!(await getFlag(db, PREF_KEYS.remindersEnabled, true))) return;
        if ((await notificationPermission()) !== 'granted') return;

        const { data: d, farm: f } = latest.current;
        const texts: NotificationText[] = remindersBetween({
          tasks: d.tasks,
          habits: d.habits,
          logs: d.habitLogs,
          from,
          to: now,
        }).map((e) => reminderText(e, d.habitLogs));
        const farmText = farmAlertDue(from, now) ? farmAlertText(f) : null;
        if (farmText) texts.unshift(farmText);

        if (texts.length > MAX_SEPARATE) {
          await showNotification(
            `🔔 Tienes ${texts.length} avisos`,
            texts
              .map((t) => t.title)
              .slice(0, 5)
              .join(' · '),
          );
        } else {
          for (const t of texts) await showNotification(t.title, t.body);
        }
      } catch {
        // Un fallo puntual (p. ej. al leer la BD) no debe parar los siguientes avisos.
      } finally {
        running = false;
      }
    };
    void tick();
    const id = setInterval(() => void tick(), TICK_MS);
    return () => clearInterval(id);
  }, [db]);

  return null;
}
