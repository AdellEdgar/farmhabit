import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { createBook, type BookCandidate, type BookStatus } from '@farmhabit/core';
import { searchBooks } from '../../lib/book-search';
import { useApp } from '../../lib/use-app';
import { Button, Dialog, EmptyState, Field, Input, Segmented } from '../../components/ui';
import { BookCover } from './BookCover';

type Mode = 'buscar' | 'mano';
const MODES: { value: Mode; label: string }[] = [
  { value: 'buscar', label: 'Buscar' },
  { value: 'mano', label: 'A mano' },
];

/** Añadir un libro: buscándolo en Open Library o escribiéndolo a mano. */
export function AddBookDialog({
  shelf,
  onClose,
}: {
  /** Estantería en la que se está: el libro nuevo va a ella. */
  shelf: BookStatus;
  onClose: () => void;
}) {
  const { mutate, today, toast } = useApp();
  const [mode, setMode] = useState<Mode>('buscar');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await searchBooks(query));
    } catch (err) {
      setResults(null);
      setError(err instanceof Error ? err.message : 'No se pudo buscar.');
    } finally {
      setBusy(false);
    }
  };

  const add = async (input: Parameters<typeof createBook>[1]) => {
    const ok = await mutate((db) => createBook(db, { ...input, status: shelf }, today));
    if (!ok) return;
    toast(`«${ok.title}» añadido`);
    onClose();
  };

  const addManual = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(pages);
    void add({ title, author, pages: Number.isInteger(n) && n > 0 ? n : null });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Añadir libro">
      <Segmented value={mode} options={MODES} onChange={setMode} />

      {mode === 'buscar' ? (
        <>
          <form onSubmit={(e) => void search(e)} className="flex gap-2">
            <Input
              autoFocus
              placeholder="Título, autor o ISBN"
              value={query}
              maxLength={200}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar libro"
            />
            <Button type="submit" variant="primary" disabled={!query.trim() || busy}>
              <Search size={16} /> {busy ? 'Buscando…' : 'Buscar'}
            </Button>
          </form>
          <p className="text-xs text-texto-suave">
            Lo que buscas se envía a Open Library, y las portadas se piden a su servidor.
          </p>
          {error && <p className="text-sm text-peligro">{error}</p>}
          {results?.length === 0 && (
            <EmptyState icon="🔍" title="Sin resultados">
              Prueba con otras palabras o el ISBN, o añádelo a mano.
            </EmptyState>
          )}
          {results && results.length > 0 && (
            <ul className="space-y-1">
              {results.map((r, i) => (
                <li key={`${r.title}|${r.author}|${i}`}>
                  <button
                    type="button"
                    onClick={() => void add(r)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-elevado"
                  >
                    <BookCover title={r.title} coverUrl={r.coverUrl} className="w-12" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 block text-sm font-medium">{r.title}</span>
                      <span className="block truncate text-xs text-texto-suave">
                        {[r.author, r.pages && `${r.pages} páginas`].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <form onSubmit={addManual} className="space-y-3">
          <Field label="Título">
            <Input
              autoFocus
              value={title}
              maxLength={500}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Autor">
            <Input value={author} maxLength={300} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Páginas">
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder="Opcional"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" disabled={!title.trim()}>
            Añadir
          </Button>
        </form>
      )}
    </Dialog>
  );
}
