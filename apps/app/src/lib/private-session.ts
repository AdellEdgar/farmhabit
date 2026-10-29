import { useSyncExternalStore } from 'react';

// Sesión de notas privadas: la clave (DEK) solo vive en memoria mientras están
// desbloqueadas, nunca en disco. Se bloquea sola tras unos minutos sin uso.

const AUTO_LOCK_MS = 5 * 60_000;

let dek: Uint8Array | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function armTimer() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(lockPrivateNotes, AUTO_LOCK_MS);
}

export function unlockPrivateNotes(key: Uint8Array): void {
  dek = key;
  armTimer();
  emit();
}

export function lockPrivateNotes(): void {
  if (dek) dek.fill(0);
  dek = null;
  if (timer) clearTimeout(timer);
  timer = null;
  emit();
}

/** Clave actual fuera de React (p. ej. justo después de desbloquear). */
export function getPrivateKey(): Uint8Array | null {
  return dek;
}

/** Clave actual, reactiva, y renueva el bloqueo automático mientras se usa. */
export function usePrivateKey(): Uint8Array | null {
  const key = usePrivateSession();
  if (key) armTimer();
  return key;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Clave actual, reactiva: el componente se vuelve a pintar al bloquear o desbloquear. */
export function usePrivateSession(): Uint8Array | null {
  return useSyncExternalStore(subscribe, () => dek);
}
