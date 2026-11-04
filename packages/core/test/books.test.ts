import { describe, expect, it } from 'vitest';
import {
  bookSearchUrl,
  isAllowedCover,
  normalizeIsbn,
  parseBookSearch,
} from '../src/domain/book-search';
import {
  bookPercent,
  booksOnShelf,
  finishedIn,
  parseReadingGoal,
  readingStats,
} from '../src/domain/books';
import {
  addBookQuote,
  BookError,
  createBook,
  deleteBook,
  deleteBookQuote,
  readingLogId,
  setBookProgress,
  setBookStatus,
  setReadingGoal,
  updateBook,
} from '../src/services/books';
import { getSetting } from '../src/services/private-notes';
import { computeGame } from '../src/game/creatures';
import { makeBook, makeReadingLog, noon, openTestDb } from './helpers/fixtures';

const TODAY = '2026-11-04';
const open = () => openTestDb(noon(TODAY));

describe('progreso de lectura', () => {
  const started = async (over = {}) => {
    const { db } = await open();
    const book = await createBook(db, { title: 'Libro', pages: 300, ...over }, TODAY);
    return { db, book };
  };

  it('un libro nuevo va a Por leer, sin fechas', async () => {
    const { book } = await started();
    expect(book).toMatchObject({ status: 'want', currentPage: 0, startedOn: null });
  });

  it('rechaza un libro sin título y guarda el resto limpio', async () => {
    const { db } = await open();
    await expect(createBook(db, { title: '   ' }, TODAY)).rejects.toBeInstanceOf(BookError);
    const b = await createBook(db, { title: ' Uno ', author: ' Ana ' }, TODAY);
    expect(b).toMatchObject({ title: 'Uno', author: 'Ana', pages: null });
  });

  it('apuntar página en Por leer lo pasa a Leyendo con la fecha de hoy', async () => {
    const { db, book } = await started();
    const b = await setBookProgress(db, book.id, 20, TODAY);
    expect(b).toMatchObject({ status: 'reading', currentPage: 20, startedOn: TODAY });
  });

  it('no cambia una fecha de inicio que ya tenía', async () => {
    const { db, book } = await started();
    await updateBook(db, book.id, { startedOn: '2026-10-01' });
    const b = await setBookProgress(db, book.id, 20, TODAY);
    expect(b.startedOn).toBe('2026-10-01');
  });

  it('apuntar página en Abandonados lo devuelve a Leyendo', async () => {
    const { db, book } = await started();
    await setBookStatus(db, book.id, 'abandoned', TODAY);
    expect((await setBookProgress(db, book.id, 5, TODAY)).status).toBe('reading');
  });

  it('la última página lo pasa a Leídos y bajar lo devuelve a Leyendo', async () => {
    const { db, book } = await started();
    const done = await setBookProgress(db, book.id, 300, TODAY);
    expect(done).toMatchObject({ status: 'read', finishedOn: TODAY, currentPage: 300 });
    const back = await setBookProgress(db, book.id, 299, TODAY);
    expect(back).toMatchObject({ status: 'reading', finishedOn: null, currentPage: 299 });
  });

  it('limita la página al total y a cero', async () => {
    const { db, book } = await started();
    expect((await setBookProgress(db, book.id, 999, TODAY)).currentPage).toBe(300);
    expect((await setBookProgress(db, book.id, -4, TODAY)).currentPage).toBe(0);
    await expect(setBookProgress(db, book.id, Number.NaN, TODAY)).rejects.toBeInstanceOf(BookError);
  });

  it('sin total de páginas nunca pasa a Leídos solo', async () => {
    const { db, book } = await started({ pages: null });
    const b = await setBookProgress(db, book.id, 5000, TODAY);
    expect(b).toMatchObject({ status: 'reading', currentPage: 5000 });
    expect(bookPercent(b)).toBeNull();
  });

  it('un libro leído sin total de páginas sigue leído al apuntar una página', async () => {
    const { db, book } = await started({ pages: null });
    await setBookStatus(db, book.id, 'read', '2026-03-10');
    const b = await setBookProgress(db, book.id, 350, TODAY);
    expect(b).toMatchObject({ status: 'read', finishedOn: '2026-03-10', currentPage: 350 });
  });

  it('varias veces el mismo día: una fila y el inicio no cambia', async () => {
    const { db, book } = await started();
    await setBookProgress(db, book.id, 10, TODAY);
    await setBookProgress(db, book.id, 30, TODAY);
    const logs = await db.repo('readingLogs').list();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: readingLogId(book.id, TODAY),
      fromPage: 0,
      page: 30,
      date: TODAY,
    });
  });

  it('al día siguiente empieza desde donde iba', async () => {
    const { db, book } = await started();
    await setBookProgress(db, book.id, 10, '2026-11-03');
    await setBookProgress(db, book.id, 30, TODAY);
    const log = await db.repo('readingLogs').get(readingLogId(book.id, TODAY));
    expect(log).toMatchObject({ fromPage: 10, page: 30 });
  });

  it('apuntar la misma página no escribe nada', async () => {
    const { db, book } = await started();
    await setBookProgress(db, book.id, 10, TODAY);
    const before = await db.repo('books').get(book.id);
    const same = await setBookProgress(db, book.id, 10, TODAY);
    expect(same.updatedAt).toBe(before!.updatedAt);
  });
});

