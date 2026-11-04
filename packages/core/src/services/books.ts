import type { Database, EntityPatch } from '../db/database';
import { NotFoundError } from '../db/database';
import { readingGoalKey } from '../domain/books';
import type { Book, BookQuote, BookStatus } from '../model/types';
import type { LocalDate } from '../util/dates';
import { deterministicId } from '../util/ids';
import { putSetting } from './private-notes';

// Escrituras de la lista de libros. No intervienen en el juego.

export class BookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookError';
  }
}

export function readingLogId(bookId: string, date: LocalDate): string {
  return deterministicId('readingLog', bookId, date);
}

export interface NewBookInput {
  title: string;
  author?: string;
  pages?: number | null;
  coverUrl?: string | null;
  isbn?: string | null;
  status?: BookStatus;
}

async function getBook(db: Database, id: string): Promise<Book> {
  const book = await db.repo('books').get(id);
  if (!book) throw new NotFoundError('books', id);
  return book;
}

/** Cambios de fechas y página que implica pasar a un estado. */
function statusChange(book: Book, status: BookStatus, today: LocalDate): EntityPatch<'books'> {
  if (status === 'read')
    return {
      status,
      finishedOn: book.finishedOn ?? today,
      currentPage: book.pages ?? book.currentPage,
    };
  return {
    status,
    finishedOn: null,
    ...(status === 'reading' ? { startedOn: book.startedOn ?? today } : {}),
  };
}

export async function createBook(
  db: Database,
  input: NewBookInput,
  today: LocalDate,
): Promise<Book> {
  const title = input.title.trim();
  if (!title) throw new BookError('El libro necesita un título');
  const book = await db.repo('books').create({
    title,
    author: (input.author ?? '').trim(),
    pages: input.pages ?? null,
    coverUrl: input.coverUrl ?? null,
    isbn: input.isbn ?? null,
    status: 'want',
    currentPage: 0,
    startedOn: null,
    finishedOn: null,
    rating: null,
    review: '',
    tagIds: [],
  });
  return input.status && input.status !== 'want'
    ? setBookStatus(db, book.id, input.status, today)
    : book;
}

export async function updateBook(
  db: Database,
  id: string,
  patch: EntityPatch<'books'>,
): Promise<Book> {
  const book = await getBook(db, id);
  const next = { ...book, ...patch };
  if (next.rating !== null && !Number.isInteger(next.rating * 2))
    throw new BookError('La nota va de media en media estrella');
  if (next.rating !== null && (next.rating < 0.5 || next.rating > 5))
    throw new BookError('La nota va de 0,5 a 5 estrellas');
  if (!next.title.trim()) throw new BookError('El libro necesita un título');
  if (next.startedOn && next.finishedOn && next.finishedOn < next.startedOn)
    throw new BookError('El libro no puede terminar antes de empezar');
  return db.repo('books').update(id, patch);
}

export async function setBookStatus(
  db: Database,
  id: string,
  status: BookStatus,
  today: LocalDate,
): Promise<Book> {
  const book = await getBook(db, id);
  if (book.status === status) return book;
  return db.repo('books').update(id, statusChange(book, status, today));
}

/**
 * Apunta la página por la que se va y guarda lo leído hoy. Mueve el libro de
 * estantería si hace falta: empezar lo pone en Leyendo y llegar al final, en Leídos.
 */
export async function setBookProgress(
  db: Database,
  id: string,
  page: number,
  today: LocalDate,
): Promise<Book> {
  if (!Number.isFinite(page)) throw new BookError('La página tiene que ser un número');
  const book = await getBook(db, id);
  const max = book.pages ?? Number.MAX_SAFE_INTEGER;
  const current = Math.max(0, Math.min(max, Math.trunc(page)));
  // Sin total no se sabe cuándo se acaba: uno ya leído sigue leído.
  const status: BookStatus =
    book.pages !== null
      ? current >= book.pages
        ? 'read'
        : 'reading'
      : book.status === 'read'
        ? 'read'
        : 'reading';
  if (current === book.currentPage && status === book.status) return book;

  const logs = db.repo('readingLogs');
  const logId = readingLogId(id, today);
  const existing = await logs.get(logId);
  await logs.put(logId, {
    bookId: id,
    date: today,
    fromPage: existing?.fromPage ?? book.currentPage,
    page: current,
  });

  return db.repo('books').update(id, {
    ...(status === book.status ? {} : statusChange(book, status, today)),
    currentPage: current,
  });
}

/** Borra el libro con sus citas y registros. */
export async function deleteBook(db: Database, id: string): Promise<void> {
  const quotes = await db.repo('bookQuotes').list();
  for (const q of quotes) if (q.bookId === id) await db.repo('bookQuotes').remove(q.id);
  const logs = await db.repo('readingLogs').list();
  for (const l of logs) if (l.bookId === id) await db.repo('readingLogs').remove(l.id);
  await db.repo('books').remove(id);
}

export async function addBookQuote(
  db: Database,
  bookId: string,
  text: string,
  page: number | null,
): Promise<BookQuote> {
  const clean = text.trim();
  if (!clean) throw new BookError('La cita está vacía');
  return db.repo('bookQuotes').create({ bookId, text: clean, page });
}

export async function deleteBookQuote(db: Database, id: string): Promise<void> {
  await db.repo('bookQuotes').remove(id);
}

export async function setReadingGoal(db: Database, year: number, goal: number): Promise<void> {
  if (!Number.isInteger(goal) || goal < 1) throw new BookError('El reto es un número de libros');
  await putSetting(db, readingGoalKey(year), String(goal));
}
