import { useMemo, useRef, useState } from 'react';
import { FolderPlus, Pencil, Pin, Plus, Search } from 'lucide-react';
import { compareSortKey, keyBetween, type Note, type NoteFolder } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatRelativeDate } from '../../lib/format';
import { useShortcut } from '../../lib/shortcuts';
import { Button, Card, Chip, Dialog, EmptyState, Input, PageHeader } from '../../components/ui';
import { NoteEditor } from './NoteEditor';

type FolderFilter = 'all' | 'none' | string;

/** Quita acentos y mayúsculas para buscar ("canción" encuentra "cancion"). */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function NotesView() {
  const { data, mutate, today } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<FolderFilter>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [folderDialog, setFolderDialog] = useState<NoteFolder | 'new' | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const createNote = async () => {
    const note = await mutate((db) =>
      db.repo('notes').create({
        folderId: folder !== 'all' && folder !== 'none' ? folder : null,
        title: '',
        content: '',
        plainText: '',
        tagIds: tag ? [tag] : [],
        pinned: false,
        isPrivate: false,
        privateBlob: null,
      }),
    );
    if (note) setOpenId(note.id);
  };

  useShortcut('/', () => searchRef.current?.focus(), openId === null);
  useShortcut('n', () => void createNote(), openId === null);

  const folders = useMemo(() => [...data.noteFolders].sort(compareSortKey), [data.noteFolders]);

  const notes = useMemo(() => {
    const q = normalize(query.trim());
    return data.notes
      .filter(
        (n) =>
          folder === 'all' || (folder === 'none' ? n.folderId === null : n.folderId === folder),
      )
      .filter((n) => !tag || n.tagIds.includes(tag))
      .filter((n) => !q || normalize(`${n.title}\n${n.plainText}`).includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [data.notes, folder, tag, query]);

  const open = data.notes.find((n) => n.id === openId);
  if (open) return <NoteEditor key={open.id} note={open} onBack={() => setOpenId(null)} />;

  return (
    <>
      <PageHeader
        title="Notas"
        actions={
          <Button variant="primary" onClick={createNote}>
            <Plus size={16} /> Nueva
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search
          size={17}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave"
        />
        <Input
          ref={searchRef}
          type="search"
          placeholder="Buscar en tus notas  ( / )"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
          aria-label="Buscar notas"
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip active={folder === 'all'} onClick={() => setFolder('all')}>
          Todas
        </Chip>
        <Chip active={folder === 'none'} onClick={() => setFolder('none')}>
          Sin carpeta
        </Chip>
        {folders.map((f) => (
          <Chip
            key={f.id}
            active={folder === f.id}
            onClick={() => (folder === f.id ? setFolderDialog(f) : setFolder(f.id))}
            title={folder === f.id ? 'Pulsa de nuevo para editar' : undefined}
          >
            📁 {f.name}
            {folder === f.id && <Pencil size={11} />}
          </Chip>
        ))}
        <Chip onClick={() => setFolderDialog('new')}>
          <FolderPlus size={13} /> Carpeta
        </Chip>
      </div>
      {data.tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {data.tags.map((t) => (
            <Chip
              key={t.id}
              active={tag === t.id}
              onClick={() => setTag(tag === t.id ? null : t.id)}
            >
              <span className="size-2 rounded-full" style={{ background: t.color }} />
              {t.name}
            </Chip>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <Card>
          <EmptyState icon="📝" title={query ? 'Ninguna nota coincide' : 'Aún no hay notas aquí'}>
            {!query && 'Pulsa N o «Nueva» para escribir una.'}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              folder={data.noteFolders.find((f) => f.id === n.folderId)}
              today={today}
              onOpen={() => setOpenId(n.id)}
            />
          ))}
        </div>
      )}

      {folderDialog !== null && (
        <FolderDialog
          key={folderDialog === 'new' ? 'new' : folderDialog.id}
          folder={folderDialog === 'new' ? null : folderDialog}
          lastKey={folders[folders.length - 1]?.sortKey ?? null}
          onClose={(deleted) => {
            if (deleted) setFolder('all');
            setFolderDialog(null);
          }}
        />
      )}
    </>
  );
}

function NoteCard({
  note,
  folder,
  today,
  onOpen,
}: {
  note: Note;
  folder?: NoteFolder;
  today: string;
  onOpen: () => void;
}) {
  const snippet = note.plainText.trim().slice(0, 160);
  const updated = new Date(note.updatedAt);
  const updatedDate = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, '0')}-${String(updated.getDate()).padStart(2, '0')}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-borde bg-superficie p-4 text-left transition hover:border-texto-suave/60"
    >
      <div className="flex items-start gap-2">
        <p className="flex-1 font-semibold break-words">
          {note.title || <span className="text-texto-suave italic">Sin título</span>}
        </p>
        {note.pinned && <Pin size={14} className="mt-1 shrink-0 text-acento" aria-label="Fijada" />}
      </div>
      {snippet && (
        <p className="mt-1 line-clamp-3 text-sm whitespace-pre-line text-texto-suave">{snippet}</p>
      )}
      <p className="mt-auto pt-3 text-xs text-texto-suave">
        {formatRelativeDate(updatedDate, today)}
        {folder && ` · 📁 ${folder.name}`}
      </p>
    </button>
  );
}

function FolderDialog({
  folder,
  lastKey,
  onClose,
}: {
  folder: NoteFolder | null;
  lastKey: string | null;
  onClose: (deleted?: boolean) => void;
}) {
  const { data, mutate } = useApp();
  const [name, setName] = useState(folder?.name ?? '');

  const save = async () => {
    if (!name.trim()) return;
    await mutate((db) =>
      folder
        ? db.repo('noteFolders').update(folder.id, { name: name.trim() })
        : db
            .repo('noteFolders')
            .create({ name: name.trim(), parentId: null, sortKey: keyBetween(lastKey, null) }),
    );
    onClose();
  };

  const remove = async () => {
    if (!folder) return;
    await mutate(async (db) => {
      for (const n of data.notes.filter((x) => x.folderId === folder.id)) {
        await db.repo('notes').update(n.id, { folderId: null });
      }
      await db.repo('noteFolders').remove(folder.id);
    });
    onClose(true);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={folder ? 'Editar carpeta' : 'Nueva carpeta'}
      footer={
        <>
          {folder && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              Borrar carpeta
            </Button>
          )}
          <Button variant="ghost" onClick={() => onClose()}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        placeholder="Nombre de la carpeta"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void save()}
        aria-label="Nombre de la carpeta"
      />
      {folder && (
        <p className="text-xs text-texto-suave">
          Si borras la carpeta, sus notas pasan a «Sin carpeta».
        </p>
      )}
    </Dialog>
  );
}
