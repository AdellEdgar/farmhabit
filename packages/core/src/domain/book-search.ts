// Búsqueda de libros en Open Library: gratuita y sin clave. Aquí solo se monta
// la petición y se interpreta la respuesta; la descarga la hace la app.

const SEARCH_URL = 'https://openlibrary.org/search.json';
const COVERS_ORIGIN = 'https://covers.openlibrary.org';
// Sin `key`, Open Library devuelve `editions` vacío.
const FIELDS = [
  'key',
  'title',
  'author_name',
  'number_of_pages_median',
  'cover_i',
  'isbn',
  'editions',
  'editions.title',
  'editions.cover_i',
].join(',');

export interface BookCandidate {
  title: string;
  author: string;
  pages: number | null;
  coverUrl: string | null;
  isbn: string | null;
}

/** El ISBN sin guiones ni espacios, o null si el texto no lo parece. */
export function normalizeIsbn(text: string): string | null {
  const clean = text.replace(/[\s-]/g, '').toUpperCase();
  return /^(\d{13}|\d{9}[\dX])$/.test(clean) ? clean : null;
}

/** Con `lang=es`, cada resultado trae primero su edición en español. */
export function bookSearchUrl(query: string): string {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', normalizeIsbn(query) ?? query.trim());
  url.searchParams.set('lang', 'es');
  url.searchParams.set('limit', '12');
  url.searchParams.set('fields', FIELDS);
  return url.toString();
}

/** Solo se cargan portadas de Open Library: un enlace ajeno podría venir de un archivo. */
export function isAllowedCover(url: string | null): boolean {
  return url !== null && url.startsWith(`${COVERS_ORIGIN}/`);
}

const record = (v: unknown): Record<string, unknown> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const text = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const firstText = (v: unknown): string => (Array.isArray(v) ? text(v[0]) : '');
const coverId = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null;

/** Interpreta la respuesta sin fiarse de ella: lo que no se entiende se ignora. */
export function parseBookSearch(json: unknown): BookCandidate[] {
  const docs = record(json)?.docs;
  if (!Array.isArray(docs)) return [];
  const out: BookCandidate[] = [];
  for (const raw of docs) {
    const doc = record(raw);
    if (!doc) continue;
    const editions = record(doc.editions)?.docs;
    const edition = Array.isArray(editions) ? record(editions[0]) : null;
    const title = text(edition?.title).slice(0, 500) || text(doc.title).slice(0, 500);
    if (!title) continue;
    const pages = doc.number_of_pages_median;
    const cover = coverId(edition?.cover_i) ?? coverId(doc.cover_i);
    const isbn = firstText(doc.isbn).slice(0, 20);
    out.push({
      title,
      author: firstText(doc.author_name).slice(0, 300),
      pages: typeof pages === 'number' && Number.isInteger(pages) && pages > 0 ? pages : null,
      coverUrl: cover === null ? null : `${COVERS_ORIGIN}/b/id/${cover}-M.jpg`,
      isbn: isbn || null,
    });
  }
  return out;
}
