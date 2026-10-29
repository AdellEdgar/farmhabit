import {
  decryptNoteContent,
  encryptNoteContent,
  parsePrivateVault,
  PRIVATE_VAULT_SETTING,
  type PrivateContent,
  type PrivateVaultInfo,
} from '../crypto/private-notes';
import type { Database } from '../db/database';
import { NotFoundError } from '../db/database';
import type { Note } from '../model/types';
import { deterministicId } from '../util/ids';

// Ajustes sincronizados (clave → valor) y notas privadas sobre la base de datos.

export function settingId(key: string): string {
  return deterministicId('setting', key);
}

export async function getSetting(db: Database, key: string): Promise<string | null> {
  return (await db.repo('settings').get(settingId(key)))?.value ?? null;
}

export async function putSetting(db: Database, key: string, value: string): Promise<void> {
  await db.repo('settings').put(settingId(key), { key, value });
}

export async function getPrivateVault(db: Database): Promise<PrivateVaultInfo | null> {
  const raw = await getSetting(db, PRIVATE_VAULT_SETTING);
  return raw ? parsePrivateVault(raw) : null;
}

export async function savePrivateVault(db: Database, info: PrivateVaultInfo): Promise<void> {
  await putSetting(db, PRIVATE_VAULT_SETTING, JSON.stringify(info));
}

async function getNote(db: Database, id: string): Promise<Note> {
  const note = await db.repo('notes').get(id);
  if (!note) throw new NotFoundError('notes', id);
  return note;
}

/** Cifra una nota y borra su texto en claro de la base de datos. */
export async function makeNotePrivate(db: Database, dek: Uint8Array, id: string): Promise<Note> {
  const note = await getNote(db, id);
  if (note.isPrivate) return note;
  const blob = await encryptNoteContent(dek, id, {
    title: note.title,
    content: note.content,
    plainText: note.plainText,
  });
  return db
    .repo('notes')
    .update(id, { isPrivate: true, privateBlob: blob, title: '', content: '', plainText: '' });
}

/** Descifra una nota privada y la vuelve normal. */
export async function makeNotePublic(db: Database, dek: Uint8Array, id: string): Promise<Note> {
  const note = await getNote(db, id);
  if (!note.isPrivate || !note.privateBlob) return note;
  const content = await decryptNoteContent(dek, id, note.privateBlob);
  return db.repo('notes').update(id, { isPrivate: false, privateBlob: null, ...content });
}

export async function readPrivateNote(dek: Uint8Array, note: Note): Promise<PrivateContent> {
  if (!note.isPrivate || !note.privateBlob) {
    return { title: note.title, content: note.content, plainText: note.plainText };
  }
  return decryptNoteContent(dek, note.id, note.privateBlob);
}

/** Guarda cambios de una nota privada (siempre cifrados). */
export async function savePrivateNote(
  db: Database,
  dek: Uint8Array,
  id: string,
  content: PrivateContent,
): Promise<Note> {
  return db.repo('notes').update(id, {
    privateBlob: await encryptNoteContent(dek, id, content),
    title: '',
    content: '',
    plainText: '',
  });
}
