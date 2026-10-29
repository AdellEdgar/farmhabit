import {
  addDays,
  addFileCalendar,
  habitLogId,
  keyBetween,
  localDateOf,
  stableRandom,
  type Database,
  type HabitConfig,
  type NewEntity,
} from '@farmhabit/core';
import { isDesktopApp } from './drivers';

// Datos de ejemplo para la demo web (GitHub Pages) y para las capturas del
// README. Solo se usan en el modo navegador y solo si la base de datos está
// vacía. Nunca se cargan en la app instalada.

export const isDemo =
  !isDesktopApp &&
  (import.meta.env.VITE_DEMO === '1' || new URLSearchParams(location.search).has('demo'));

/** Aleatorio pero estable: la demo es siempre igual. */
const rand = stableRandom;

const daily = { type: 'daily' } as const;

interface DemoHabit {
  name: string;
  icon: string;
  color: string;
  config: Omit<HabitConfig, 'since'>;
  /** Probabilidad de cumplirlo cada día. */
  rate: number;
  reminder?: string;
}

const HABITS: DemoHabit[] = [
  {
    name: 'Hacer ejercicio',
    icon: '🏃',
    color: '#e5534b',
    config: { effort: 5, schedule: { type: 'weekdays', days: [1, 3, 5] }, target: null },
    rate: 0.8,
    reminder: '19:00',
  },
  {
    name: 'Leer 20 minutos',
    icon: '📚',
    color: '#5b9cf0',
    config: { effort: 3, schedule: daily, target: null },
    rate: 0.85,
    reminder: '22:00',
  },
  {
    name: 'Beber agua',
    icon: '💧',
    color: '#4fc1c6',
    config: { effort: 2, schedule: daily, target: { quantity: 2, unit: 'L' } },
    rate: 0.9,
  },
  {
    name: 'Hacer la cama',
    icon: '🛏️',
    color: '#a3a86b',
    config: { effort: 1, schedule: daily, target: null },
    rate: 0.95,
  },
  {
    name: 'Meditar',
    icon: '🧘',
    color: '#b57edc',
    config: { effort: 4, schedule: { type: 'timesPerWeek', times: 3 }, target: null },
    rate: 0.55,
  },
];

