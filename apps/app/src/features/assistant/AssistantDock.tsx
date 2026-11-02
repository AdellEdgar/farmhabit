import { ChevronDown, ChevronUp, RotateCcw, Sparkles } from 'lucide-react';
import { useAssistant } from '../../lib/use-assistant';
import { IconButton } from '../../components/ui';
import { AssistantComposer, AssistantMessages, AssistantSetupHint } from './AssistantChat';

/**
 * Escritorio (md+): barra fija abajo de la sección. Recogida es solo el campo
 * de texto; al escribir o al desplegarla muestra la conversación encima.
 */
export function AssistantDock() {
  const assistant = useAssistant();
  if (!assistant.available || !assistant.loaded) return null;

  const hasHistory = assistant.state.items.length > 0;

  return (
    <section
      aria-label="Asistente"
      className="hidden shrink-0 border-t border-borde bg-superficie md:block"
    >
      <div className="mx-auto w-full max-w-4xl px-8 py-3 2xl:px-12">
        {!assistant.configured ? (
          <AssistantSetupHint />
        ) : (
          <>
            {assistant.open && (
              <div className="mb-3 overflow-hidden rounded-xl border border-borde bg-fondo">
                <div className="flex items-center gap-2 border-b border-borde px-4 py-2">
                  <Sparkles size={16} className="text-acento" aria-hidden="true" />
                  <span className="text-sm font-semibold">Asistente</span>
                  <span className="truncate text-xs text-texto-suave">{assistant.model}</span>
                  <span className="flex-1" />
                  <IconButton
                    label="Nueva conversación"
                    disabled={!hasHistory || assistant.state.busy}
                    onClick={assistant.reset}
                  >
                    <RotateCcw size={16} />
                  </IconButton>
                  <IconButton label="Recoger" onClick={() => assistant.setOpen(false)}>
                    <ChevronDown size={18} />
                  </IconButton>
                </div>
                <AssistantMessages className="max-h-[45vh] min-h-32" />
              </div>
            )}
            <AssistantComposer
              onFocus={() => hasHistory && assistant.setOpen(true)}
              trailing={
                !assistant.open && (
                  <IconButton label="Ver la conversación" onClick={() => assistant.setOpen(true)}>
                    <ChevronUp size={18} />
                  </IconButton>
                )
              }
            />
          </>
        )}
      </div>
    </section>
  );
}
