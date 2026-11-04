import type { Database, EntityPatch, NewEntity } from '../db/database';
import { NotFoundError } from '../db/database';
import type { CalendarEvent } from '../model/types';
import { localDateTimeToEpoch } from '../util/dates';
import { deleteTask } from './tasks';

// Eventos propios del calendario. Si se repiten, editarlos o borrarlos afecta a
// toda la serie.

export class EventRangeError extends Error {
  constructor(message = 'El evento termina antes de empezar') {
    super(message);
    this.name = 'EventRangeError';
  }
}

export class TaskToEventError extends Error {
  constructor() {
    super('Solo se puede convertir en evento una tarea con fecha');
    this.name = 'TaskToEventError';
  }
}

type EventFields = NewEntity<'events'>;

/** Comprueba el evento y deja las horas a null si es de día completo. */
function normalized<T extends EventFields>(e: T): T {
  if (!e.title.trim()) throw new EventRangeError('El evento necesita un título');
  const clean = e.allDay ? { ...e, startTime: null, endTime: null } : e;
  const ok = clean.allDay
    ? clean.endDate >= clean.startDate
    : localDateTimeToEpoch(clean.endDate, clean.endTime ?? '23:59') >
      localDateTimeToEpoch(clean.startDate, clean.startTime ?? '00:00');
  if (!ok) throw new EventRangeError();
  return clean;
}

export function createEvent(db: Database, input: EventFields): Promise<CalendarEvent> {
  return Promise.resolve().then(() => db.repo('events').create(normalized(input)));
}

export async function updateEvent(
  db: Database,
  id: string,
  patch: EntityPatch<'events'>,
): Promise<CalendarEvent> {
  const repo = db.repo('events');
  const current = await repo.get(id);
  if (!current) throw new NotFoundError('events', id);
  const { allDay, startDate, startTime, endDate, endTime } = normalized({ ...current, ...patch });
  return repo.update(id, { ...patch, allDay, startDate, startTime, endDate, endTime });
}

export async function deleteEvent(db: Database, id: string): Promise<void> {
  await db.repo('events').remove(id);
}

/** Crea un evento con los datos de la tarea (dura una hora, sin pasar de ese día) y la borra. */
export async function taskToEvent(db: Database, taskId: string): Promise<CalendarEvent> {
  const task = await db.repo('tasks').get(taskId);
  if (!task) throw new NotFoundError('tasks', taskId);
  if (!task.dueDate) throw new TaskToEventError();
  const event = await createEvent(db, {
    title: task.title || 'Evento',
    location: '',
    description: task.notes,
    allDay: task.dueTime === null,
    startDate: task.dueDate,
    startTime: task.dueTime,
    endDate: task.dueDate,
    endTime: task.dueTime === null ? null : oneHourLater(task.dueTime),
    rrule: task.rrule,
    reminders: task.reminders,
  });
  await deleteTask(db, taskId);
  return event;
}

function oneHourLater(time: string): string {
  const hour = Number(time.slice(0, 2));
  return hour >= 23 ? '23:59' : `${String(hour + 1).padStart(2, '0')}${time.slice(2)}`;
}
