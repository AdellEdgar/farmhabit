import type { Book, BookStatus, ReadingLog } from '../model/types';
import type { LocalDate } from '../util/dates';
import { addDays, diffDays } from '../util/dates';

// Estanterías, porcentaje y estadísticas de la lista de libros.

const DAYS_FOR_PACE = 30;
const TOP_AUTHORS = 5;

/** La fecha que ordena cada estantería: lo más reciente, primero. */
function shelfDate(b: Book): string {
  if (b.status === 'read') return b.finishedOn ?? '';
  if (b.status === 'reading') return b.startedOn ?? '';
  return '';
}

export function booksOnShelf(books: Book[], shelf: BookStatus): Book[] {
  return books
    .filter((b) => b.deletedAt === null && b.status === shelf)
    .sort(
      (a, b) =>
        shelfDate(b).localeCompare(shelfDate(a)) ||
        b.createdAt - a.createdAt ||
        a.title.localeCompare(b.title),
    );
}

/** Porcentaje leído, o null si no se conoce el total de páginas. */
export function bookPercent(book: Book): number | null {
  if (book.pages === null) return null;
  return Math.min(100, Math.round((book.currentPage / book.pages) * 100));
}

const finished = (books: Book[]) =>
  books.filter((b) => b.deletedAt === null && b.status === 'read' && b.finishedOn !== null);

export function finishedIn(books: Book[], year: number): number {
  return finished(books).filter((b) => b.finishedOn!.startsWith(`${year}-`)).length;
}

export interface ReadingStats {
  /** Libros y páginas terminados en el año pedido. */
  finished: number;
  pages: number;
  /** Libros terminados cada mes del año pedido (12 valores). */
  byMonth: number[];
  /** Todos los años con libros terminados, el más reciente primero. */
  byYear: { year: number; books: number; pages: number }[];
  avgRating: number | null;
  avgDays: number | null;
  /** Páginas leídas en los últimos 30 días, de los registros diarios. */
  pagesLast30: number;
  topAuthors: { author: string; books: number }[];
}

export function readingStats(
  books: Book[],
  logs: ReadingLog[],
  year: number,
  today: LocalDate,
): ReadingStats {
  const done = finished(books);
  const inYear = done.filter((b) => b.finishedOn!.startsWith(`${year}-`));

  const years = new Map<number, { books: number; pages: number }>();
  for (const b of done) {
    const y = Number(b.finishedOn!.slice(0, 4));
    const row = years.get(y) ?? { books: 0, pages: 0 };
    row.books++;
    row.pages += b.pages ?? 0;
    years.set(y, row);
  }

  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const b of inYear) byMonth[Number(b.finishedOn!.slice(5, 7)) - 1]!++;

  const rated = done.filter((b) => b.rating !== null);
  const dated = done.filter((b) => b.startedOn !== null && b.startedOn <= b.finishedOn!);

  const from = addDays(today, -DAYS_FOR_PACE);
  let pagesLast30 = 0;
  for (const l of logs) {
    if (l.deletedAt !== null || l.date <= from || l.date > today) continue;
    pagesLast30 += Math.max(0, l.page - l.fromPage);
  }

  const authors = new Map<string, number>();
  for (const b of done) if (b.author) authors.set(b.author, (authors.get(b.author) ?? 0) + 1);

  return {
    finished: inYear.length,
    pages: inYear.reduce((sum, b) => sum + (b.pages ?? 0), 0),
    byMonth,
    byYear: [...years.entries()]
      .map(([y, row]) => ({ year: y, ...row }))
      .sort((a, b) => b.year - a.year),
    avgRating:
      rated.length > 0 ? rated.reduce((sum, b) => sum + b.rating!, 0) / rated.length : null,
    avgDays:
      dated.length > 0
        ? Math.round(
            dated.reduce((sum, b) => sum + diffDays(b.startedOn!, b.finishedOn!), 0) / dated.length,
          )
        : null,
    pagesLast30,
    topAuthors: [...authors.entries()]
      .map(([author, count]) => ({ author, books: count }))
      .sort((a, b) => b.books - a.books || a.author.localeCompare(b.author))
      .slice(0, TOP_AUTHORS),
  };
}

/** Clave del ajuste sincronizado con el reto de un año. */
export function readingGoalKey(year: number): string {
  return `books.goal.${year}`;
}

export function parseReadingGoal(value: string | null | undefined): number | null {
  const n = Number(value);
  return value && Number.isInteger(n) && n > 0 ? n : null;
}
