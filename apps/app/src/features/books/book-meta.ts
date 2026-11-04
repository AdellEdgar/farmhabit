import type { BookStatus } from '@farmhabit/core';

export const SHELVES: { value: BookStatus; label: string }[] = [
  { value: 'reading', label: 'Leyendo' },
  { value: 'want', label: 'Por leer' },
  { value: 'read', label: 'Leídos' },
  { value: 'abandoned', label: 'Abandonados' },
];

/** Texto de la página a la que se va: "120 / 300" o "120". */
export function progressText(currentPage: number, pages: number | null): string {
  return pages === null ? `Página ${currentPage}` : `${currentPage} / ${pages} páginas`;
}
