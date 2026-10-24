import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extensions';
import {
  ArrowLeft,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pin,
  PinOff,
  Quote,
  Strikethrough,
  Trash2,
} from 'lucide-react';
import type { EntityPatch, Note } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatDateTime } from '../../lib/format';
import { cx } from '../../lib/cx';
import { Chip, IconButton, Select } from '../../components/ui';

const SAVE_DELAY_MS = 600;

export function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { data, mutate } = useApp();
  const [title, setTitle] = useState(note.title);
  const pending = useRef<EntityPatch<'notes'>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length > 0) void mutate((db) => db.repo('notes').update(note.id, patch));
  }, [mutate, note.id]);

  const schedule = useCallback(
    (patch: EntityPatch<'notes'>) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Guardar lo pendiente al salir del editor.
  useEffect(() => () => flush(), [flush]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: 'Escribe aquí… Usa # para títulos, - para listas y [] para casillas.',
      }),
    ],
    content: parseContent(note.content),
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor: e }) =>
      schedule({
        content: JSON.stringify(e.getJSON()),
        plainText: e.getText({ blockSeparator: '\n' }),
      }),
  });

  const update = (patch: EntityPatch<'notes'>) =>
    mutate((db) => db.repo('notes').update(note.id, patch));

  const remove = async () => {
    pending.current = {};
    await mutate((db) => db.repo('notes').remove(note.id));
    onBack();
  };

  const toggleTag = (id: string) =>
    update({
      tagIds: note.tagIds.includes(id) ? note.tagIds.filter((t) => t !== id) : [...note.tagIds, id],
    });

  return (
    <div className="note-editor">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <IconButton
          label="Volver a la lista"
          onClick={() => {
            flush();
            onBack();
          }}
        >
          <ArrowLeft size={18} />
        </IconButton>
        <span className="mr-auto text-xs text-texto-suave">
          Editada {formatDateTime(note.updatedAt)}
        </span>
        <Select
          value={note.folderId ?? ''}
          onChange={(e) => update({ folderId: e.target.value || null })}
          className="w-auto py-1.5"
          aria-label="Carpeta"
        >
          <option value="">Sin carpeta</option>
          {data.noteFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
        <IconButton
          label={note.pinned ? 'Desfijar' : 'Fijar arriba'}
          onClick={() => update({ pinned: !note.pinned })}
          className={cx(note.pinned && 'text-acento')}
        >
          {note.pinned ? <PinOff size={17} /> : <Pin size={17} />}
        </IconButton>
        <IconButton label="Borrar nota" onClick={remove} className="hover:text-peligro">
          <Trash2 size={17} />
        </IconButton>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          schedule({ title: e.target.value });
        }}
        placeholder="Título"
        aria-label="Título de la nota"
        className="mb-2 w-full bg-transparent text-2xl font-bold outline-none placeholder:text-texto-suave/60"
      />

      {data.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {data.tags.map((t) => (
            <Chip key={t.id} active={note.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)}>
              <span className="size-2 rounded-full" style={{ background: t.color }} />
              {t.name}
            </Chip>
          ))}
        </div>
      )}

      {editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="mt-3 text-[15px]" />
    </div>
  );
}

function parseContent(content: string): object | string {
  if (!content) return '';
  try {
    return JSON.parse(content) as object;
  } catch {
    return content;
  }
}

function Toolbar({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  const buttons = [
    {
      label: 'Título 1',
      icon: Heading1,
      active: editor.isActive('heading', { level: 1 }),
      run: () => chain().toggleHeading({ level: 1 }).run(),
    },
    {
      label: 'Título 2',
      icon: Heading2,
      active: editor.isActive('heading', { level: 2 }),
      run: () => chain().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'Título 3',
      icon: Heading3,
      active: editor.isActive('heading', { level: 3 }),
      run: () => chain().toggleHeading({ level: 3 }).run(),
    },
    {
      label: 'Negrita',
      icon: Bold,
      active: editor.isActive('bold'),
      run: () => chain().toggleBold().run(),
    },
    {
      label: 'Cursiva',
      icon: Italic,
      active: editor.isActive('italic'),
      run: () => chain().toggleItalic().run(),
    },
    {
      label: 'Tachado',
      icon: Strikethrough,
      active: editor.isActive('strike'),
      run: () => chain().toggleStrike().run(),
    },
    {
      label: 'Lista',
      icon: List,
      active: editor.isActive('bulletList'),
      run: () => chain().toggleBulletList().run(),
    },
    {
      label: 'Lista numerada',
      icon: ListOrdered,
      active: editor.isActive('orderedList'),
      run: () => chain().toggleOrderedList().run(),
    },
    {
      label: 'Casillas',
      icon: ListChecks,
      active: editor.isActive('taskList'),
      run: () => chain().toggleTaskList().run(),
    },
    {
      label: 'Cita',
      icon: Quote,
      active: editor.isActive('blockquote'),
      run: () => chain().toggleBlockquote().run(),
    },
    {
      label: 'Código',
      icon: Code,
      active: editor.isActive('codeBlock'),
      run: () => chain().toggleCodeBlock().run(),
    },
    {
      label: 'Separador',
      icon: Minus,
      active: false,
      run: () => chain().setHorizontalRule().run(),
    },
  ];
  return (
    <div
      className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-0.5 rounded-xl border border-borde bg-superficie/95 p-1 backdrop-blur"
      role="toolbar"
      aria-label="Formato"
    >
      {buttons.map((b) => (
        <IconButton
          key={b.label}
          label={b.label}
          onClick={b.run}
          aria-pressed={b.active}
          className={cx('size-8', b.active && 'bg-acento-suave text-acento')}
        >
          <b.icon size={16} />
        </IconButton>
      ))}
    </div>
  );
}
