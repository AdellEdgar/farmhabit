import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createVault as createRemoteVault,
  parseVaultKey,
  readVault,
  serializeVaultKey,
  syncWithRemote,
  unlockVault,
  type VaultKey,
} from '@farmhabit/core';
import { isDesktopApp } from './drivers';
import { errorMessage } from './errors';
import {
  DriveStore,
  isDriveConfigured,
  isSignedIn,
  NotSignedInError,
  signIn,
  signOut,
} from './google-drive';
import { deleteSecret, getSecret, SECRET_KEYS, setSecret } from './secrets';
import { useApp } from './use-app';
import { SyncContext, type SyncState } from './use-sync';

/** Sincronización periódica aunque no haya cambios locales (traer los de otros). */
const INTERVAL_MS = 5 * 60_000;
/** Espera tras un cambio local antes de subirlo (agrupa varios cambios seguidos). */
const DEBOUNCE_MS = 15_000;
/** Al volver a la app, sincronizar si hace más de esto de la última vez. */
const VISIBLE_SYNC_GAP_MS = 30_000;
const LAST_SYNC_META = 'sync:lastSyncAt';

export function SyncProvider({ children }: { children: ReactNode }) {
  const { db, data, mutate, toast } = useApp();
  const available = isDesktopApp && isDriveConfigured;
  const [state, setState] = useState<SyncState>({
    phase: available ? 'signed-out' : 'unavailable',
    lastSyncAt: null,
    lastResult: null,
    error: null,
    vaultExists: null,
  });
  const store = useMemo(() => new DriveStore(), []);
  const key = useRef<VaultKey | null>(null);
  const running = useRef(false);
  /** Reloj local en la última sincronización: si sube, hay cambios que subir. */
  const syncedClock = useRef(-1);

  const patch = useCallback((p: Partial<SyncState>) => setState((s) => ({ ...s, ...p })), []);

  const runSync = useCallback(
    async (manual = false) => {
      if (!key.current || running.current) return;
      running.current = true;
      patch({ phase: 'syncing', error: null });
      try {
        const result = await syncWithRemote(db, store, key.current);
        // Recargar los datos de la interfaz si han llegado cambios.
        if (result.changed > 0) await mutate(async () => undefined);
        const at = Date.now();
        syncedClock.current = db.clock.lastIssued;
        await db.setMeta(LAST_SYNC_META, String(at));
        patch({ phase: 'ready', lastSyncAt: at, lastResult: result });
        if (result.changed > 0)
          toast(`Sincronizado: ${result.changed} cambios de tus otros dispositivos`);
        else if (manual) toast('Todo está sincronizado');
      } catch (e) {
        if (e instanceof NotSignedInError) {
          key.current = null;
          patch({ phase: 'signed-out', error: e.message });
        } else {
          patch({ phase: 'error', error: errorMessage(e) });
        }
      } finally {
        running.current = false;
      }
    },
    [db, mutate, patch, store, toast],
  );

  // Al abrir: recuperar la sesión y la clave guardadas en el llavero.
  useEffect(() => {
    if (!available) return;
    void (async () => {
      const last = await db.getMeta(LAST_SYNC_META);
      if (last) patch({ lastSyncAt: Number(last) });
      if (!(await isSignedIn())) return patch({ phase: 'signed-out' });
      const saved = await getSecret(SECRET_KEYS.vaultKey);
      if (!saved)
        return patch({ phase: 'needs-vault', vaultExists: (await readVault(store)) !== null });
      key.current = await parseVaultKey(saved);
      patch({ phase: 'ready' });
      await runSync();
    })().catch((e: unknown) => patch({ phase: 'error', error: errorMessage(e) }));
  }, [available, db, patch, runSync, store]);

  // Periódicamente, para traer los cambios de los otros dispositivos.
  useEffect(() => {
    if (!available) return;
    const id = setInterval(() => void runSync(), INTERVAL_MS);
    return () => clearInterval(id);
  }, [available, runSync]);

  // Android congela la app en segundo plano: al salir, subir lo pendiente ya
  // (si no, esperaría a la próxima vez que se abra) y, al volver, traer lo
  // nuevo sin esperar a la ronda de 5 minutos.
  useEffect(() => {
    if (!available) return;
    let lastVisibleSync = Date.now();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (db.clock.lastIssued > syncedClock.current) void runSync();
      } else if (Date.now() - lastVisibleSync > VISIBLE_SYNC_GAP_MS) {
        lastVisibleSync = Date.now();
        void runSync();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [available, db, runSync]);

  // Tras un cambio local, subirlo al poco rato.
  useEffect(() => {
    if (!key.current || db.clock.lastIssued <= syncedClock.current) return;
    const id = setTimeout(() => void runSync(), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [data, db, runSync]);

  const connect = useCallback(async () => {
    try {
      await signIn();
      const vault = await readVault(store);
      patch({ phase: 'needs-vault', vaultExists: vault !== null, error: null });
    } catch (e) {
      patch({ error: errorMessage(e) });
      throw e;
    }
  }, [patch, store]);

  const saveKey = useCallback(
    async (vault: VaultKey) => {
      await setSecret(SECRET_KEYS.vaultKey, await serializeVaultKey(vault));
      key.current = vault;
      patch({ phase: 'ready', vaultExists: true, error: null });
      await runSync(true);
    },
    [patch, runSync],
  );

  const createVault = useCallback(
    async (passphrase: string) =>
      saveKey(await createRemoteVault(store, passphrase, { now: Date.now() })),
    [saveKey, store],
  );

  const joinVault = useCallback(
    async (passphrase: string) => saveKey(await unlockVault(store, passphrase)),
    [saveKey, store],
  );

  const disconnect = useCallback(async () => {
    key.current = null;
    await deleteSecret(SECRET_KEYS.vaultKey);
    await signOut();
    patch({ phase: 'signed-out', lastResult: null, error: null, vaultExists: null });
  }, [patch]);

  const value = useMemo(
    () => ({ ...state, connect, createVault, joinVault, syncNow: () => runSync(true), disconnect }),
    [state, connect, createVault, joinVault, runSync, disconnect],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
