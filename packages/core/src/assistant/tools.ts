import { z } from 'zod';
import type { Database } from '../db/database';
import { currentConfig, habitsDueOn, habitStreak } from '../domain/habits';
import {
  completedTasks,
  isOverdue,
  pendingTasks,
  sortTasks,
  todayTasks,
  upcomingTasks,
} from '../domain/tasks';
import { computeFarm } from '../game/engine';
import { DEFAULT_RULES } from '../game/game-rules';
import { habitScheduleSchema } from '../model/schemas';
import type { Habit, HabitSchedule, Priority, Species, Task } from '../model/types';
import { ClosedDayError, createHabit, isEditableDay, setHabitLog } from '../services/habits';
import { completeTask, reopenTask } from '../services/tasks';
import type { LocalDate } from '../util/dates';
import { diffDays, isLocalDate, isLocalTime, localDateOf, toUtcMidnight } from '../util/dates';
import { compareSortKey } from '../util/fractional-index';
import type { ToolSpec } from './chat';

// Herramientas del asistente: lo que el modelo puede consultar y cambiar.
// Las de lectura se ejecutan sin preguntar; las de escritura solo preparan una
// propuesta (describe) y no tocan nada hasta que el usuario la confirma (run).
// Las notas privadas quedan fuera: el asistente no puede leerlas ni buscarlas.

export interface ToolContext {
  db: Database;
  today: LocalDate;
  now: number;
}

/** Error que se le devuelve al modelo para que corrija la petición. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolInputError';
  }
}

interface ToolDef<S extends z.ZodType> {
  name: string;
  description: string;
  args: S;
  /** read: consulta, se ejecuta sin preguntar. write: cambia datos y pide confirmación. */
  kind: 'read' | 'write';
  /** Solo write: comprueba que se puede hacer y devuelve el texto de la propuesta. */
  describe?: (args: z.output<S>, ctx: ToolContext) => Promise<string>;
  run: (args: z.output<S>, ctx: ToolContext) => Promise<unknown>;
}

export type AssistantTool = ToolDef<z.ZodType>;

function tool<S extends z.ZodType>(def: ToolDef<S>): AssistantTool {
  return def as unknown as AssistantTool;
}

// ---------- Ayudas ----------

const PRIORITY_NAME: Record<Priority, string> = { 1: 'alta', 2: 'media', 3: 'baja' };
const priorityArg = z.enum(['alta', 'media', 'baja']);
const toPriority = (p: z.infer<typeof priorityArg>): Priority =>
  p === 'alta' ? 1 : p === 'baja' ? 3 : 2;

const dateArg = z.string().refine(isLocalDate, 'Fecha no válida').describe('Fecha YYYY-MM-DD');
const timeArg = z.string().refine(isLocalTime, 'Hora no válida').describe('Hora HH:mm (24 h)');
const idArg = (what: string) =>
  z.string().describe(`Id de ${what}, tal como lo devuelve una consulta`);

const SPECIES_NAME: Record<Species, string> = {
  chicken: 'gallina',
  rabbit: 'conejo',
  sheep: 'oveja',
  pig: 'cerdo',
  cow: 'vaca',
  horse: 'caballo',
};

const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** "hoy", "mañana", "ayer" o "vie, 7 nov". */
export function describeDay(date: LocalDate, today: LocalDate): string {
  const diff = diffDays(today, date);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === -1) return 'ayer';
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(toUtcMidnight(date));
}

export function describeSchedule(s: HabitSchedule): string {
  switch (s.type) {
    case 'daily':
      return 'cada día';
    case 'weekdays':
      return [...s.days]
        .sort()
        .map((d) => WEEKDAY_SHORT[d - 1])
        .join(', ');
    case 'timesPerWeek':
      return `${s.times} ${s.times === 1 ? 'vez' : 'veces'} por semana`;
    case 'timesPerMonth':
      return `${s.times} ${s.times === 1 ? 'vez' : 'veces'} al mes`;
    case 'everyNDays':
      return `cada ${s.interval} días`;
  }
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

async function getTask(ctx: ToolContext, id: string): Promise<Task> {
  const task = await ctx.db.repo('tasks').get(id);
  if (!task) throw new ToolInputError(`No existe ninguna tarea con id ${id}`);
  return task;
}

async function getHabit(ctx: ToolContext, id: string): Promise<Habit> {
  const habit = await ctx.db.repo('habits').get(id);
  if (!habit) throw new ToolInputError(`No existe ningún hábito con id ${id}`);
  return habit;
}

function taskView(t: Task, now: number) {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes ? t.notes.slice(0, 300) : undefined,
    priority: PRIORITY_NAME[t.priority],
    status: t.status === 'done' ? 'hecha' : 'pendiente',
    dueDate: t.dueDate ?? undefined,
    dueTime: t.dueTime ?? undefined,
    repeats: t.rrule ? true : undefined,
    overdue: isOverdue(t, now) || undefined,
  };
}

