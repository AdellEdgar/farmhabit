import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { emptyDataset } from '../src/model/collections';
import type { Dataset } from '../src/model/collections';
import type { SyncEntity, Tag } from '../src/model/types';
import {
  compareVersions,
  FUTURE_TOLERANCE_MS,
  mergeDatasets,
  mergeEntities,
} from '../src/sync/merge';
import { deterministicId } from '../src/util/ids';
import { makeHabit, makeLog, makeNote, makeTask } from './helpers/fixtures';

const NOW = Date.UTC(2026, 9, 24, 12);

function dataset(parts: Partial<Dataset>): Dataset {
  return { ...emptyDataset(), ...parts };
}

describe('gana el más reciente', () => {
  const base = makeTask({ title: 'original', updatedAt: 100 });

  it('gana la versión remota si es más nueva', () => {
    const remote = { ...base, title: 'remota', updatedAt: 200 };
    const { changes, report } = mergeDatasets(
      dataset({ tasks: [base] }),
      dataset({ tasks: [remote] }),
      { now: NOW },
    );
    expect(changes.tasks).toEqual([remote]);
    expect(report.collections.tasks.updated).toBe(1);
  });

  it('se queda la local si es más nueva', () => {
    const local = { ...base, title: 'local', updatedAt: 300 };
    const remote = { ...base, title: 'remota', updatedAt: 200 };
    const { changes, report } = mergeDatasets(
      dataset({ tasks: [local] }),
      dataset({ tasks: [remote] }),
      { now: NOW },
    );
    expect(changes.tasks).toEqual([]);
    expect(report.collections.tasks.unchanged).toBe(1);
  });

  it('los elementos nuevos del otro dispositivo se añaden', () => {
    const { changes, report } = mergeDatasets(dataset({}), dataset({ tasks: [base] }), {
      now: NOW,
    });
    expect(changes.tasks).toEqual([base]);
    expect(report.collections.tasks.added).toBe(1);
  });

  it('un borrado remoto más reciente borra en local', () => {
    const tomb = { ...base, title: '', updatedAt: 200, deletedAt: 200 };
    const { changes, report } = mergeDatasets(
      dataset({ tasks: [base] }),
      dataset({ tasks: [tomb] }),
      { now: NOW },
    );
    expect(changes.tasks).toEqual([tomb]);
    expect(report.collections.tasks.deleted).toBe(1);
  });

  it('una copia antigua no resucita algo borrado', () => {
    const tomb = { ...base, title: '', updatedAt: 200, deletedAt: 200 };
    const { changes } = mergeDatasets(dataset({ tasks: [tomb] }), dataset({ tasks: [base] }), {
      now: NOW,
    });
    expect(changes.tasks).toEqual([]);
  });

  it('una edición posterior al borrado lo resucita', () => {
    const tomb = { ...base, title: '', updatedAt: 200, deletedAt: 200 };
    const edited = { ...base, title: 'editada después', updatedAt: 300 };
    const { changes } = mergeDatasets(dataset({ tasks: [tomb] }), dataset({ tasks: [edited] }), {
      now: NOW,
    });
    expect(changes.tasks).toEqual([edited]);
  });

  it('en empate gana el borrado y, si no, un desempate determinista', () => {
    const tomb = { ...base, updatedAt: 200, deletedAt: 200 };
    const edit = { ...base, title: 'x', updatedAt: 200 };
    expect(compareVersions(tomb, edit)).toBeGreaterThan(0);
    expect(compareVersions(edit, tomb)).toBeLessThan(0);

    const a = { ...base, title: 'a', updatedAt: 200 };
    const b = { ...base, title: 'b', updatedAt: 200 };
    expect(Math.sign(compareVersions(a, b))).toBe(-Math.sign(compareVersions(b, a)));
    expect(mergeEntities([a], [b])).toEqual(mergeEntities([b], [a]));
  });

  it('reimportar el mismo archivo no cambia nada', () => {
    const data = dataset({ tasks: [base, makeTask()], notes: [makeNote()] });
    const { changes } = mergeDatasets(data, structuredClone(data), { now: NOW });
    expect(Object.values(changes).flat()).toEqual([]);
  });
});