function demoIcs(today: string): string {
  // Clases semanales y un examen, como un horario de la universidad.
  const monday = addDays(today, 1 - (new Date(`${today}T12:00:00Z`).getUTCDay() || 7));
  const ymd = (d: string) => d.replace(/-/g, '');
  const ev = (
    uid: string,
    title: string,
    place: string,
    day: string,
    from: string,
    to: string,
    weekly: boolean,
  ) =>
    [
      'BEGIN:VEVENT',
      `UID:${uid}@demo`,
      `SUMMARY:${title}`,
      `LOCATION:${place}`,
      `DTSTART;TZID=Europe/Madrid:${ymd(day)}T${from}00`,
      `DTEND;TZID=Europe/Madrid:${ymd(day)}T${to}00`,
      ...(weekly ? ['RRULE:FREQ=WEEKLY;COUNT=15'] : []),
      'END:VEVENT',
    ].join('\r\n');
  const start = addDays(monday, -28);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FarmHabit//Demo//ES',
    ev('redes', 'Redes de computadores', 'Aula TD1201', start, '0900', '1100', true),
    ev('bbdd', 'Bases de datos', 'Laboratorio TI1102', addDays(start, 1), '1100', '1300', true),
    ev('ia', 'Inteligencia artificial', 'Aula TD1105', addDays(start, 3), '1500', '1700', true),
    ev(
      'examen',
      'Examen parcial de Bases de datos',
      'Aula Magna',
      addDays(today, 6),
      '1000',
      '1200',
      false,
    ),
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Rellena una base de datos vacía con datos de ejemplo. */
export async function seedDemo(db: Database): Promise<void> {
  if ((await db.repo('habits').list()).length > 0 || (await db.repo('tasks').list()).length > 0)
    return;
  const today = localDateOf(Date.now());
  const start = addDays(today, -45);

  // Etiquetas
  const tag = async (name: string, color: string) =>
    (await db.repo('tags').create({ name, color })).id;
  const uni = await tag('Universidad', '#5b9cf0');
  const casa = await tag('Casa', '#e3a33b');
  const personal = await tag('Personal', '#b57edc');

  // Tareas
  const task = (title: string, extra: Partial<NewEntity<'tasks'>>) =>
    db.repo('tasks').create({
      title,
      notes: '',
      priority: 2,
      status: 'pending',
      dueDate: null,
      dueTime: null,
      rrule: null,
      reminders: [],
      tagIds: [],
      completedAt: null,
      ...extra,
    });
  await task('Entregar la práctica 3 de Redes', {
    priority: 1,
    dueDate: addDays(today, 1),
    dueTime: '23:59',
    tagIds: [uni],
    reminders: [{ offsetMin: 1440 }, { offsetMin: 120 }],
    notes: 'Subir el informe en PDF y el código al aula virtual.',
  });
  await task('Repasar el tema 4 de Bases de datos', { priority: 1, dueDate: today, tagIds: [uni] });
  await task('Llamar al dentista para pedir cita', {
    priority: 2,
    dueDate: today,
    dueTime: '17:00',
    tagIds: [personal],
    reminders: [{ offsetMin: 30 }],
  });
  await task('Sacar la basura', {
    priority: 3,
    dueDate: addDays(today, 2),
    rrule: 'FREQ=WEEKLY;BYDAY=MO,TH',
    tagIds: [casa],
  });
  await task('Comprar el regalo de cumpleaños de Marta', {
    priority: 2,
    dueDate: addDays(today, 5),
    tagIds: [personal],
  });
  await task('Pagar el alquiler', {
    priority: 1,
    dueDate: addDays(today, 9),
    rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
    tagIds: [casa],
    reminders: [{ offsetMin: 1440 }],
  });
  await task('Preparar la presentación del TFG', { priority: 2, tagIds: [uni] });
  await task('Ordenar el armario', {
    priority: 3,
    tagIds: [casa],
    status: 'done',
    completedAt: Date.now() - 86_400_000,
  });

  // Hábitos con historial
  let sortKey: string | null = null;
  for (const h of HABITS) {
    sortKey = keyBetween(sortKey, null);
    const habit = await db.repo('habits').create({
      name: h.name,
      description: '',
      icon: h.icon,
      color: h.color,
      sortKey,
      startDate: start,
      configHistory: [{ ...h.config, since: start }],
      reminders: h.reminder ? [{ time: h.reminder, days: [] }] : [],
      archivedAt: null,
    });
    for (let d = start; d < today; d = addDays(d, 1)) {
      // Más constancia en las últimas semanas: la granja va a mejor.
      const boost = d > addDays(today, -21) ? 0.08 : -0.05;
      const r = rand(`${h.name}|${d}`);
      if (r > h.rate + boost) {
        if (r > 0.985) {
          await db.repo('habitLogs').put(habitLogId(habit.id, d), {
            habitId: habit.id,
            date: d,
            status: 'skipped',
            value: null,
          });
        }
        continue;
      }
      const value = h.config.target ? (r < 0.15 ? 1.5 : 2) : null;
      await db
        .repo('habitLogs')
        .put(habitLogId(habit.id, d), { habitId: habit.id, date: d, status: 'done', value });
    }
    // Hoy: algunos hechos ya, otros pendientes.
    if (h.config.effort <= 2) {
      await db.repo('habitLogs').put(habitLogId(habit.id, today), {
        habitId: habit.id,
        date: today,
        status: 'done',
        value: h.config.target ? 1.5 : null,
      });
    }
  }

  // Granja
  const animal = (
    name: string,
    species: 'chicken' | 'rabbit' | 'sheep',
    acquiredOn: string,
    source: 'starter' | 'bought',
    price: number,
  ) => db.repo('animals').create({ name, species, acquiredOn, source, price });
  await animal('Copito', 'chicken', start, 'starter', 0);
  await animal('Pelusa', 'rabbit', addDays(start, 18), 'bought', 80);
  await animal('Lana', 'sheep', addDays(start, 32), 'bought', 150);

  // Notas
  const folder = await db
    .repo('noteFolders')
    .create({ name: 'Universidad', parentId: null, sortKey: keyBetween(null, null) });
  const note = (
    title: string,
    json: object,
    plainText: string,
    extra: { pinned?: boolean; folderId?: string | null; tagIds?: string[] } = {},
  ) =>
    db.repo('notes').create({
      title,
      content: JSON.stringify(json),
      plainText,
      folderId: extra.folderId ?? null,
      tagIds: extra.tagIds ?? [],
      pinned: extra.pinned ?? false,
      isPrivate: false,
      privateBlob: null,
    });
  const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  const item = (text: string, checked: boolean) => ({
    type: 'taskItem',
    attrs: { checked },
    content: [p(text)],
  });
  await note(
    'Lista de la compra',
    {
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            item('Leche y huevos', true),
            item('Pan integral', false),
            item('Fruta para la semana', false),
            item('Café', false),
          ],
        },
      ],
    },
    'Leche y huevos\nPan integral\nFruta para la semana\nCafé',
    { pinned: true, tagIds: [casa] },
  );
  await note(
    'Ideas para el TFG',
    {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Opciones' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [p('App local-first con sincronización cifrada')] },
            { type: 'listItem', content: [p('Detección de anomalías en redes con ML')] },
          ],
        },
        p('Hablar con la tutora antes del viernes.'),
      ],
    },
    'Opciones\nApp local-first con sincronización cifrada\nDetección de anomalías en redes con ML\nHablar con la tutora antes del viernes.',
    { folderId: folder.id, tagIds: [uni] },
  );
  await note(
    'Frases que me gustan',
    { type: 'doc', content: [p('«Somos lo que hacemos repetidamente.» — Will Durant')] },
    '«Somos lo que hacemos repetidamente.» — Will Durant',
    { tagIds: [personal] },
  );

  // Calendario de la universidad
  await addFileCalendar(db, 'Horario UJI (ejemplo)', demoIcs(today), '#5b9cf0');
}

/** Borra la demo del navegador y vuelve a empezar. */
export function resetDemo(): void {
  try {
    localStorage.removeItem('farmhabit:demo-db');
  } catch {
    // sin almacenamiento: basta con recargar
  }
  location.reload();
}