/** Documento de TipTap con un párrafo por línea. */
function textToDoc(text: string) {
  return {
    type: 'doc',
    content: text
      .split('\n')
      .map((line) =>
        line
          ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
          : { type: 'paragraph' },
      ),
  };
}

const frequencyArgs = {
  frequency: z
    .enum(['daily', 'weekdays', 'timesPerWeek', 'timesPerMonth', 'everyNDays'])
    .optional()
    .describe(
      'daily = cada día (por defecto); weekdays = días concretos (days); timesPerWeek / timesPerMonth = N veces (times); everyNDays = cada N días (interval)',
    ),
  days: z
    .array(z.number().int().min(1).max(7))
    .optional()
    .describe('Para weekdays: días ISO, 1 = lunes … 7 = domingo'),
  times: z.number().int().optional().describe('Para timesPerWeek o timesPerMonth'),
  interval: z.number().int().optional().describe('Para everyNDays (2 o más)'),
};

function buildSchedule(a: {
  frequency?: string;
  days?: number[];
  times?: number;
  interval?: number;
}): HabitSchedule {
  const parsed = habitScheduleSchema.safeParse({
    type: a.frequency ?? 'daily',
    days: a.days,
    times: a.times,
    interval: a.interval,
  });
  if (!parsed.success) {
    throw new ToolInputError(
      'Frecuencia incompleta: weekdays necesita days, timesPerWeek/timesPerMonth necesitan times y everyNDays necesita interval (2 o más)',
    );
  }
  return parsed.data;
}

// ---------- Consultas ----------

const listTasks = tool({
  name: 'list_tasks',
  kind: 'read',
  description:
    'Lista las tareas. view: today (vencidas y de hoy), upcoming (con fecha futura), pending (todas las pendientes, por defecto), completed o all. query filtra por texto en el título y las notas.',
  args: z.object({
    view: z.enum(['today', 'upcoming', 'pending', 'completed', 'all']).optional(),
    query: z.string().optional(),
  }),
  run: async ({ view = 'pending', query }, ctx) => {
    const tasks = await ctx.db.repo('tasks').list();
    let list =
      view === 'today'
        ? todayTasks(tasks, ctx.today)
        : view === 'upcoming'
          ? upcomingTasks(tasks, ctx.today)
          : view === 'completed'
            ? completedTasks(tasks)
            : view === 'all'
              ? tasks
              : pendingTasks(tasks);
    if (query) {
      const q = normalize(query);
      list = list.filter((t) => normalize(`${t.title}\n${t.notes}`).includes(q));
    }
    const sorted = view === 'completed' ? list : sortTasks(list, 'dueDate', ctx.now);
    return { total: sorted.length, tasks: sorted.slice(0, 50).map((t) => taskView(t, ctx.now)) };
  },
});

const listHabits = tool({
  name: 'list_habits',
  kind: 'read',
  description:
    'Lista los hábitos con su frecuencia, importancia, racha y si tocan y están marcados en una fecha (hoy por defecto).',
  args: z.object({ date: dateArg.optional() }),
  run: async ({ date }, ctx) => {
    const day = date ?? ctx.today;
    const habits = (await ctx.db.repo('habits').list())
      .filter((h) => h.archivedAt === null)
      .sort(compareSortKey);
    const logs = await ctx.db.repo('habitLogs').list();
    const due = new Set(habitsDueOn(habits, day).map((h) => h.id));
    return {
      date: day,
      canLogThisDate: isEditableDay(day, ctx.today),
      habits: habits.map((h) => {
        const cfg = currentConfig(h);
        const log = logs.find((l) => l.habitId === h.id && l.date === day);
        const streak = habitStreak(h, logs, ctx.today);
        const unit = { days: 'días', weeks: 'semanas', months: 'meses' }[streak.unit];
        return {
          id: h.id,
          name: h.name,
          icon: h.icon || undefined,
          importance: cfg.effort,
          frequency: describeSchedule(cfg.schedule),
          target: cfg.target ? `${cfg.target.quantity} ${cfg.target.unit}` : undefined,
          dueOnDate: due.has(h.id),
          status: !log
            ? 'sin marcar'
            : log.status === 'skipped'
              ? 'saltado'
              : log.value !== null
                ? `hecho (${log.value})`
                : 'hecho',
          streak: `${streak.current} ${unit} (mejor: ${streak.best})`,
        };
      }),
    };
  },
});

