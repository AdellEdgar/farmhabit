import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ManualClock, MonotonicClock } from '../src/util/clock';
import {
  addDays,
  diffDays,
  endOfMonth,
  isLocalDate,
  isoWeekday,
  localDateOf,
  localDateTimeToEpoch,
  startOfWeek,
} from '../src/util/dates';
import { compareSortKey, keyBetween } from '../src/util/fractional-index';
import { fnv1a, stableRandom } from '../src/util/hash';
import { compareSemver, isSemver } from '../src/util/version';
import { deterministicId, newId } from '../src/util/ids';

describe('fechas locales', () => {
  it('valida fechas reales', () => {
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('26-01-01')).toBe(false);
  });

  it('suma días cruzando meses, años y cambios de hora', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30'); // DST en Madrid el 29
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('calcula día de la semana, lunes y fin de mes', () => {
    expect(isoWeekday('2026-10-24')).toBe(6); // sábado
    expect(isoWeekday('2026-10-25')).toBe(7); // domingo
    expect(startOfWeek('2026-10-25')).toBe('2026-10-19');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });

  it('convierte entre instante y fecha local alrededor de medianoche', () => {
    const lateNight = localDateTimeToEpoch('2026-10-24', '23:59');
    expect(localDateOf(lateNight)).toBe('2026-10-24');
    expect(localDateOf(lateNight + 60_000)).toBe('2026-10-25');
  });
});

describe('reloj monotónico', () => {
  it('nunca retrocede aunque el reloj del sistema lo haga', () => {
    const source = new ManualClock(1_000);
    const clock = new MonotonicClock(source);
    const a = clock.next();
    source.set(500);
    const b = clock.next();
    const c = clock.next();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('continúa por delante de lo importado', () => {
    const clock = new MonotonicClock(new ManualClock(1_000));
    clock.observe(5_000);
    expect(clock.next()).toBe(5_001);
  });
});

describe('ids', () => {
  it('genera UUID distintos', () => {
    expect(newId()).not.toBe(newId());
  });

  it('el id determinista es estable y depende de los datos', () => {
    expect(deterministicId('habitLog', 'h1', '2026-10-24')).toBe(
      deterministicId('habitLog', 'h1', '2026-10-24'),
    );
    expect(deterministicId('habitLog', 'h1', '2026-10-24')).not.toBe(
      deterministicId('habitLog', 'h1', '2026-10-25'),
    );
  });
});

describe('hashes estables', () => {
  it('FNV-1a no cambia nunca (el motor de la granja depende de él)', () => {
    // Valores de referencia de FNV-1a de 32 bits.
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('death|2026-09-13|abc')).toBe(fnv1a('death|2026-09-13|abc'));
  });

  it('stableRandom da valores en [0, 1) bien repartidos aunque los textos se parezcan', () => {
    const values = Array.from({ length: 2000 }, (_, i) => stableRandom(`hábito|2026-01-${i}`));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    const low = values.filter((v) => v < 0.5).length;
    expect(low).toBeGreaterThan(900);
    expect(low).toBeLessThan(1100);
  });
});

describe('índices fraccionales', () => {
  it('inserta antes, entre y después', () => {
    const a = keyBetween(null, null);
    const b = keyBetween(a, null);
    const mid = keyBetween(a, b);
    const first = keyBetween(null, a);
    expect([b, mid, first, a].sort()).toEqual([first, a, mid, b]);
  });

  it('siempre encuentra una clave estrictamente entre dos', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 60 }), (choices) => {
        let lo = keyBetween(null, null);
        let hi = keyBetween(lo, null);
        for (const left of choices) {
          const k = keyBetween(lo, hi);
          expect(k > lo && k < hi).toBe(true);
          if (left) hi = k;
          else lo = k;
        }
      }),
    );
  });

  it('a igualdad de clave ordena por id', () => {
    const x = { sortKey: 'V', id: 'a' };
    const y = { sortKey: 'V', id: 'b' };
    expect([y, x].sort(compareSortKey)).toEqual([x, y]);
  });
});

describe('versiones', () => {
  it('sigue el orden de semver.org', () => {
    // Ejemplo de la especificación, de menor a mayor.
    const ordered = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
      '1.0.1',
      '1.1.0',
      '2.0.0',
    ];
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(compareSemver(ordered[i]!, ordered[i + 1]!)).toBe(-1);
      expect(compareSemver(ordered[i + 1]!, ordered[i]!)).toBe(1);
    }
  });

  it('compara los números como números, no como texto', () => {
    expect(compareSemver('1.0.0-rc.10', '1.0.0-rc.9')).toBe(1);
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1);
  });

  it('acepta la v de las etiquetas e ignora los metadatos de compilación', () => {
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
    expect(compareSemver('1.2.3+abc', '1.2.3')).toBe(0);
  });

  it('rechaza lo que no es una versión', () => {
    expect(isSemver('1.0')).toBe(false);
    expect(() => compareSemver('1.0.0', 'latest')).toThrow('latest');
  });
});
