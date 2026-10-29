import { describe, expect, it } from 'vitest';
import {
  changePrivatePassword,
  createPrivateVault,
  decryptNoteContent,
  encryptNoteContent,
  unlockPrivateVault,
} from '../src/crypto/private-notes';
import { PasswordTooShortError } from '../src/sync/format';
import { exportDatabase } from '../src/sync/service';
import { WrongPassphraseError } from '../src/sync/vault';
import {
  getPrivateVault,
  makeNotePrivate,
  makeNotePublic,
  readPrivateNote,
  savePrivateNote,
  savePrivateVault,
} from '../src/services/private-notes';
import { makeNote, noon, openTestDb, TEST_KDF } from './helpers/fixtures';

const PW = 'mi diario secreto';
const CONTENT = { title: 'Diario', content: '{"type":"doc"}', plainText: 'Hoy le confesé a…' };

describe('caja de notas privadas', () => {
  it('se abre con su contraseña y no con otra', async () => {
    const { info, dek } = await createPrivateVault(PW, TEST_KDF);
    expect(await unlockPrivateVault(info, PW)).toEqual(dek);
    await expect(unlockPrivateVault(info, 'otra contraseña')).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it('cambiar la contraseña mantiene la misma clave de las notas', async () => {
    const { info, dek } = await createPrivateVault(PW, TEST_KDF);
    const changed = await changePrivatePassword(info, PW, 'contraseña nueva', TEST_KDF);
    expect(await unlockPrivateVault(changed, 'contraseña nueva')).toEqual(dek);
    await expect(unlockPrivateVault(changed, PW)).rejects.toBeInstanceOf(WrongPassphraseError);
    await expect(
      changePrivatePassword(info, 'mala contraseña', 'otra nueva 123', TEST_KDF),
    ).rejects.toBeInstanceOf(WrongPassphraseError);
  });

  it('rechaza contraseñas cortas', async () => {
    await expect(createPrivateVault('corta', TEST_KDF)).rejects.toBeInstanceOf(
      PasswordTooShortError,
    );
  });

  it('el contenido cifrado solo vale para su nota', async () => {
    const { dek } = await createPrivateVault(PW, TEST_KDF);
    const blob = await encryptNoteContent(dek, 'nota-1', CONTENT);
    expect(await decryptNoteContent(dek, 'nota-1', blob)).toEqual(CONTENT);
    await expect(decryptNoteContent(dek, 'nota-2', blob)).rejects.toThrow();
    expect(Buffer.from(blob, 'base64').toString('latin1')).not.toContain('confesé');
  });
});

describe('notas privadas en la base de datos', () => {
  it('hacer privada borra el texto en claro y se puede volver atrás', async () => {
    const { db } = await openTestDb(noon('2026-10-24'));
    const { info, dek } = await createPrivateVault(PW, TEST_KDF);
    await savePrivateVault(db, info);
    expect(await getPrivateVault(db)).toEqual(info);

    const note = await db.repo('notes').create({ ...makeNote(CONTENT), id: undefined });
    const priv = await makeNotePrivate(db, dek, note.id);
    expect(priv).toMatchObject({ isPrivate: true, title: '', content: '', plainText: '' });
    expect(await readPrivateNote(dek, priv)).toEqual(CONTENT);

    const edited = await savePrivateNote(db, dek, note.id, { ...CONTENT, plainText: 'Editado' });
    expect((await readPrivateNote(dek, edited)).plainText).toBe('Editado');

    const pub = await makeNotePublic(db, dek, note.id);
    expect(pub).toMatchObject({
      isPrivate: false,
      privateBlob: null,
      title: 'Diario',
      plainText: 'Editado',
    });
  });

  it('en la copia exportada las notas privadas siguen cifradas por dentro', async () => {
    const { db } = await openTestDb(noon('2026-10-24'));
    const { info, dek } = await createPrivateVault(PW, TEST_KDF);
    await savePrivateVault(db, info);
    const note = await db.repo('notes').create({ ...makeNote(CONTENT), id: undefined });
    await makeNotePrivate(db, dek, note.id);
    const dataset = await db.exportDataset();
    expect(JSON.stringify(dataset)).not.toContain('confesé');
    expect(await exportDatabase(db, 'contraseña de la copia', { kdf: TEST_KDF })).toBeInstanceOf(
      Uint8Array,
    );
  });
});
