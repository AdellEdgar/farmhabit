import { useState } from 'react';
import { setBookProgress, type Book } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';

/** Campo para apuntar la página: guarda al salir del campo o con Intro. */
export function PageInput({ book }: { book: Book }) {
  const { mutate, today } = useApp();
  const [draft, setDraft] = useState<string | null>(null);

  const save = (raw: string) => {
    setDraft(null);
    const n = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(n) || n === book.currentPage) return;
    void mutate((db) => setBookProgress(db, book.id, n, today));
  };

  return (
    <input
      inputMode="numeric"
      aria-label={`Página de ${book.title}`}
      value={draft ?? String(book.currentPage)}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => save(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-16 rounded-lg border border-borde bg-fondo px-2 py-1.5 text-right text-sm focus:border-acento focus:outline-none"
    />
  );
}
