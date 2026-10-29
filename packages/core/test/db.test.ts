import { describe, expect, it } from 'vitest';
import { Database, NotFoundError } from '../src/db/database';
import { getSchemaVersion, LATEST_SCHEMA_VERSION, migrate } from '../src/db/migrations';
import type { Migration } from '../src/db/migrations';
import { NodeSqliteDriver } from './helpers/node-sqlite-driver';
import { noon, openTestDb } from './helpers/fixtures';

describe('migraciones', () => {
  it('crean el esquema desde cero y guardan la versión', async () => {
    const driver = new NodeSqliteDriver();
    expect(await migrate(driver)).toBe(LATEST_SCHEMA_VERSION);
    expect(await getSchemaVersion(driver)).toBe(LATEST_SCHEMA_VERSION);
    const tables = await driver.select<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['tasks', 'habits', 'habit_logs', 'notes', 'animals', 'meta']),
    );
  });

  it('son idempotentes', async () => {
    const driver = new NodeSqliteDriver();
    await migrate(driver);
    await expect(migrate(driver)).resolves.toBe(LATEST_SCHEMA_VERSION);
  });

  it('una migración que falla no deja nada a medias', async () => {
    const driver = new NodeSqliteDriver();
    const broken: Migration[] = [
      { version: 1, name: 'ok', statements: ['CREATE TABLE a (x INTEGER)'] },
      {
        version: 2,
        name: 'rota',
        statements: ['CREATE TABLE b (x INTEGER)', 'ESTO NO ES SQL'],
      },
    ];
    await expect(migrate(driver, broken)).rejects.toThrow();
    expect(await getSchemaVersion(driver)).toBe(1);
    const b = await driver.select(`SELECT name FROM sqlite_master WHERE name = 'b'`);
    expect(b).toHaveLength(0);
  });

  it('rechaza una base de datos de una versión más nueva', async () => {
    const driver = new NodeSqliteDriver();
    await migrate(driver);
    await driver.execute(`UPDATE meta SET value = '999' WHERE key = 'schemaVersion'`);
    await expect(migrate(driver)).rejects.toThrow(/más nueva/);
  });
});

describe('base de datos', () => {
  it('genera un deviceId estable', async () => {
    const driver = new NodeSqliteDriver();
    const a = await Database.open(driver);
    const b = await Database.open(driver);
    expect(a.deviceId).toBe(b.deviceId);
  });

  it('al crear asigna id y marcas de tiempo; al editar sube updatedAt', async () => {
    const { db, clock } = await openTestDb();
    const tags = db.repo('tags');
    const tag = await tags.create({ name: 'Universidad', color: '#7cc46b' });
    expect(tag.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(tag.createdAt).toBe(tag.updatedAt);

    clock.advance(1000);
    const edited = await tags.update(tag.id, { name: 'Uni' });
    expect(edited.updatedAt).toBeGreaterThan(tag.updatedAt);
    expect(edited.createdAt).toBe(tag.createdAt);
    expect(await tags.get(tag.id)).toEqual(edited);
  });

  it('convierte JSON y booleanos de ida y vuelta', async () => {
    const { db } = await openTestDb();
    const note = await db.repo('notes').create({
      folderId: null,
      title: 'Lista 🛒 con ñ',
      content: '{"type":"doc"}',
      plainText: 'leche',
      tagIds: [],
      pinned: true,
      isPrivate: false,
      privateBlob: null,
    });
    expect(await db.repo('notes').get(note.id)).toEqual(note);
  });

  it('borrar deja un tombstone sin contenido y lo oculta de las consultas', async () => {
    const { db } = await openTestDb();
    const tasks = db.repo('tasks');
    const t = await tasks.create({
      title: 'Secreto',
      notes: 'detalles',
      priority: 1,
      status: 'done',
      dueDate: null,
      dueTime: null,
      rrule: null,
      reminders: [{ offsetMin: 60 }],
      tagIds: [],
      completedAt: 5,
    });
    await tasks.remove(t.id);
    expect(await tasks.get(t.id)).toBeNull();
    expect(await tasks.list()).toHaveLength(0);
    const tomb = await tasks.get(t.id, { includeDeleted: true });
    expect(tomb?.deletedAt).not.toBeNull();
    expect(tomb?.title).toBe('');
    expect(tomb?.notes).toBe('');
  });

  it('rechaza datos que no cumplen el esquema', async () => {
    const { db } = await openTestDb();
    await expect(db.repo('tags').create({ name: '', color: '' })).rejects.toThrow();
  });

  it('editar algo que no existe da NotFoundError', async () => {
    const { db } = await openTestDb();
    await expect(db.repo('tags').update('nope', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('las marcas son crecientes aunque el reloj retroceda y se recuerdan al reabrir', async () => {
    const { db, clock, driver } = await openTestDb();
    const a = await db.repo('tags').create({ name: 'a', color: '' });
    clock.set(noon('2020-01-01'));
    const b = await db.repo('tags').create({ name: 'b', color: '' });
    expect(b.updatedAt).toBeGreaterThan(a.updatedAt);

    const reopened = await Database.open(driver, clock);
    const c = await reopened.repo('tags').create({ name: 'c', color: '' });
    expect(c.updatedAt).toBeGreaterThan(b.updatedAt);
  });

  it('la huella de una colección solo cambia si cambia la colección', async () => {
    const { db, clock } = await openTestDb();
    const before = await db.collectionSignatures();
    const tag = await db.repo('tags').create({ name: 'a', color: '' });
    const afterCreate = await db.collectionSignatures();
    expect(afterCreate.tags).not.toBe(before.tags);
    expect(afterCreate.notes).toBe(before.notes);

    clock.advance(1000);
    await db.repo('tags').update(tag.id, { name: 'b' });
    const afterUpdate = await db.collectionSignatures();
    expect(afterUpdate.tags).not.toBe(afterCreate.tags);
    await db.repo('tags').remove(tag.id);
    expect((await db.collectionSignatures()).tags).not.toBe(afterUpdate.tags);
  });

  it('una transacción que falla no escribe nada', async () => {
    const { driver } = await openTestDb();
    await expect(
      driver.transaction([
        { sql: `INSERT INTO meta (key, value) VALUES ('x', '1')` },
        { sql: `INSERT INTO tabla_que_no_existe VALUES (1)` },
      ]),
    ).rejects.toThrow();
    expect(await driver.select(`SELECT * FROM meta WHERE key = 'x'`)).toHaveLength(0);
  });
});
