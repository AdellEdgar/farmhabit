import { createContext, useContext } from 'react';
import type { AssistantConversation, AssistantState } from '@farmhabit/core';

export interface AssistantContextValue {
  /** Solo en la app instalada: la API key va al llavero del sistema. */
  available: boolean;
  /** Ya se ha leído la configuración del dispositivo. */
  loaded: boolean;
  configured: boolean;
  model: string;
  conversation: AssistantConversation | null;
  state: AssistantState;
  /** Panel abierto (desplegado en escritorio, a pantalla completa en móvil). */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Comprueba la clave con OpenRouter y la guarda en el llavero. */
  saveKey: (apiKey: string) => Promise<void>;
  removeKey: () => Promise<void>;
  setModel: (model: string) => Promise<void>;
  /** Empieza una conversación nueva. */
  reset: () => void;
}

export const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant fuera de AssistantProvider');
  return ctx;
}
