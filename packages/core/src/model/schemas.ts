import { z } from 'zod';
import { isLocalDate, isLocalTime } from '../util/dates';

// Esquemas zod de todas las entidades sincronizables. Sirven para tipar el
// código (z.infer) y para validar lo que llega de un archivo importado.

const epochMs = z.number().int().nonnegative();
const id = z.uuid();
export const localDate = z.string().refine(isLocalDate, 'Fecha no válida (YYYY-MM-DD)');
export const localTime = z.string().refine(isLocalTime, 'Hora no válida (HH:mm)');
const weekday = z.number().int().min(1).max(7);

/** Campos comunes de todo elemento sincronizable. */
export const syncFields = {
  id,
  createdAt: epochMs,
  updatedAt: epochMs,
  deletedAt: epochMs.nullable(),
};

// ---------- Etiquetas ----------

export const tagSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(50),
  color: z.string().max(20),
});

// ---------- Tareas ----------

/** 1 = alta, 2 = media, 3 = baja. */
export const prioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const taskReminderSchema = z.object({
  /** Minutos antes de la fecha/hora límite (0 = a la hora). */
  offsetMin: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 60),
});

export const taskSchema = z.object({
  ...syncFields,
  title: z.string().max(500),
  notes: z.string().max(100_000),
  priority: prioritySchema,
  status: z.enum(['pending', 'done']),
  dueDate: localDate.nullable(),
  dueTime: localTime.nullable(),
  /** Regla RRULE (RFC 5545) sin DTSTART, p. ej. "FREQ=WEEKLY;BYDAY=MO,WE". */
  rrule: z.string().max(500).nullable(),
  reminders: z.array(taskReminderSchema).max(10),
  tagIds: z.array(id).max(50),
  completedAt: epochMs.nullable(),
});

/** Historial de ocurrencias completadas de una tarea recurrente. */
export const taskCompletionSchema = z.object({
  ...syncFields,
  taskId: id,
  occurrenceDate: localDate,
  completedAt: epochMs,
});

// ---------- Hábitos ----------

export const habitScheduleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({ type: z.literal('weekdays'), days: z.array(weekday).min(1).max(7) }),
  z.object({ type: z.literal('timesPerWeek'), times: z.number().int().min(1).max(7) }),
  z.object({ type: z.literal('timesPerMonth'), times: z.number().int().min(1).max(31) }),
  z.object({ type: z.literal('everyNDays'), interval: z.number().int().min(2).max(365) }),
]);

export const habitTargetSchema = z.object({
  quantity: z.number().positive(),
  unit: z.string().max(20),
});

/**
 * Configuración de un hábito vigente desde `since`. Se guarda el historial
 * para que cambiar el esfuerzo o la frecuencia no reescriba el pasado
 * (la granja se recalcula con la configuración que había cada día).
 */
export const habitConfigSchema = z.object({
  since: localDate,
  effort: z.number().int().min(1).max(5),
  schedule: habitScheduleSchema,
  target: habitTargetSchema.nullable(),
});

export const habitReminderSchema = z.object({
  time: localTime,
  /** Días ISO (1 = lunes). Vacío = todos los días programados. */
  days: z.array(weekday).max(7),
});

export const habitSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(200),
  description: z.string().max(5_000),
  icon: z.string().max(20),
  color: z.string().max(20),
  sortKey: z.string().min(1).max(200),
  startDate: localDate,
  configHistory: z.array(habitConfigSchema).min(1),
  reminders: z.array(habitReminderSchema).max(10),
  archivedAt: epochMs.nullable(),
});

export const habitLogSchema = z.object({
  ...syncFields,
  habitId: id,
  date: localDate,
  status: z.enum(['done', 'skipped']),
  /** Cantidad registrada en hábitos con objetivo (null si no aplica). */
  value: z.number().nonnegative().nullable(),
});

// ---------- Notas ----------

export const noteFolderSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(200),
  parentId: id.nullable(),
  sortKey: z.string().min(1).max(200),
});

export const noteSchema = z.object({
  ...syncFields,
  folderId: id.nullable(),
  title: z.string().max(500),
  /** Documento del editor (JSON de TipTap serializado). Vacío si es privada. */
  content: z.string().max(2_000_000),
  /** Texto plano para el buscador. Vacío si es privada. */
  plainText: z.string().max(2_000_000),
  tagIds: z.array(id).max(50),
  pinned: z.boolean(),
  isPrivate: z.boolean(),
  /** Fase 6: {título, contenido} cifrados con la clave de notas privadas. */
  privateBlob: z.string().max(3_000_000).nullable(),
});

// ---------- Granja ----------

export const speciesSchema = z.enum(['chicken', 'rabbit', 'sheep', 'pig', 'cow', 'horse']);

/**
 * Animal con datos del usuario (nombre). Los comprados guardan su precio.
 * Los nacidos en la granja los genera el motor con un id determinista; si el
 * usuario les pone nombre se guarda una fila con ese mismo id.
 * La muerte NO se guarda: la calcula el motor a partir del historial.
 */
export const animalSchema = z.object({
  ...syncFields,
  name: z.string().min(1).max(50),
  species: speciesSchema,
  acquiredOn: localDate,
  source: z.enum(['starter', 'bought', 'born']),
  price: z.number().int().nonnegative(),
});

/** Modo vacaciones: solo protege los días posteriores a su creación. */
export const vacationSchema = z.object({
  ...syncFields,
  startDate: localDate,
  endDate: localDate,
});

// ---------- Ajustes ----------

export const settingSchema = z.object({
  ...syncFields,
  /** El id es determinista a partir de la clave (ver settingId). */
  key: z.string().min(1).max(100),
  value: z.string().max(100_000),
});
