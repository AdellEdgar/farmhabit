import { describe, expect, it } from 'vitest';
import { DecryptionError } from '../src/crypto/sodium';
import { createHabit, setHabitLog } from '../src/services/habits';
import { emptyDataset } from '../src/model/collections';
import type { Habit } from '../src/model/types';
import type { ExportPayload } from '../src/sync/format';
import { exportDatabase, importIntoDatabase, mergeIntoDatabase } from '../src/sync/service';
import { makeTask, noon, openTestDb, TEST_KDF } from './helpers/fixtures';

const PASSWORD = 'contraseña maestra larga';
const TODAY = '2026-10-24';

async function newTask(db: Awaited<ReturnType<typeof openTestDb>>['db'], title: string) {
  return db.repo('tasks').create({ ...makeTask({ title }), id: undefined });
}

describe('exportar e importar entre dos dispositivos', () => {
  it('lleva los datos de un PC a un móvil vacío', async () => {
    const pc = await openTestDb(noon(TODAY));
    const mobile = await openTestDb(noon(TODAY));
    await newTask(pc.db, 'Entregar práctica');
    const habit = await createHabit(pc.db, {
      name: 'Correr',
      startDate: '2026-10-01',
      config: { effort: 5, schedule: { type: 'daily' }, target: null },
    });
    await setHabitLog(pc.db, habit.id, TODAY, { status: 'done' }, TODAY);

    const file = await exportDatabase(pc.db, PASSWORD, { kdf: TEST_KDF });
    const report = await importIntoDatabase(mobile.db, file, PASSWORD);

    expect(report.collections.tasks.added).toBe(1);
    expect(report.collections.habitLogs.added).toBe(1);
    expect(await mobile.db.exportDataset()).toEqual(await pc.db.exportDataset());
  });

  it('fusiona cambios hechos en los dos lados y vuelve a exportar', async () => {
    const pc = await openTestDb(noon(TODAY));
    const mobile = await openTestDb(noon(TODAY));
    const shared = await newTask(pc.db, 'Compartida');
    await importIntoDatabase(
      mobile.db,
      await exportDatabase(pc.db, PASSWORD, { kdf: TEST_KDF }),
      PASSWORD,
    );

    // Cada uno hace cambios por su lado.
    pc.clock.advance(60_000);
    mobile.clock.advance(120_000);
    await newTask(pc.db, 'Solo en el PC');
    await mobile.db.repo('tasks').update(shared.id, { title: 'Editada en el móvil' });
    const mobileOnly = await newTask(mobile.db, 'Solo en el móvil');
    await mobile.db.repo('tasks').remove(mobileOnly.id);

    // Móvil → PC y PC → móvil.
    await importIntoDatabase(
      pc.db,
      await exportDatabase(mobile.db, PASSWORD, { kdf: TEST_KDF }),
      PASSWORD,
    );
    await importIntoDatabase(
      mobile.db,
      await exportDatabase(pc.db, PASSWORD, { kdf: TEST_KDF }),
      PASSWORD,
    );

    const titles = async (db: typeof pc.db) =>
      (await db.repo('tasks').list()).map((t) => t.title).sort();
    expect(await titles(pc.db)).toEqual(['Editada en el móvil', 'Solo en el PC']);
    expect(await pc.db.exportDataset()).toEqual(await mobile.db.exportDataset());
  });

  it('tras importar, las escrituras locales quedan por delante de lo importado', async () => {
    const pc = await openTestDb(noon(TODAY));
    // El móvil tiene el reloj una hora adelantado.
    const mobile = await openTestDb(noon(TODAY) + 3_600_000);
    const t = await newTask(mobile.db, 'Del móvil');
    await importIntoDatabase(
      pc.db,
      await exportDatabase(mobile.db, PASSWORD, { kdf: TEST_KDF }),
      PASSWORD,
    );
    const edited = await pc.db.repo('tasks').update(t.id, { title: 'Editada en el PC' });
    expect(edited.updatedAt).toBeGreaterThan(t.updatedAt);
  });

  it('con la contraseña incorrecta no toca la base de datos', async () => {
    const pc = await openTestDb(noon(TODAY));
    const mobile = await openTestDb(noon(TODAY));
    await newTask(pc.db, 'Privada');
    const file = await exportDatabase(pc.db, PASSWORD, { kdf: TEST_KDF });
    await expect(importIntoDatabase(mobile.db, file, 'no es la contraseña')).rejects.toBeInstanceOf(
      DecryptionError,
    );
    expect(await mobile.db.repo('tasks').list()).toEqual([]);
  });
});