describe('estado del libro', () => {
  it('marcar Leído pone la página final y la fecha', async () => {
    const { db } = await open();
    const { id } = await createBook(db, { title: 'L', pages: 100 }, TODAY);
    const b = await setBookStatus(db, id, 'read', TODAY);
    expect(b).toMatchObject({ status: 'read', currentPage: 100, finishedOn: TODAY });
  });

  it('marcar Leído respeta una fecha de fin ya puesta', async () => {
    const { db } = await open();
    const { id } = await createBook(db, { title: 'L' }, TODAY);
    await updateBook(db, id, { finishedOn: '2025-03-01' });
    expect((await setBookStatus(db, id, 'read', TODAY)).finishedOn).toBe('2025-03-01');
  });

  it('dejar de estar leído quita la fecha de fin', async () => {
    const { db } = await open();
    const { id } = await createBook(db, { title: 'L' }, TODAY);
    await setBookStatus(db, id, 'read', TODAY);
    const b = await setBookStatus(db, id, 'reading', TODAY);
    expect(b).toMatchObject({ status: 'reading', finishedOn: null, startedOn: TODAY });
  });

  it('rechaza una nota que no va de media en media estrella', async () => {
    const { db } = await open();
    const { id } = await createBook(db, { title: 'L' }, TODAY);
    await expect(updateBook(db, id, { rating: 3.3 })).rejects.toBeInstanceOf(BookError);
    await expect(updateBook(db, id, { rating: 5.5 })).rejects.toBeInstanceOf(BookError);
    expect((await updateBook(db, id, { rating: 3.5 })).rating).toBe(3.5);
    expect((await updateBook(db, id, { rating: null })).rating).toBeNull();
  });

  it('rechaza terminar antes de empezar', async () => {
    const { db } = await open();
    const { id } = await createBook(db, { title: 'L' }, TODAY);
    await updateBook(db, id, { startedOn: '2026-10-10' });
    await expect(updateBook(db, id, { finishedOn: '2026-10-01' })).rejects.toBeInstanceOf(
      BookError,
    );
  });
});

describe('citas y borrado', () => {
  it('borrar un libro borra sus citas y registros, y vacía su contenido', async () => {
    const { db } = await open();
    const { id } = await createBook(db, { title: 'L', author: 'A', pages: 10 }, TODAY);
    await updateBook(db, id, { review: 'Secreto' });
    await addBookQuote(db, id, 'Una frase', 3);
    await setBookProgress(db, id, 3, TODAY);
    await deleteBook(db, id);
    expect(await db.repo('books').list()).toEqual([]);
    expect(await db.repo('bookQuotes').list()).toEqual([]);
    expect(await db.repo('readingLogs').list()).toEqual([]);
    const gone = await db.repo('books').get(id, { includeDeleted: true });
    expect(gone).toMatchObject({ title: '', author: '', review: '' });
  });

  it('una cita necesita texto y se puede borrar', async () => {
    const { db } = await open();
    const { id } = await createBook(db, { title: 'L' }, TODAY);
    await expect(addBookQuote(db, id, '  ', null)).rejects.toBeInstanceOf(BookError);
    const q = await addBookQuote(db, id, ' Frase ', null);
    expect(q).toMatchObject({ bookId: id, text: 'Frase', page: null });
    await deleteBookQuote(db, q.id);
    expect(await db.repo('bookQuotes').list()).toEqual([]);
  });
});

