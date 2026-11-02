import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import {
  AssistantConversation,
  localDateOf,
  systemClock,
  type AssistantState,
} from '@farmhabit/core';
import { isDesktopApp } from './drivers';
import { DEFAULT_MODEL, OpenRouterClient, verifyKey } from './openrouter';
import { deleteSecret, getSecret, SECRET_KEYS, setSecret } from './secrets';
import { useApp } from './use-app';
import { AssistantContext } from './use-assistant';

// Asistente con IA (OpenRouter). La API key es de cada dispositivo y va al
// llavero del sistema; el modelo elegido, a `meta`. La conversación vive solo
// en memoria: se pierde al cerrar la app o al empezar otra.

const MODEL_KEY = 'assistant:model';
const IDLE: AssistantState = { items: [], busy: false };
const noSubscription = () => () => {};

export function AssistantProvider({ children }: { children: ReactNode }) {
  const { db, mutate } = useApp();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [model, setModelState] = useState(DEFAULT_MODEL);
  const [loaded, setLoaded] = useState(!isDesktopApp);
  const [open, setOpen] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!isDesktopApp) return;
    void (async () => {
      const [key, savedModel] = await Promise.all([
        getSecret(SECRET_KEYS.openRouterKey).catch(() => null),
        db.getMeta(MODEL_KEY),
      ]);
      setApiKey(key);
      if (savedModel) setModelState(savedModel);
      setLoaded(true);
    })();
  }, [db]);

  const conversation = useMemo(() => {
    // Cada `generation` es una conversación nueva ("Nueva conversación").
    void generation;
    return apiKey
      ? new AssistantConversation({
          client: new OpenRouterClient(apiKey, model),
          context: () => {
            const now = systemClock.now();
            return { db, now, today: localDateOf(now) };
          },
          // Un mutate vacío relee lo que haya cambiado y refresca la interfaz.
          onDataChanged: async () => {
            await mutate(async () => undefined);
          },
        })
      : null;
  }, [apiKey, model, db, mutate, generation]);

  const state = useSyncExternalStore(
    conversation ? (l) => conversation.subscribe(l) : noSubscription,
    () => conversation?.getState() ?? IDLE,
  );

  const saveKey = useCallback(async (key: string) => {
    const clean = key.trim();
    await verifyKey(clean);
    await setSecret(SECRET_KEYS.openRouterKey, clean);
    setApiKey(clean);
  }, []);

  const removeKey = useCallback(async () => {
    await deleteSecret(SECRET_KEYS.openRouterKey);
    setApiKey(null);
    setOpen(false);
  }, []);

  const setModel = useCallback(
    async (next: string) => {
      const clean = next.trim() || DEFAULT_MODEL;
      await db.setMeta(MODEL_KEY, clean);
      setModelState(clean);
    },
    [db],
  );

  const reset = useCallback(() => setGeneration((g) => g + 1), []);

  return (
    <AssistantContext.Provider
      value={{
        available: isDesktopApp,
        loaded,
        configured: apiKey !== null,
        model,
        conversation,
        state,
        open,
        setOpen,
        saveKey,
        removeKey,
        setModel,
        reset,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}