describe('datos de una versión anterior (sin criaturas)', () => {
  /** Lo que sube un dispositivo con la versión 1: el hábito sin los campos de criatura. */
  async function setup() {
    const { db } = await openTestDb(noon('2026-10-24'));
    const h = await createHabit(db, {
      name: 'Leer',
      startDate: '2026-10-01',
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
      creatureSpecies: 'medusa',
      creatureName: 'Mery',
    });
    const withAura = await db.repo('habits').update(h.id, {
      creatureAura: 'dorada',
      creatureBackground: 'playa',
    });
    const old: Habit = {
      ...withAura,
      creatureSpecies: null,
      creatureName: '',
      creatureBackground: null,
      creatureAura: null,
    };
    const payload = (habit: Habit, schemaVersion: number): ExportPayload => ({
      formatVersion: 1,
      schemaVersion,
      exportedAt: noon('2026-10-24'),
      sourceDeviceId: 'otro-dispositivo',
      collections: { ...emptyDataset(), habits: [habit] },
      privateVault: null,
    });
    return { db, habit: withAura, old, payload };
  }

  it('el eco de una versión antigua (misma fecha) no borra la criatura', async () => {
    const { db, habit, old, payload } = await setup();
    await mergeIntoDatabase(db, payload(old, 3));
    expect(await db.repo('habits').get(habit.id)).toMatchObject({
      creatureSpecies: 'medusa',
      creatureName: 'Mery',
      creatureAura: 'dorada',
      creatureBackground: 'playa',
    });
  });

  it('una edición desde una versión antigua conserva la criatura', async () => {
    const { db, habit, old, payload } = await setup();
    const edited = { ...old, name: 'Leer 30 min', updatedAt: habit.updatedAt + 1000 };
    await mergeIntoDatabase(db, payload(edited, 3));
    expect(await db.repo('habits').get(habit.id)).toMatchObject({
      name: 'Leer 30 min',
      creatureSpecies: 'medusa',
      creatureAura: 'dorada',
    });
  });

  it('desde la versión actual, quitar el aura sí se respeta', async () => {
    const { db, habit, payload } = await setup();
    const edited = { ...habit, creatureAura: null, updatedAt: habit.updatedAt + 1000 };
    await mergeIntoDatabase(db, payload(edited, 5));
    expect((await db.repo('habits').get(habit.id))?.creatureAura).toBeNull();
  });
});

describe('especies pasadas en archivos de otras versiones', () => {
  async function setup() {
    const { db } = await openTestDb(noon('2026-10-24'));
    const h = await createHabit(db, {
      name: 'Leer',
      startDate: '2026-10-01',
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
      creatureSpecies: 'medusa',
    });
    const past = [{ species: 'panda', maxStage: 2 }];
    const habit = await db.repo('habits').update(h.id, { creaturePast: past });
    const merge = (remote: Habit, schemaVersion: number) =>
      mergeIntoDatabase(db, {
        formatVersion: 1,
        schemaVersion,
        exportedAt: noon('2026-10-24'),
        sourceDeviceId: 'otro-dispositivo',
        collections: { ...emptyDataset(), habits: [remote] },
        privateVault: null,
      });
    const newer = {
      ...habit,
      creatureSpecies: 'poseidon',
      creaturePast: [],
      updatedAt: habit.updatedAt + 1000,
    };
    return { db, habit, past, merge, newer };
  }

  it('esquema 4: aplica la especie remota y conserva el pasado local', async () => {
    const { db, habit, past, merge, newer } = await setup();
    await merge(newer, 4);
    expect(await db.repo('habits').get(habit.id)).toMatchObject({
      creatureSpecies: 'poseidon',
      creaturePast: past,
    });
  });

  it('esquema 3: conserva la especie y el pasado locales', async () => {
    const { db, habit, past, merge, newer } = await setup();
    await merge(newer, 3);
    expect(await db.repo('habits').get(habit.id)).toMatchObject({
      creatureSpecies: 'medusa',
      creaturePast: past,
    });
  });

  it('esquema 5: aplica los dos', async () => {
    const { db, habit, merge, newer } = await setup();
    await merge(newer, 5);
    expect(await db.repo('habits').get(habit.id)).toMatchObject({
      creatureSpecies: 'poseidon',
      creaturePast: [],
    });
  });
});
