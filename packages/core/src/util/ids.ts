import { v4, v5 } from 'uuid';

/** Espacio de nombres propio para los UUID v5 de FarmHabit. No cambiarlo nunca. */
const FARMHABIT_NAMESPACE = '6f1e2b0c-58a4-4d5e-9a63-2f0b8c7d1e94';

export function newId(): string {
  return v4();
}

/**
 * Id determinista: los mismos datos dan el mismo id en cualquier dispositivo.
 * Se usa para registros que dos dispositivos pueden crear a la vez
 * (p. ej. el registro de un hábito en un día concreto).
 */
export function deterministicId(kind: string, ...parts: string[]): string {
  return v5([kind, ...parts].join('|'), FARMHABIT_NAMESPACE);
}
