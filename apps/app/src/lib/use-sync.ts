import { createContext, useContext } from 'react';
import type { SyncResult } from '@farmhabit/core';

export type SyncPhase =
  | 'unavailable' // modo navegador o sin credenciales de Google
  | 'signed-out' // sin sesión de Google
  | 'needs-vault' // con sesión, pero sin frase secreta en este dispositivo
  | 'ready'
  | 'syncing'
  | 'error';

export interface SyncState {
  phase: SyncPhase;
  lastSyncAt: number | null;
  lastResult: SyncResult | null;
  error: string | null;
  /** Si ya existe una sincronización en la cuenta (unirse) o hay que crearla. */
  vaultExists: boolean | null;
}

export interface SyncContextValue extends SyncState {
  connect: () => Promise<void>;
  createVault: (passphrase: string) => Promise<void>;
  joinVault: (passphrase: string) => Promise<void>;
  syncNow: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync fuera de SyncProvider');
  return ctx;
}
