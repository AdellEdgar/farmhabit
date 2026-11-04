import { describe, expect, it } from 'vitest';
import { PHRASES, PHRASE_MOMENTS, pickPhrase } from '../src/game/phrases';
import { SPECIES } from '../src/game/species';

describe('frases de las criaturas', () => {
  it('cada especie tiene al menos 5 frases por momento, no vacías y de 90 caracteres o menos', () => {
    for (const s of SPECIES) {
      for (const moment of PHRASE_MOMENTS) {
        const list = PHRASES[s.id][moment];
        expect(list.length, `${s.id}/${moment}`).toBeGreaterThanOrEqual(5);
        for (const text of list) {
          expect(text.trim().length, text).toBeGreaterThan(0);
          expect(text.length, text).toBeLessThanOrEqual(90);
        }
      }
    }
  });

  it('no repite frases dentro de una especie', () => {
    for (const s of SPECIES) {
      const all = PHRASE_MOMENTS.flatMap((m) => PHRASES[s.id][m]);
      expect(new Set(all).size, s.id).toBe(all.length);
    }
  });

  it('la elección es estable con la misma semilla', () => {
    const seed = 'habito|2026-11-04|feliz';
    expect(pickPhrase('panda', 'feliz', seed)).toBe(pickPhrase('panda', 'feliz', seed));
    expect(PHRASES.panda.feliz).toContain(pickPhrase('panda', 'feliz', seed));
  });

  it('varía entre semillas', () => {
    const seen = new Set(
      Array.from({ length: 60 }, (_, i) => pickPhrase('panda', 'saludo', `dia-${i}`)),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
