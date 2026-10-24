import {
  addDays,
  configOn,
  habitLogId,
  localDateOf,
  localDateTimeToEpoch,
  type FarmState,
  type HabitLog,
  type ReminderEvent,
} from '@farmhabit/core';
import { formatQuantity } from '../features/habits/habit-meta';
import { formatDue } from './format';

/** Hora del aviso diario de la granja cuando un animal está a punto de morir. */
export const FARM_ALERT_TIME = '20:00';

export interface NotificationText {
  title: string;
  body: string;
}

export function reminderText(event: ReminderEvent, logs: HabitLog[]): NotificationText {
  const day = localDateOf(event.at);
  if (event.kind === 'task') {
    const t = event.task;
    const due = formatDue(t.dueDate!, t.dueTime, day);
    return {
      title: `📌 ${t.title}`,
      body:
        event.offsetMin === 0 && t.dueTime
          ? 'Vence ahora'
          : `Vence ${due.charAt(0).toLowerCase()}${due.slice(1)}`,
    };
  }
  const h = event.habit;
  const cfg = configOn(h, event.date);
  const log = logs.find((l) => l.id === habitLogId(h.id, event.date) && l.deletedAt === null);
  const body = cfg?.target
    ? `Llevas ${formatQuantity(log?.value ?? 0)} de ${formatQuantity(cfg.target.quantity)} ${cfg.target.unit}. ¡Tú puedes!`
    : '¿Ya lo has hecho hoy? Tu granja te lo agradecerá.';
  return { title: `${h.icon || '✨'} ${h.name}`, body };
}

export function farmAlertText(farm: FarmState): NotificationText | null {
  const w = farm.deathWarning;
  if (!w) return null;
  return {
    title: '🐔 Tu granja te necesita',
    body:
      w.daysLeft === 1
        ? `${w.name} está muy enfermo. Si hoy no cumples tus hábitos, morirá esta noche.`
        : `${w.name} está muy enfermo. Le quedan ${w.daysLeft} días malos antes de morir.`,
  };
}

/** ¿Cae la hora del aviso de la granja dentro de (from, to]? */
export function farmAlertDue(from: number, to: number): boolean {
  for (let d = localDateOf(from); d <= localDateOf(to); d = addDays(d, 1)) {
    const at = localDateTimeToEpoch(d, FARM_ALERT_TIME);
    if (at > from && at <= to) return true;
  }
  return false;
}