describe('estanterías y estadísticas', () => {
  it('cada estantería tiene su orden', () => {
    const a = makeBook({ title: 'A', status: 'read', finishedOn: '2026-01-01' });
    const b = makeBook({ title: 'B', status: 'read', finishedOn: '2026-05-01' });
    const c = makeBook({ title: 'C', status: 'reading', startedOn: '2026-04-01' });
    const d = makeBook({ title: 'D', status: 'reading', startedOn: '2026-06-01' });
    const del = makeBook({ title: 'E', status: 'read', deletedAt: 5 });
    const all = [a, b, c, d, del];
    expect(booksOnShelf(all, 'read').map((x) => x.title)).toEqual(['B', 'A']);
    expect(booksOnShelf(all, 'reading').map((x) => x.title)).toEqual(['D', 'C']);
  });

  it('el porcentaje no pasa de 100', () => {
    expect(bookPercent(makeBook({ pages: 200, currentPage: 50 }))).toBe(25);
    expect(bookPercent(makeBook({ pages: 200, currentPage: 900 }))).toBe(100);
    expect(bookPercent(makeBook({ pages: null, currentPage: 50 }))).toBeNull();
  });

  it('el reto cuenta los terminados ese año, sin los borrados', () => {
    const books = [
      makeBook({ status: 'read', finishedOn: '2026-02-01' }),
      makeBook({ status: 'read', finishedOn: '2025-02-01' }),
      makeBook({ status: 'reading', finishedOn: null }),
      makeBook({ status: 'read', finishedOn: '2026-03-01', deletedAt: 5 }),
    ];
    expect(finishedIn(books, 2026)).toBe(1);
  });

  it('calcula las estadísticas de un caso conocido', () => {
    const uno = makeBook({
      author: 'Ana',
      status: 'read',
      pages: 200,
      rating: 4,
      startedOn: '2026-01-01',
      finishedOn: '2026-01-11',
    });
    const dos = makeBook({
      author: 'Ana',
      status: 'read',
      pages: 100,
      rating: 5,
      startedOn: '2026-03-01',
      finishedOn: '2026-03-21',
    });
    const tres = makeBook({
      author: 'Berta',
      status: 'read',
      pages: 400,
      finishedOn: '2025-07-01',
    });
    const leyendo = makeBook({ author: 'Carla', status: 'reading', pages: 500, currentPage: 40 });
    const logs = [
      makeReadingLog(leyendo, '2026-11-01', 0, 30),
      makeReadingLog(leyendo, '2026-11-03', 30, 40),
      makeReadingLog(leyendo, '2026-09-01', 0, 900),
      makeReadingLog(uno, '2026-11-02', 50, 40),
    ];
    const s = readingStats([uno, dos, tres, leyendo], logs, 2026, TODAY);
    expect(s.finished).toBe(2);
    expect(s.pages).toBe(300);
    expect(s.byYear).toEqual([
      { year: 2026, books: 2, pages: 300 },
      { year: 2025, books: 1, pages: 400 },
    ]);
    expect(s.byMonth[0]).toBe(1);
    expect(s.byMonth[2]).toBe(1);
    expect(s.byMonth).toHaveLength(12);
    expect(s.avgRating).toBe(4.5);
    expect(s.avgDays).toBe(15);
    expect(s.pagesLast30).toBe(40); // lo de septiembre queda fuera y retroceder no resta
    expect(s.topAuthors[0]).toEqual({ author: 'Ana', books: 2 });
  });

  it('sin datos no divide entre cero', () => {
    const s = readingStats([], [], 2026, TODAY);
    expect(s).toMatchObject({ finished: 0, avgRating: null, avgDays: null, pagesLast30: 0 });
  });
});

