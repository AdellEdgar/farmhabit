import { ChevronRight } from 'lucide-react';
import { bookPercent, booksOnShelf } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Card, ProgressBar } from '../../components/ui';
import { progressText } from './book-meta';
import { BookCover } from './BookCover';
import { PageInput } from './PageInput';

/** "Leyendo ahora" en Hoy, para apuntar la página. Sin libros en lectura no se pinta. */
export function ReadingNow({ onOpen }: { onOpen: () => void }) {
  const { data } = useApp();
  const books = booksOnShelf(data.books, 'reading');
  if (books.length === 0) return null;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between gap-2 font-semibold"
      >
        Leyendo ahora
        <ChevronRight size={18} className="text-texto-suave" />
      </button>
      <ul className="mt-3 space-y-3">
        {books.map((b) => {
          const percent = bookPercent(b);
          return (
            <li key={b.id} className="flex items-center gap-3">
              <BookCover title={b.title} coverUrl={b.coverUrl} className="w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.title}</p>
                {percent !== null && <ProgressBar value={percent} className="mt-1" />}
                <p className="mt-0.5 truncate text-[11px] text-texto-suave tabular-nums">
                  {progressText(b.currentPage, b.pages)}
                </p>
              </div>
              <PageInput key={b.currentPage} book={b} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
