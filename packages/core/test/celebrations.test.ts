import { describe, expect, it } from 'vitest';
import { celebrationsFor } from '../src/game/celebrations';
import type { CreatureEvent } from '../src/game/creatures';

const hatch: CreatureEvent = { date: '2026-09-02', type: 'hatch', stage: 1 };
const demote: CreatureEvent = { date: '2026-09-05', type: 'demote', stage: 0 };

describe('celebraciones', () => {
  it('la primera vez que se ve una criatura solo se apunta, sin celebrar', () => {
    const r = celebrationsFor({ stage: 2, history: [hatch, demote] }, null);
    expect(r).toMatchObject({ celebrate: false, demotions: [] });
    expect(r.seen).toEqual({ maxStage: 2, lastDemote: '2026-09-05' });
  });

  it('celebra al pasar de la etapa más alta ya celebrada', () => {
    const r = celebrationsFor({ stage: 1, history: [hatch] }, { maxStage: 0, lastDemote: null });
    expect(r).toMatchObject({ celebrate: true, hatched: true, seen: { maxStage: 1 } });
  });

  it('marcar, desmarcar y volver a marcar hoy no repite la celebración ni avisa de retroceso', () => {
    const seen = { maxStage: 1, lastDemote: null };
    // Desmarcado: la etapa provisional de hoy vuelve a 0, pero sin evento de retroceso.
    const unmarked = celebrationsFor({ stage: 0, history: [] }, seen);
    expect(unmarked).toMatchObject({ celebrate: false, demotions: [] });
    const remarked = celebrationsFor({ stage: 1, history: [hatch] }, unmarked.seen);
    expect(remarked.celebrate).toBe(false);
  });

  it('avisa una sola vez de cada retroceso real', () => {
    const first = celebrationsFor(
      { stage: 0, history: [hatch, demote] },
      { maxStage: 1, lastDemote: null },
    );
    expect(first.demotions).toEqual([demote]);
    const again = celebrationsFor({ stage: 0, history: [hatch, demote] }, first.seen);
    expect(again.demotions).toEqual([]);
  });
});
