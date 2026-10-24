/** Fuente de tiempo inyectable (en tests se usa un reloj fijo). */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Reloj fijo o manual, para tests. */
export class ManualClock implements Clock {
  constructor(private current: number) {}
  now(): number {
    return this.current;
  }
  set(ms: number): void {
    this.current = ms;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

/**
 * Genera marcas `updatedAt` estrictamente crecientes en un dispositivo, aunque
 * el reloj del sistema retroceda: max(ahora, último + 1).
 */
export class MonotonicClock {
  constructor(
    private readonly source: Clock,
    private last = 0,
  ) {}

  next(): number {
    this.last = Math.max(this.source.now(), this.last + 1);
    return this.last;
  }

  /** Último valor emitido (para persistirlo). */
  get lastIssued(): number {
    return this.last;
  }

  /** Avanza el reloj tras importar datos con marcas posteriores. */
  observe(ms: number): void {
    if (ms > this.last) this.last = ms;
  }
}
