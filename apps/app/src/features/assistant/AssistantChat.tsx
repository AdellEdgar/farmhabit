import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Loader2, SendHorizontal, Settings, Sparkles, X } from 'lucide-react';
import type { AssistantItem } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { useNavigation } from '../../lib/navigation';
import { useAssistant } from '../../lib/use-assistant';
import { Button, Chip } from '../../components/ui';

// Piezas del chat del asistente, compartidas por la barra de escritorio y el
// panel de móvil.

const SUGGESTIONS = [
  '¿Qué tengo para hoy?',
  '¿Cómo está mi granja?',
  'Apunta una tarea para mañana',
  'He hecho todos los hábitos de hoy',
];

/** Negritas (**así**) y listas con guion, lo que suelen usar los modelos. */
function FormattedText({ text }: { text: string }) {
  const inline = (line: string) =>
    line
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      );
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        if (bullet) {
          return (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden="true">•</span>
              <span>{inline(bullet[1]!)}</span>
            </p>
          );
        }
        return line.trim() ? <p key={i}>{inline(line)}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

function ActionCard({ item }: { item: Extract<AssistantItem, { kind: 'action' }> }) {
  const { conversation, state } = useAssistant();
  const status: Record<typeof item.status, ReactNode> = {
    pending: null,
    done: (
      <span className="inline-flex items-center gap-1 text-acento">
        <Check size={14} /> Hecho
      </span>
    ),
    cancelled: <span className="text-texto-suave">Cancelado</span>,
    failed: <span className="text-peligro">No se pudo: {item.error}</span>,
  };
  return (
    <div
      className={cx(
        'rounded-xl border p-3 text-sm',
        item.status === 'pending' ? 'border-acento bg-acento-suave/40' : 'border-borde',
      )}
    >
      <p className={cx(item.status === 'cancelled' && 'text-texto-suave line-through')}>
        {item.summary}
      </p>
      {item.status === 'pending' ? (
        <div className="mt-2.5 flex gap-2">
          <Button
            variant="primary"
            disabled={state.busy}
            onClick={() => void conversation?.resolve(item.id, true)}
          >
            <Check size={15} /> Confirmar
          </Button>
          <Button
            variant="ghost"
            disabled={state.busy}
            onClick={() => void conversation?.resolve(item.id, false)}
          >
            <X size={15} /> Cancelar
          </Button>
        </div>
      ) : (
        <p className="mt-1.5 text-xs">{status[item.status]}</p>
      )}
    </div>
  );
}

export function AssistantMessages({ className }: { className?: string }) {
  const { conversation, state } = useAssistant();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [state.items.length, state.busy]);

  return (
    <div className={cx('space-y-3 overflow-y-auto px-4 py-3', className)} aria-live="polite">
      {state.items.length === 0 && (
        <div className="py-2">
          <p className="mb-3 text-sm text-texto-suave">
            Pídeme lo que quieras sobre tus tareas, hábitos, notas o la granja. Antes de cambiar
            nada te lo enseñaré para que lo confirmes.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Chip key={s} disabled={state.busy} onClick={() => void conversation?.send(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
      {state.items.map((item) => {
        switch (item.kind) {
          case 'user':
            return (
              <div key={item.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-acento px-3.5 py-2 text-sm whitespace-pre-wrap text-acento-texto">
                  {item.text}
                </p>
              </div>
            );
          case 'assistant':
            return (
              <div
                key={item.id}
                className="max-w-[90%] rounded-2xl rounded-bl-md bg-elevado px-3.5 py-2 text-sm"
              >
                <FormattedText text={item.text} />
              </div>
            );
          case 'action':
            return <ActionCard key={item.id} item={item} />;
          case 'error':
            return (
              <p key={item.id} className="rounded-xl bg-peligro/10 px-3 py-2 text-sm text-peligro">
                {item.text}
              </p>
            );
        }
      })}
      {state.busy && (
        <p className="inline-flex items-center gap-2 text-sm text-texto-suave">
          <Loader2 size={15} className="animate-spin" /> Pensando…
        </p>
      )}
      <div ref={end} />
    </div>
  );
}

export function AssistantComposer({
  onFocus,
  autoFocus,
  trailing,
}: {
  onFocus?: () => void;
  autoFocus?: boolean;
  trailing?: ReactNode;
}) {
  const { conversation, state, setOpen } = useAssistant();
  const [text, setText] = useState('');

  const send = () => {
    if (!text.trim() || state.busy) return;
    setOpen(true);
    void conversation?.send(text);
    setText('');
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex items-center gap-2"
    >
      <div className="flex flex-1 items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2 focus-within:border-acento">
        <Sparkles size={18} className="shrink-0 text-acento" aria-hidden="true" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={onFocus}
          autoFocus={autoFocus}
          placeholder="Pide algo al asistente…"
          aria-label="Mensaje para el asistente"
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-texto-suave/80"
        />
        <button
          type="submit"
          disabled={!text.trim() || state.busy}
          aria-label="Enviar"
          title="Enviar"
          className="text-acento transition disabled:opacity-40"
        >
          <SendHorizontal size={18} />
        </button>
      </div>
      {trailing}
    </form>
  );
}

/** Aviso cuando aún no hay API key, con acceso directo a Ajustes. */
export function AssistantSetupHint() {
  const { go } = useNavigation();
  const { setOpen } = useAssistant();
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Sparkles size={18} className="text-acento" aria-hidden="true" />
      <span className="text-texto-suave">Activa el asistente con tu API key de OpenRouter.</span>
      <Button
        onClick={() => {
          setOpen(false);
          go('ajustes');
        }}
      >
        <Settings size={15} /> Ir a Ajustes
      </Button>
    </div>
  );
}
