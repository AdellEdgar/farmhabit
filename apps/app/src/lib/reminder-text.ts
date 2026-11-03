import {
  addDays,
  configOn,
  habitLogId,
  localDateOf,
  localDateTimeToEpoch,
  type GameState,
  type HabitLog,
  type ReminderEvent,
} from '@farmhabit/core';
import { formatQuantity } from '../features/habits/habit-meta';
import { formatDue } from './format';

/** Hora del aviso diario cuando alguna criatura está triste y su hábito sigue pendiente. */
export const CREATURE_ALERT_TIME = '20:00';

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
    : '¿Ya lo has hecho hoy? Tu criatura te lo agradecerá.';
  return { title: `${h.icon || '✨'} ${h.name}`, body };
}

export function creatureAlertText(game: GameState): NotificationText | null {
  const [first, ...rest] = game.alerts;
  if (!first) return null;
  return {
    title: '😢 Tus criaturas te necesitan',
    body:
      rest.length === 0
        ? `${first.name} está triste: si hoy no haces su hábito, puede retroceder.`
        : `${first.name} y ${rest.length} más están tristes: haz sus hábitos hoy para que no retrocedan.`,
  };
}

/** ¿Cae la hora del aviso de las criaturas dentro de (from, to]? */
export function creatureAlertDue(from: number, to: number): boolean {
  for (let d = localDateOf(from); d <= localDateOf(to); d = addDays(d, 1)) {
    const at = localDateTimeToEpoch(d, CREATURE_ALERT_TIME);
    if (at > from && at <= to) return true;
  }
  return false;
}
