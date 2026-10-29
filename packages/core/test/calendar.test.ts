import { describe, expect, it } from 'vitest';
import { Database } from '../src/db/database';
import { getSchemaVersion, migrate, MIGRATIONS } from '../src/db/migrations';
import { monthGrid, shiftMonth, tasksInRange } from '../src/domain/calendar';
import {
  addFileCalendar,
  addUrlCalendar,
  getCachedIcs,
  normalizeCalendarUrl,
  removeCalendar,
  setCachedIcs,
  sourceIcs,
} from '../src/services/calendar';
import { makeTask, noon, openTestDb } from './helpers/fixtures';
import { NodeSqliteDriver } from './helpers/node-sqlite-driver';

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:1',
  'SUMMARY:Clase',
  'DTSTART:20261026T090000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('cuadrícula del mes', () => {
  it('6 semanas que empiezan en lunes', () => {
    const grid = monthGrid('2026-10');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-09-28'); // lunes anterior al 1 de octubre (jueves)
    expect(grid).toContain('2026-10-31');
  });

  it('cambia de mes y de año', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('tareas en el calendario', () => {
  it('incluye las repeticiones futuras de las tareas recurrentes', () => {
    const weekly = makeTask({ title: 'Lavadora', dueDate: '2026-10-05', rrule: 'FREQ=WEEKLY' });
    const once = makeTask({ title: 'Examen', dueDate: '2026-10-20', dueTime: '09:00' });
    const out = makeTask({ title: 'Fuera', dueDate: '2026-11-20' });
    const list = tasksInRange([weekly, once, out], '2026-10-01', '2026-10-31');
    expect(list.map((a) => [a.date, a.task.title, a.upcoming])).toEqual([
      ['2026-10-05', 'Lavadora', false],
      ['2026-10-12', 'Lavadora', true],
      ['2026-10-19', 'Lavadora', true],
      ['2026-10-20', 'Examen', false],
      ['2026-10-26', 'Lavadora', true],
    ]);
  });
});

describe('fuentes de calendario', () => {
  it('acepta https y webcal, pero no http', () => {
    expect(normalizeCalendarUrl(' webcal://ejemplo.es/cal.ics ')).toBe(
      'https://ejemplo.es/cal.ics',
    );
    expect(() => normalizeCalendarUrl('http://ejemplo.es/cal.ics')).toThrow(/https/);
    expect(() => normalizeCalendarUrl('no es una url')).toThrow();
  });

  it('un archivo importado guarda su contenido; una URL usa la caché local', async () => {
    const { db } = await openTestDb(noon('2026-10-24'));
    const file = await addFileCalendar(db, 'Universidad', ICS, '#5b9cf0');
    expect(await sourceIcs(db, file)).toBe(ICS);

    const sub = await addUrlCalendar(db, 'Google', 'webcal://calendar.google.com/x.ics', '#e3a33b');
    expect(await sourceIcs(db, sub)).toBeNull();
    expect(await setCachedIcs(db, sub.id, ICS, 123)).toBe(1);
    expect(await getCachedIcs(db, sub.id)).toEqual({ ics: ICS, fetchedAt: 123 });

    await removeCalendar(db, sub.id);
    expect(await getCachedIcs(db, sub.id)).toBeNull();
    expect((await db.repo('calendarSources').list()).map((s) => s.name)).toEqual(['Universidad']);
  });

  it('no guarda en la caché algo que no es un calendario', async () => {
    const { db } = await openTestDb(noon('2026-10-24'));
    await expect(setCachedIcs(db, 'x', '<html>error 404</html>', 1)).rejects.toThrow();
    expect(await getCachedIcs(db, 'x')).toBeNull();
  });

  it('la caché no viaja en las copias ni en la sincronización', async () => {
    const { db } = await openTestDb(noon('2026-10-24'));
    const sub = await addUrlCalendar(db, 'Google', 'https://x.es/a.ics', '#fff');
    await setCachedIcs(db, sub.id, ICS, 1);
    const dataset = await db.exportDataset();
    expect(JSON.stringify(dataset)).not.toContain('SUMMARY:Clase');
    expect(dataset.calendarSources).toHaveLength(1);
  });
});

describe('migración 2', () => {
  it('una base de datos de la versión 1 se actualiza sin perder datos', async () => {
    const driver = new NodeSqliteDriver();
    await migrate(driver, MIGRATIONS.slice(0, 1));
    await driver.execute(
      `INSERT INTO tags (id, created_at, updated_at, deleted_at, name, color) VALUES ('t1', 1, 1, NULL, 'Uni', '#fff')`,
    );
    const db = await Database.open(driver);
    expect(await getSchemaVersion(driver)).toBe(2);
    expect((await db.repo('tags').list()).map((t) => t.name)).toEqual(['Uni']);
    expect(await db.repo('calendarSources').list()).toEqual([]);
  });
});
