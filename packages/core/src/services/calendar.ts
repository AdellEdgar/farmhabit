import type { Database } from '../db/database';
import { parseIcs } from '../domain/ics';
import type { CalendarSource } from '../model/types';

// Calendarios externos sobre la base de datos: caché local de lo descargado
// y alta de fuentes.

export class CalendarSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarSourceError';
  }
}

/** webcal:// es https:// con otro nombre; solo se aceptan direcciones https. */
export function normalizeCalendarUrl(input: string): string {
  const url = input.trim().replace(/^webcals?:\/\//i, 'https://');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CalendarSourceError('La dirección no es válida');
  }
  if (parsed.protocol !== 'https:') {
    throw new CalendarSourceError('La dirección tiene que empezar por https:// o webcal://');
  }
  return parsed.toString();
}

export async function getCachedIcs(
  db: Database,
  sourceId: string,
): Promise<{ ics: string; fetchedAt: number } | null> {
  const rows = await db.driver.select<{ ics: string; fetched_at: number }>(
    `SELECT ics, fetched_at FROM calendar_cache WHERE source_id = ?`,
    [sourceId],
  );
  return rows[0] ? { ics: rows[0].ics, fetchedAt: Number(rows[0].fetched_at) } : null;
}

/** Guarda lo descargado si es un calendario válido (si no, lanza y no toca la caché). */
export async function setCachedIcs(
  db: Database,
  sourceId: string,
  ics: string,
  now: number,
): Promise<number> {
  const count = parseIcs(ics).length;
  await db.driver.execute(
    `INSERT INTO calendar_cache (source_id, fetched_at, ics) VALUES (?, ?, ?)
     ON CONFLICT(source_id) DO UPDATE SET fetched_at = excluded.fetched_at, ics = excluded.ics`,
    [sourceId, now, ics],
  );
  return count;
}

export async function deleteCachedIcs(db: Database, sourceId: string): Promise<void> {
  await db.driver.execute(`DELETE FROM calendar_cache WHERE source_id = ?`, [sourceId]);
}

/** Texto .ics de una fuente: el del archivo importado o el de la caché. */
export async function sourceIcs(db: Database, source: CalendarSource): Promise<string | null> {
  if (source.kind === 'file') return source.ics;
  return (await getCachedIcs(db, source.id))?.ics ?? null;
}

export async function addFileCalendar(
  db: Database,
  name: string,
  ics: string,
  color: string,
): Promise<CalendarSource> {
  parseIcs(ics); // valida antes de guardar
  return db.repo('calendarSources').create({
    name: name.trim() || 'Calendario',
    kind: 'file',
    url: null,
    ics,
    color,
    visible: true,
  });
}

export async function addUrlCalendar(
  db: Database,
  name: string,
  url: string,
  color: string,
): Promise<CalendarSource> {
  return db.repo('calendarSources').create({
    name: name.trim() || 'Calendario',
    kind: 'url',
    url: normalizeCalendarUrl(url),
    ics: null,
    color,
    visible: true,
  });
}

export async function removeCalendar(db: Database, id: string): Promise<void> {
  await db.repo('calendarSources').remove(id);
  await deleteCachedIcs(db, id);
}