const getFarm = tool({
  name: 'get_farm',
  kind: 'read',
  description:
    'Estado de la granja: nivel, XP, grano, bienestar (0–100), si los animales están enfermos, aviso de muerte, puntos de hoy y animales vivos.',
  args: z.object({}),
  run: async (_args, ctx) => {
    const [habits, logs, animals, vacations] = await Promise.all([
      ctx.db.repo('habits').list({ includeDeleted: true }),
      ctx.db.repo('habitLogs').list(),
      ctx.db.repo('animals').list(),
      ctx.db.repo('vacations').list(),
    ]);
    const farm = computeFarm({ habits, logs, animals, vacations, today: ctx.today });
    const alive = farm.animals.filter((a) => a.diedOn === null);
    return {
      level: farm.level,
      xp: farm.xp,
      xpForNextLevel: DEFAULT_RULES.xpForLevel(farm.level + 1),
      grain: farm.grain,
      wellbeing: farm.wellbeing,
      sick: farm.sick,
      deathWarning: farm.deathWarning
        ? { animal: farm.deathWarning.name, daysLeft: farm.deathWarning.daysLeft }
        : null,
      today: {
        pointsEarned: farm.todayProgress.earned,
        habitsDone: farm.todayProgress.doneCount,
        habitsScheduled: farm.todayProgress.scheduledCount,
        vacation: farm.todayProgress.vacation,
      },
      animals: alive.map((a) => ({ name: a.name, species: SPECIES_NAME[a.species] })),
      deadAnimals: farm.animals.length - alive.length,
    };
  },
});

const searchNotes = tool({
  name: 'search_notes',
  kind: 'read',
  description:
    'Busca en las notas (sin distinguir acentos ni mayúsculas) y devuelve hasta 20 con un fragmento. Sin query, las más recientes. Las notas privadas no se incluyen.',
  args: z.object({ query: z.string().optional() }),
  run: async ({ query }, ctx) => {
    let notes = (await ctx.db.repo('notes').list()).filter((n) => !n.isPrivate);
    if (query) {
      const q = normalize(query);
      notes = notes.filter((n) => normalize(`${n.title}\n${n.plainText}`).includes(q));
    }
    notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
    return {
      total: notes.length,
      notes: notes.slice(0, 20).map((n) => ({
        id: n.id,
        title: n.title || '(sin título)',
        snippet: n.plainText.slice(0, 200),
        pinned: n.pinned || undefined,
        updated: localDateOf(n.updatedAt),
      })),
    };
  },
});

const readNote = tool({
  name: 'read_note',
  kind: 'read',
  description: 'Lee el texto completo de una nota.',
  args: z.object({ id: idArg('la nota') }),
  run: async ({ id }, ctx) => {
    const note = await ctx.db.repo('notes').get(id);
    if (!note) throw new ToolInputError(`No existe ninguna nota con id ${id}`);
    if (note.isPrivate)
      throw new ToolInputError('Es una nota privada: el asistente no puede leerla');
    const limit = 8000;
    return {
      id: note.id,
      title: note.title,
      text: note.plainText.slice(0, limit),
      truncated: note.plainText.length > limit || undefined,
    };
  },
});

// ---------- Cambios (piden confirmación) ----------

const createTask = tool({
  name: 'create_task',
  kind: 'write',
  description: 'Crea una tarea. Sin fecha si el usuario no la menciona.',
  args: z.object({
    title: z.string().min(1).max(500),
    notes: z.string().max(5000).optional(),
    priority: priorityArg.optional().describe('Por defecto, media'),
    dueDate: dateArg.optional(),
    dueTime: timeArg.optional().describe('Solo con dueDate'),
  }),
  describe: async (a, ctx) => {
    if (a.dueTime && !a.dueDate) throw new ToolInputError('Para poner hora hace falta una fecha');
    const details = [
      a.dueDate && describeDay(a.dueDate, ctx.today),
      a.dueTime,
      a.priority && `prioridad ${a.priority}`,
    ].filter(Boolean);
    return `Crear tarea «${a.title}»${details.length ? ` · ${details.join(' · ')}` : ''}`;
  },
  run: async (a, ctx) => {
    const task = await ctx.db.repo('tasks').create({
      title: a.title,
      notes: a.notes ?? '',
      priority: a.priority ? toPriority(a.priority) : 2,
      status: 'pending',
      dueDate: a.dueDate ?? null,
      dueTime: a.dueTime ?? null,
      rrule: null,
      reminders: [],
      tagIds: [],
      completedAt: null,
    });
    return { id: task.id };
  },
});

