import { RotateCcw, Sparkles, X } from 'lucide-react';
import { useAssistant } from '../../lib/use-assistant';
import { IconButton } from '../../components/ui';
import { AssistantComposer, AssistantMessages, AssistantSetupHint } from './AssistantChat';

/**
 * Móvil (por debajo de md): botón flotante encima de la barra de secciones que
 * abre el chat a pantalla completa. Los bordes usan --fh-inset-* (ver insets.ts).
 */
export function AssistantMobile() {
  const assistant = useAssistant();
  if (!assistant.available || !assistant.loaded) return null;

  if (!assistant.open) {
    return (
      <button
        type="button"
        onClick={() => assistant.setOpen(true)}
        aria-label="Abrir el asistente"
        className="fixed right-4 bottom-[calc(4.75rem+var(--fh-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-acento text-acento-texto shadow-lg transition active:scale-95 md:hidden"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Asistente"
      className="fixed inset-0 z-40 flex flex-col bg-fondo pt-[var(--fh-inset-top)] pb-[var(--fh-inset-bottom)] md:hidden"
    >
      <div className="flex items-center gap-2 border-b border-borde bg-superficie px-4 py-2">
        <Sparkles size={18} className="text-acento" aria-hidden="true" />
        <span className="font-semibold">Asistente</span>
        <span className="flex-1" />
        {assistant.configured && (
          <IconButton
            label="Nueva conversación"
            disabled={assistant.state.items.length === 0 || assistant.state.busy}
            onClick={assistant.reset}
          >
            <RotateCcw size={18} />
          </IconButton>
        )}
        <IconButton label="Cerrar" onClick={() => assistant.setOpen(false)}>
          <X size={20} />
        </IconButton>
      </div>
      {assistant.configured ? (
        <>
          <AssistantMessages className="flex-1" />
          <div className="border-t border-borde bg-superficie p-3">
            <AssistantComposer />
          </div>
        </>
      ) : (
        <div className="p-4">
          <AssistantSetupHint />
        </div>
      )}
    </div>
  );
}