describe('hábitos en dos dispositivos', () => {
  it('el registro del mismo hábito y día converge en uno solo', () => {
    const habit = makeHabit();
    const pc = { ...makeLog(habit, '2026-10-24'), updatedAt: 100 };
    const mobile = { ...makeLog(habit, '2026-10-24', 'done', null), updatedAt: 150 };
    expect(pc.id).toBe(mobile.id);
    expect(pc.id).toBe(deterministicId('habitLog', habit.id, '2026-10-24'));
    const merged = mergeEntities([pc], [mobile]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(mobile);
  });
});

describe('notas editadas en los dos lados', () => {
  const original = makeNote({ title: 'Lista', content: 'v0', updatedAt: 100 });
  const local = { ...original, content: 'v-pc', updatedAt: 300 };
  const remote = { ...original, content: 'v-movil', updatedAt: 400 };

  it('se conserva la versión perdedora como copia de conflicto', () => {
    const { changes, report } = mergeDatasets(
      dataset({ notes: [local] }),
      dataset({ notes: [remote] }),
      {
        now: NOW,
        lastSyncedAt: 200,
      },
    );
    expect(report.conflictCopies).toBe(1);
    const copy = changes.notes.find((n) => n.id !== original.id);
    expect(copy).toMatchObject({ title: 'Lista (conflicto)', content: 'v-pc' });
    expect(changes.notes.find((n) => n.id === original.id)?.content).toBe('v-movil');
  });

  it('los dos dispositivos crean la misma copia (id determinista)', () => {
    const opts = { now: NOW, lastSyncedAt: 200 };
    const onPc = mergeDatasets(dataset({ notes: [local] }), dataset({ notes: [remote] }), opts);
    const onMobile = mergeDatasets(dataset({ notes: [remote] }), dataset({ notes: [local] }), opts);
    const copyPc = onPc.changes.notes.find((n) => n.id !== original.id);
    const copyMobile = onMobile.changes.notes.find((n) => n.id !== original.id);
    expect(copyPc).toEqual(copyMobile);
  });

  it('sin edición en los dos lados no hay copia', () => {
    const { report } = mergeDatasets(dataset({ notes: [original] }), dataset({ notes: [remote] }), {
      now: NOW,
      lastSyncedAt: 200,
    });
    expect(report.conflictCopies).toBe(0);
  });
});

describe('relojes desajustados', () => {
  it('avisa de marcas de tiempo del futuro', () => {
    const future = makeTask({ updatedAt: NOW + FUTURE_TOLERANCE_MS + 1 });
    const ok = makeTask({ updatedAt: NOW + 1000 });
    const { report } = mergeDatasets(dataset({}), dataset({ tasks: [future, ok] }), { now: NOW });
    expect(report.futureTimestamps.map((f) => f.id)).toEqual([future.id]);
  });
});

describe('propiedades de la fusión', () => {
  // Versiones de unos pocos ids, para forzar choques, empates y borrados.
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003',
  ];
  const tagArb: fc.Arbitrary<Tag> = fc.record({
    id: fc.constantFrom(...ids),
    createdAt: fc.constant(1),
    updatedAt: fc.integer({ min: 1, max: 5 }),
    deletedAt: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
    name: fc.constantFrom('a', 'b', 'c'),
    color: fc.constantFrom('rojo', 'verde'),
  });
  const replica = fc.array(tagArb, { maxLength: 6 });
  const merge = <T extends SyncEntity>(a: T[], b: T[]) => mergeEntities(a, b);

  it('es conmutativa', () => {
    fc.assert(
      fc.property(replica, replica, (a, b) => {
        expect(merge(a, b)).toEqual(merge(b, a));
      }),
    );
  });

  it('es asociativa', () => {
    fc.assert(
      fc.property(replica, replica, replica, (a, b, c) => {
        expect(merge(merge(a, b), c)).toEqual(merge(a, merge(b, c)));
      }),
    );
  });

  it('es idempotente', () => {
    fc.assert(
      fc.property(replica, replica, (a, b) => {
        const once = merge(a, b);
        expect(merge(once, b)).toEqual(once);
        expect(merge(once, once)).toEqual(once);
      }),
    );
  });

  it('aplicar los cambios deja a ambos dispositivos iguales', () => {
    fc.assert(
      fc.property(replica, replica, (a, b) => {
        const local = merge(a, []);
        const remote = merge(b, []);
        const { changes } = mergeDatasets(dataset({ tags: local }), dataset({ tags: remote }), {
          now: NOW,
        });
        const applied = mergeEntities(local, changes.tags);
        expect(applied).toEqual(merge(local, remote));
      }),
    );
  });
});