const updateTask = tool({
  name: 'update_task',
  kind: 'write',
  description:
    'Cambia campos de una tarea. Solo se cambian los que se pasan; dueDate o dueTime a null los quitan.',
  args: z.object({
    id: idArg('la tarea'),
    title: z.string().min(1).max(500).optional(),
    notes: z.string().max(5000).optional(),
    priority: priorityArg.optional(),
    dueDate: dateArg.nullable().optional(),
    dueTime: timeArg.nullable().optional(),
  }),
  describe: async (a, ctx) => {
    const task = await getTask(ctx, a.id);
    const dueDate = a.dueDate === undefined ? task.dueDate : a.dueDate;
    const dueTime = a.dueDate === null ? null : a.dueTime === undefined ? task.dueTime : a.dueTime;
    if (dueTime && !dueDate) throw new ToolInputError('Para poner hora hace falta una fecha');
    const changes = [
      a.title !== undefined && `título → «${a.title}»`,
      a.dueDate !== undefined &&
        `fecha → ${dueDate ? describeDay(dueDate, ctx.today) : 'sin fecha'}`,
      a.dueTime !== undefined && a.dueDate !== null && `hora → ${dueTime ?? 'sin hora'}`,
      a.priority !== undefined && `prioridad → ${a.priority}`,
      a.notes !== undefined && 'notas actualizadas',
    ].filter(Boolean);
    if (changes.length === 0) throw new ToolInputError('No has indicado ningún cambio');
    return `Editar tarea «${task.title}»: ${changes.join(', ')}`;
  },
  run: async (a, ctx) => {
    await getTask(ctx, a.id);
    await ctx.db.repo('tasks').update(a.id, {
      ...(a.title !== undefined && { title: a.title }),
      ...(a.notes !== undefined && { notes: a.notes }),
      ...(a.priority !== undefined && { priority: toPriority(a.priority) }),
      ...(a.dueDate !== undefined && { dueDate: a.dueDate }),
      ...(a.dueTime !== undefined && { dueTime: a.dueTime }),
      ...(a.dueDate === null && { dueTime: null }),
    });
    return { ok: true };
  },
});

const completeTaskTool = tool({
  name: 'complete_task',
  kind: 'write',
  description: 'Marca una tarea como hecha. Si se repite, pasa a su siguiente fecha.',
  args: z.object({ id: idArg('la tarea') }),
  describe: async ({ id }, ctx) => {
    const task = await getTask(ctx, id);
    if (task.status === 'done') throw new ToolInputError('Esa tarea ya está completada');
    return `Completar tarea «${task.title}»${task.rrule ? ' (se repite: pasará a su siguiente fecha)' : ''}`;
  },
  run: async ({ id }, ctx) => {
    const task = await completeTask(ctx.db, id, ctx.today);
    return {
      status: task.status,
      nextDueDate: task.status === 'pending' ? task.dueDate : undefined,
    };
  },
});

const reopenTaskTool = tool({
  name: 'reopen_task',
  kind: 'write',
  description: 'Devuelve a pendientes una tarea completada.',
  args: z.object({ id: idArg('la tarea') }),
  describe: async ({ id }, ctx) => {
    const task = await getTask(ctx, id);
    if (task.status !== 'done') throw new ToolInputError('Esa tarea no está completada');
    return `Volver a poner como pendiente «${task.title}»`;
  },
  run: async ({ id }, ctx) => {
    await reopenTask(ctx.db, id);
    return { ok: true };
  },
});

const deleteTask = tool({
  name: 'delete_task',
  kind: 'write',
  description: 'Borra una tarea.',
  args: z.object({ id: idArg('la tarea') }),
  describe: async ({ id }, ctx) => `Borrar tarea «${(await getTask(ctx, id)).title}»`,
  run: async ({ id }, ctx) => {
    await ctx.db.repo('tasks').remove(id);
    return { ok: true };
  },
});

