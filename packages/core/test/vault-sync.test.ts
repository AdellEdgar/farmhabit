import { describe, expect, it } from 'vitest';
import { InvalidFileError, PasswordTooShortError } from '../src/sync/format';
import {
  deviceFileName,
  exportDatabase,
  importIntoDatabase,
  syncWithRemote,
} from '../src/sync/service';
import {
  createVault,
  NoVaultError,
  parseVaultKey,
  serializeVaultKey,
  unlockVault,
  VAULT_FILE,
  VaultExistsError,
  WrongPassphraseError,
} from '../src/sync/vault';
import { makeTask, noon, openTestDb, TEST_KDF } from './helpers/fixtures';
import { MemoryStore } from './helpers/memory-store';

const PHRASE = 'la granja de copito 2026';
const TODAY = '2026-10-24';

type TestDb = Awaited<ReturnType<typeof openTestDb>>['db'];
const newTask = (db: TestDb, title: string) =>
  db.repo('tasks').create({ ...makeTask({ title }), id: undefined });
const titles = async (db: TestDb) => (await db.repo('tasks').list()).map((t) => t.title).sort();

describe('baúl de sincronización', () => {
  it('se crea una vez y los demás dispositivos se unen con la frase', async () => {
    const store = new MemoryStore();
    const created = await createVault(store, PHRASE, { now: noon(TODAY), kdf: TEST_KDF });
    await expect(
      createVault(store, PHRASE, { now: noon(TODAY), kdf: TEST_KDF }),
    ).rejects.toBeInstanceOf(VaultExistsError);
    const joined = await unlockVault(store, PHRASE);
    expect(joined.vaultId).toBe(created.vaultId);
    expect(joined.key).toEqual(created.key);
  });

  it('una frase incorrecta da WrongPassphraseError', async () => {
    const store = new MemoryStore();
    await createVault(store, PHRASE, { now: noon(TODAY), kdf: TEST_KDF });
    await expect(unlockVault(store, 'otra frase cualquiera')).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it('sin baúl no hay a qué unirse; frases cortas no se aceptan', async () => {
    await expect(unlockVault(new MemoryStore(), PHRASE)).rejects.toBeInstanceOf(NoVaultError);
    await expect(
      createVault(new MemoryStore(), 'corta', { now: 0, kdf: TEST_KDF }),
    ).rejects.toBeInstanceOf(PasswordTooShortError);
  });

  it('el archivo del baúl no contiene la frase ni la clave', async () => {
    const store = new MemoryStore();
    const v = await createVault(store, PHRASE, { now: noon(TODAY), kdf: TEST_KDF });
    const text = new TextDecoder().decode(store.files.get(VAULT_FILE)!.data);
    expect(text).not.toContain(PHRASE);
    expect(text).not.toContain(Buffer.from(v.key).toString('base64'));
  });

  it('la clave se puede guardar como texto y recuperar', async () => {
    const v = await createVault(new MemoryStore(), PHRASE, { now: 0, kdf: TEST_KDF });
    expect(await parseVaultKey(await serializeVaultKey(v))).toEqual(v);
  });
});

describe('sincronización entre dispositivos', () => {
  async function setup() {
    const store = new MemoryStore();
    const pc = await openTestDb(noon(TODAY));
    const mobile = await openTestDb(noon(TODAY));
    const key = await createVault(store, PHRASE, { now: noon(TODAY), kdf: TEST_KDF });
    return { store, pc, mobile, key };
  }

  it('lleva los cambios de un dispositivo a otro en las dos direcciones', async () => {
    const { store, pc, mobile, key } = await setup();
    await newTask(pc.db, 'Del PC');
    expect((await syncWithRemote(pc.db, store, key)).uploaded).toBe(true);

    const r = await syncWithRemote(mobile.db, store, key);
    expect(r.pulledFrom).toEqual([pc.db.deviceId]);
    expect(await titles(mobile.db)).toEqual(['Del PC']);

    mobile.clock.advance(60_000);
    await newTask(mobile.db, 'Del móvil');
    await syncWithRemote(mobile.db, store, key);
    await syncWithRemote(pc.db, store, key);
    expect(await titles(pc.db)).toEqual(['Del PC', 'Del móvil']);
    expect(await pc.db.exportDataset()).toEqual(await mobile.db.exportDataset());
  });

  it('cada dispositivo escribe solo su propio archivo', async () => {
    const { store, pc, mobile, key } = await setup();
    await newTask(pc.db, 'a');
    await newTask(mobile.db, 'b');
    await syncWithRemote(pc.db, store, key);
    await syncWithRemote(mobile.db, store, key);
    expect([...store.files.keys()].sort()).toEqual(
      [VAULT_FILE, deviceFileName(pc.db.deviceId), deviceFileName(mobile.db.deviceId)].sort(),
    );
  });

  it('no vuelve a descargar archivos que no han cambiado ni sube si no hay cambios', async () => {
    const { store, pc, mobile, key } = await setup();
    await newTask(pc.db, 'a');
    await syncWithRemote(pc.db, store, key);
    await syncWithRemote(mobile.db, store, key);
    await syncWithRemote(mobile.db, store, key);

    store.reads = [];
    store.writes = [];
    const again = await syncWithRemote(mobile.db, store, key);
    expect(again.uploaded).toBe(false);
    expect(again.pulledFrom).toEqual([]);
    expect(store.reads).toEqual([]);
    expect(store.writes).toEqual([]);
  });

  it('el remoto solo ve datos cifrados', async () => {
    const { store, pc, key } = await setup();
    await newTask(pc.db, 'Cita médica privada');
    await syncWithRemote(pc.db, store, key);
    for (const f of store.files.values()) {
      expect(Buffer.from(f.data).toString('latin1')).not.toContain('Cita médica');
    }
  });

  it('ignora archivos de otro baúl en vez de fallar', async () => {
    const { store, pc, key } = await setup();
    const stranger = await openTestDb(noon(TODAY));
    const otherKey = await createVault(new MemoryStore(), 'otra frase distinta', {
      now: 0,
      kdf: TEST_KDF,
    });
    await newTask(stranger.db, 'Ajena');
    await store.write(
      deviceFileName(stranger.db.deviceId),
      await exportDatabase(stranger.db, otherKey),
    );

    const r = await syncWithRemote(pc.db, store, key);
    expect(r.skipped).toEqual([deviceFileName(stranger.db.deviceId)]);
    expect(await titles(pc.db)).toEqual([]);
  });

  it('una copia de seguridad con contraseña no se puede abrir con la clave del baúl y viceversa', async () => {
    const { pc, key } = await setup();
    const backup = await exportDatabase(pc.db, 'contraseña de la copia', { kdf: TEST_KDF });
    await expect(importIntoDatabase(pc.db, backup, key)).rejects.toBeInstanceOf(InvalidFileError);
    const synced = await exportDatabase(pc.db, key);
    await expect(
      importIntoDatabase(pc.db, synced, 'contraseña de la copia'),
    ).rejects.toBeInstanceOf(InvalidFileError);
  });
});
