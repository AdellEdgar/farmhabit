import { useState } from 'react';
import { Quote, Trash2 } from 'lucide-react';
import {
  addBookQuote,
  bookPercent,
  deleteBook,
  deleteBookQuote,
  setBookStatus,
  updateBook,
  type BookStatus,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import {
  Button,
  Chip,
  Dialog,
  Field,
  IconButton,
  Input,
  ProgressBar,
  Select,
  Textarea,
} from '../../components/ui';
import { progressText, SHELVES } from './book-meta';
import { BookCover } from './BookCover';
import { PageInput } from './PageInput';
import { RatingStars } from './RatingStars';

/** Ficha de un libro. Cada campo se guarda al cambiarlo. */
export function BookSheet({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const { data, mutate, today } = useApp();
  const book = data.books.find((b) => b.id === bookId);
  const [title, setTitle] = useState(book?.title ?? '');
  const [author, setAuthor] = useState(book?.author ?? '');
  const [pages, setPages] = useState(book?.pages ? String(book.pages) : '');
  const [review, setReview] = useState(book?.review ?? '');
  const [quote, setQuote] = useState('');
  const [quotePage, setQuotePage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!book) return null;

  const update = (patch: Parameters<typeof updateBook>[2]) =>
    mutate((db) => updateBook(db, book.id, patch));
  const quotes = data.bookQuotes.filter((q) => q.bookId === book.id);
  const percent = bookPercent(book);

  const parsedPages = () => {
    const n = Number(pages);
    return pages.trim() !== '' && Number.isInteger(n) && n > 0 ? n : null;
  };
  const savePages = () => {
    const next = parsedPages();
    if (next !== book.pages) void update({ pages: next });
  };
  /** Cerrar con Esc no dispara onBlur: se guarda aquí lo que quede escrito. */
  const close = () => {
    const patch: Parameters<typeof updateBook>[2] = {};
    if (title.trim() && title.trim() !== book.title) patch.title = title.trim();
    if (author.trim() !== book.author) patch.author = author.trim();
    if (parsedPages() !== book.pages) patch.pages = parsedPages();
    if (review !== book.review) patch.review = review;
    if (Object.keys(patch).length > 0) void update(patch);
    onClose();
  };
  const saveQuote = async () => {
    const n = Number(quotePage);
    const page = quotePage.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : null;
    const ok = await mutate((db) => addBookQuote(db, book.id, quote, page));
    if (ok) {
      setQuote('');
      setQuotePage('');
    }
  };
  const remove = async () => {
    await mutate((db) => deleteBook(db, book.id));
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && close()}
      title={book.title}
      footer={
        <>
          {confirmDelete ? (
            <Button variant="danger" onClick={() => void remove()} className="mr-auto">
              Sí, borrar el libro
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="mr-auto">
              <Trash2 size={16} /> Borrar
            </Button>
          )}
          <Button variant="primary" onClick={close}>
            Hecho
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        <BookCover title={book.title} coverUrl={book.coverUrl} className="w-24" />
        <div className="min-w-0 flex-1 space-y-3">
          <Field label="Estantería">
            <Select
              value={book.status}
              onChange={(e) =>
                void mutate((db) => setBookStatus(db, book.id, e.target.value as BookStatus, today))
              }
            >
              {SHELVES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-texto-suave">
              {progressText(book.currentPage, book.pages)}
              {percent !== null && ` · ${percent} %`}
            </span>
            <PageInput key={book.currentPage} book={book} />
          </div>
          {percent !== null && <ProgressBar value={percent} />}
        </div>
      </div>

      <Field label="Título">
        <Input
          value={title}
          maxLength={500}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title !== book.title) void update({ title: title.trim() });
            else setTitle(book.title);
          }}
        />
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field label="Autor">
          <Input
            value={author}
            maxLength={300}
            onChange={(e) => setAuthor(e.target.value)}
            onBlur={() => author !== book.author && void update({ author: author.trim() })}
          />
        </Field>
        <Field label="Páginas">
          <Input
            type="number"
            min={1}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            onBlur={savePages}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Empezado">
          <Input
            type="date"
            value={book.startedOn ?? ''}
            onChange={(e) => void update({ startedOn: e.target.value || null })}
          />
        </Field>
        <Field label="Terminado">
          <Input
            type="date"
            value={book.finishedOn ?? ''}
            onChange={(e) => void update({ finishedOn: e.target.value || null })}
          />
        </Field>
      </div>

      <Field label="Nota">
        <RatingStars value={book.rating} onChange={(rating) => void update({ rating })} />
      </Field>

      <Field label="Reseña">
        <Textarea
          rows={3}
          placeholder="Qué te ha parecido"
          value={review}
          maxLength={20_000}
          onChange={(e) => setReview(e.target.value)}
          onBlur={() => review !== book.review && void update({ review })}
        />
      </Field>

      {data.tags.length > 0 && (
        <Field label="Etiquetas">
          <div className="flex flex-wrap gap-2">
            {data.tags.map((t) => {
              const active = book.tagIds.includes(t.id);
              return (
                <Chip
                  key={t.id}
                  active={active}
                  onClick={() =>
                    void update({
                      tagIds: active
                        ? book.tagIds.filter((x) => x !== t.id)
                        : [...book.tagIds, t.id],
                    })
                  }
                >
                  <span className="size-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </Chip>
              );
            })}
          </div>
        </Field>
      )}

      <Field label="Citas">
        {quotes.length > 0 && (
          <ul className="mb-2 space-y-2">
            {quotes.map((q) => (
              <li key={q.id} className="flex items-start gap-2 rounded-xl bg-fondo p-3 text-sm">
                <Quote size={14} className="mt-0.5 shrink-0 text-texto-suave" />
                <p className="min-w-0 flex-1 whitespace-pre-line">
                  {q.text}
                  {q.page !== null && (
                    <span className="ml-1 text-xs text-texto-suave">(pág. {q.page})</span>
                  )}
                </p>
                <IconButton
                  label="Borrar cita"
                  onClick={() => void mutate((db) => deleteBookQuote(db, q.id))}
                >
                  <Trash2 size={15} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        <Textarea
          rows={2}
          placeholder="Copia aquí una frase"
          value={quote}
          maxLength={5_000}
          onChange={(e) => setQuote(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Página"
            aria-label="Página de la cita"
            value={quotePage}
            onChange={(e) => setQuotePage(e.target.value)}
            className="w-28"
          />
          <Button onClick={() => void saveQuote()} disabled={!quote.trim()}>
            Añadir cita
          </Button>
        </div>
      </Field>
    </Dialog>
  );
}