const logHabit = tool({
  name: 'log_habit',
  kind: 'write',
  description:
    'Marca un hábito como hecho o saltado, o lo desmarca, en una fecha (hoy por defecto). Solo se puede hoy o ayer.',
  args: z.object({
    habitId: idArg('el hábito'),
    date: dateArg.optional(),
    status: z
      .enum(['done', 'skipped', 'none'])
      .describe('done = hecho; skipped = saltado (no rompe la racha); none = desmarcar'),
    value: z
      .number()
      .nonnegative()
      .optional()
      .describe('Cantidad conseguida, para hábitos con objetivo'),
  }),
  describe: async (a, ctx) => {
    const habit = await getHabit(ctx, a.habitId);
    const day = a.date ?? ctx.today;
    if (!isEditableDay(day, ctx.today)) throw new ClosedDayError(day);
    const when = describeDay(day, ctx.today);
    const name = `«${habit.icon ? `${habit.icon} ` : ''}${habit.name}»`;
    if (a.status === 'none') return `Desmarcar ${name} (${when})`;
    if (a.status === 'skipped') return `Marcar ${name} como saltado (${when})`;
    const target = currentConfig(habit).target;
    const amount = a.value !== undefined ? ` con ${a.value}${target ? ` ${target.unit}` : ''}` : '';
    return `Marcar ${name} como hecho${amount} (${when})`;
  },
  run: async (a, ctx) => {
    await getHabit(ctx, a.habitId);
    await setHabitLog(
      ctx.db,
      a.habitId,
      a.date ?? ctx.today,
      a.status === 'done' ? { status: 'done', value: a.value ?? null } : { status: a.status },
      ctx.today,
    );
    return { ok: true };
  },
});

const createHabitTool = tool({
  name: 'create_habit',
  kind: 'write',
  description:
    'Crea un hábito que empieza hoy. La importancia (1–5) da los puntos de la granja: hacerlo suma 10 × importancia y no hacerlo resta 10 × (6 − importancia).',
  args: z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    icon: z.string().max(20).optional().describe('Un emoji'),
    importance: z.number().int().min(1).max(5).optional().describe('Por defecto, 3'),
    ...frequencyArgs,
    targetQuantity: z.number().positive().optional().describe('Objetivo diario, p. ej. 2'),
    targetUnit: z.string().max(20).optional().describe('Unidad del objetivo, p. ej. L'),
  }),
  describe: async (a) => {
    const schedule = buildSchedule(a);
    const target = a.targetQuantity ? ` · objetivo ${a.targetQuantity} ${a.targetUnit ?? ''}` : '';
    return `Crear hábito «${a.icon ? `${a.icon} ` : ''}${a.name}» · ${describeSchedule(schedule)} · importancia ${a.importance ?? 3}${target.trimEnd()}`;
  },
  run: async (a, ctx) => {
    const habit = await createHabit(ctx.db, {
      name: a.name,
      description: a.description,
      icon: a.icon,
      startDate: ctx.today,
      config: {
        effort: a.importance ?? 3,
        schedule: buildSchedule(a),
        target: a.targetQuantity ? { quantity: a.targetQuantity, unit: a.targetUnit ?? '' } : null,
      },
    });
    return { id: habit.id };
  },
});

const createNote = tool({
  name: 'create_note',
  kind: 'write',
  description: 'Crea una nota de texto (cada línea es un párrafo).',
  args: z.object({
    title: z.string().max(500),
    text: z.string().max(100_000),
  }),
  describe: async (a) => {
    const preview = a.text.replace(/\s+/g, ' ').trim();
    return `Crear nota «${a.title || 'Sin título'}»${preview ? `: ${preview.slice(0, 120)}${preview.length > 120 ? '…' : ''}` : ''}`;
  },
  run: async (a, ctx) => {
    const note = await ctx.db.repo('notes').create({
      folderId: null,
      title: a.title,
      content: JSON.stringify(textToDoc(a.text)),
      plainText: a.text,
      tagIds: [],
      pinned: false,
      isPrivate: false,
      privateBlob: null,
    });
    return { id: note.id };
  },
});

export const ASSISTANT_TOOLS: AssistantTool[] = [
  listTasks,
  listHabits,
  getFarm,
  searchNotes,
  readNote,
  createTask,
  updateTask,
  completeTaskTool,
  reopenTaskTool,
  deleteTask,
  logHabit,
  createHabitTool,
  createNote,
];

/** Descripción de las herramientas para el modelo (JSON Schema). */
export function toolSpecs(tools: AssistantTool[] = ASSISTANT_TOOLS): ToolSpec[] {
  return tools.map((t) => {
    const parameters: Record<string, unknown> = z.toJSONSchema(t.args, { io: 'input' });
    delete parameters.$schema;
    return { name: t.name, description: t.description, parameters };
  });
}
