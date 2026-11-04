import { useState } from 'react';
import { Plus } from 'lucide-react';
import { bookPercent, booksOnShelf, type Book, type BookStatus } from '@farmhabit/core';
import { formatRelativeDate } from '../../lib/format';
import { useShortcut } from '../../lib/shortcuts';
import { useApp } from '../../lib/use-app';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  ProgressBar,
  Segmented,
} from '../../components/ui';
import { AddBookDialog } from './AddBookDialog';
import { progressText, SHELVES } from './book-meta';
import { BookCover } from './BookCover';
import { BookSheet } from './BookSheet';
import { GoalCard } from './GoalCard';
import { PageInput } from './PageInput';
import { StatsTab } from './StatsTab';

type Tab = BookStatus | 'stats';
const TABS: { value: Tab; label: string }[] = [
  ...SHELVES,
  { value: 'stats', label: 'Estadísticas' },
];
const EMPTY: Record<BookStatus, string> = {
  reading: 'No estás leyendo nada ahora mismo',
  want: 'Tu lista de pendientes está vacía',
  read: 'Aún no has terminado ningún libro',
  abandoned: 'Ningún libro abandonado',
};

/** Sin acentos ni mayúsculas, como el buscador de notas. */
const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function BookRow({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const { today } = useApp();
  const percent = bookPercent(book);
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <BookCover title={book.title} coverUrl={book.coverUrl} className="w-14" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block font-medium">{book.title}</span>
          {book.author && (
            <span className="block truncate text-xs text-texto-suave">{book.author}</span>
          )}
          {book.status === 'reading' && (
            <span className="mt-1.5 block">
              {percent !== null && <ProgressBar value={percent} />}
              <span className="mt-1 block text-[11px] text-texto-suave tabular-nums">
                {progressText(book.currentPage, book.pages)}
                {percent !== null && ` · ${percent} %`}
              </span>
            </span>
          )}
          {book.status === 'read' && (
            <span className="mt-1 block text-xs text-texto-suave">
              {book.rating !== null && (
                <span className="text-grano">★ {String(book.rating).replace('.', ',')} · </span>
              )}
              {book.finishedOn ? formatRelativeDate(book.finishedOn, today) : 'Sin fecha'}
            </span>
          )}
        </span>
      </button>
      {book.status === 'reading' && <PageInput key={book.currentPage} book={book} />}
    </li>
  );
}

export function BooksView() {
  const { data } = useApp();
  const [tab, setTab] = useState<Tab>('reading');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  useShortcut('n', () => setAdding(true));

  const q = plain(query.trim());
  const shelf = tab === 'stats' ? null : booksOnShelf(data.books, tab);
  const list = shelf?.filter((b) => !q || plain(`${b.title} ${b.author}`).includes(q));

  return (
    <>
      <PageHeader
        title="Libros"
        subtitle={`${data.books.length} en tu lista`}
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Añadir libro
          </Button>
        }
      />
      <div className="space-y-4">
        <GoalCard />
        <Segmented
          value={tab}
          options={TABS}
          onChange={setTab}
          className="max-w-full overflow-x-auto [scrollbar-width:none]"
        />

        {tab === 'stats' ? (
          <StatsTab />
        ) : (
          <>
            {shelf!.length > 0 && (
              <Input
                placeholder="Buscar en esta estantería"
                aria-label="Buscar en esta estantería"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            {shelf!.length === 0 ? (
              <Card>
                <EmptyState icon="📚" title={EMPTY[tab]}>
                  <div className="mt-3">
                    <Button variant="primary" onClick={() => setAdding(true)}>
                      Añadir un libro
                    </Button>
                  </div>
                </EmptyState>
              </Card>
            ) : list!.length === 0 ? (
              <EmptyState icon="🔍" title="Ningún libro coincide" />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {list!.map((b) => (
                  <BookRow key={b.id} book={b} onOpen={() => setOpen(b.id)} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {adding && (
        <AddBookDialog shelf={tab === 'stats' ? 'want' : tab} onClose={() => setAdding(false)} />
      )}
      {open && <BookSheet key={open} bookId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