describe('reto anual', () => {
  it('se guarda como ajuste sincronizado', async () => {
    const { db } = await open();
    await setReadingGoal(db, 2026, 24);
    expect(parseReadingGoal(await getSetting(db, 'books.goal.2026'))).toBe(24);
  });

  it('rechaza objetivos que no valen y lee con cuidado', async () => {
    const { db } = await open();
    await expect(setReadingGoal(db, 2026, 0)).rejects.toBeInstanceOf(BookError);
    await expect(setReadingGoal(db, 2026, 1.5)).rejects.toBeInstanceOf(BookError);
    expect(parseReadingGoal(null)).toBeNull();
    expect(parseReadingGoal('abc')).toBeNull();
  });
});

describe('búsqueda en Open Library', () => {
  it('reconoce un ISBN con o sin guiones', () => {
    expect(normalizeIsbn('978-84-08-04364-5')).toBe('9788408043645');
    expect(normalizeIsbn('8408043641')).toBe('8408043641');
    expect(normalizeIsbn('080442957X')).toBe('080442957X');
    expect(normalizeIsbn('la sombra del viento')).toBeNull();
    expect(normalizeIsbn('12345')).toBeNull();
  });

  it('pide resultados en español y escapa la búsqueda', () => {
    const url = new URL(bookSearchUrl('cien años & soledad'));
    expect(url.origin).toBe('https://openlibrary.org');
    expect(url.searchParams.get('q')).toBe('cien años & soledad');
    expect(url.searchParams.get('lang')).toBe('es');
  });

  it('prefiere el título y la portada de la edición', () => {
    const [b] = parseBookSearch({
      docs: [
        {
          title: 'The Name of the Wind',
          author_name: ['Patrick Rothfuss'],
          number_of_pages_median: 736,
          cover_i: 111,
          isbn: ['9788401337208'],
          editions: { docs: [{ title: 'El nombre del viento', cover_i: 222 }] },
        },
      ],
    });
    expect(b).toEqual({
      title: 'El nombre del viento',
      author: 'Patrick Rothfuss',
      pages: 736,
      coverUrl: 'https://covers.openlibrary.org/b/id/222-M.jpg',
      isbn: '9788401337208',
    });
  });

  it('aguanta respuestas incompletas o raras', () => {
    expect(parseBookSearch(null)).toEqual([]);
    expect(parseBookSearch({ docs: 'nada' })).toEqual([]);
    const list = parseBookSearch({
      docs: [{ title: '  Solo   título\n  ' }, { author_name: ['Sin título'] }, 7],
    });
    expect(list).toEqual([
      { title: 'Solo título', author: '', pages: null, coverUrl: null, isbn: null },
    ]);
  });

  it('solo acepta portadas de Open Library', () => {
    expect(isAllowedCover('https://covers.openlibrary.org/b/id/1-M.jpg')).toBe(true);
    expect(isAllowedCover('https://evil.example/x.jpg')).toBe(false);
    expect(isAllowedCover('https://covers.openlibrary.org.evil.example/x.jpg')).toBe(false);
    expect(isAllowedCover('http://covers.openlibrary.org/b/id/1-M.jpg')).toBe(false);
    expect(isAllowedCover(null)).toBe(false);
  });
});

describe('los libros no tocan el juego', () => {
  it('el juego no recibe libros', () => {
    const s = computeGame({
      habits: [],
      logs: [],
      tasks: [],
      taskCompletions: [],
      purchases: [],
      vacations: [],
      today: TODAY,
    });
    expect(s.trainerXp).toBe(0);
    expect(Object.keys(s.weeks)).toEqual([]);
  });
});

describe('campos de la búsqueda', () => {
  it('pide `key`: sin él, Open Library no devuelve las ediciones', () => {
    const fields = new URL(bookSearchUrl('patria')).searchParams.get('fields')!.split(',');
    expect(fields).toEqual(expect.arrayContaining(['key', 'editions', 'editions.title']));
  });
});
