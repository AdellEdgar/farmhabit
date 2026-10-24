import { describe, expect, it } from 'vitest';
import { DecryptionError } from '../src/crypto/sodium';
import { createHabit, setHabitLog } from '../src/services/habits';
import { exportDatabase, importIntoDatabase } from '../src/sync/service';
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
