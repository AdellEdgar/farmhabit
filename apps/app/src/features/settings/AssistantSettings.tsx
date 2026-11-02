import { useState } from 'react';
import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { errorMessage } from '../../lib/errors';
import { SUGGESTED_MODELS } from '../../lib/openrouter';
import { useAssistant } from '../../lib/use-assistant';
import { Button, Card, Field, Input } from '../../components/ui';

export function AssistantSettings() {
  const assistant = useAssistant();
  const [key, setKey] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const modelValue = model ?? assistant.model;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-acento-suave text-acento">
          <Sparkles size={20} />
        </span>
        <div>
          <h2 className="font-semibold">Asistente con IA</h2>
          <p className="mt-0.5 text-sm text-texto-suave">
            Pídele cosas con tus palabras: crear tareas, marcar hábitos, buscar en tus notas o saber
            cómo va la granja. Cada cambio te lo propone y solo se aplica si lo confirmas.
          </p>
        </div>
      </div>

      {!assistant.available ? (
        <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">
          El asistente solo funciona en la app instalada, no en el modo navegador.
        </p>
      ) : !assistant.configured ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim())
              void run(async () => {
                await assistant.saveKey(key);
                setKey('');
              });
          }}
        >
          <Field
            label="API key de OpenRouter"
            hint={
              <>
                Se guarda en el llavero del sistema de este dispositivo.{' '}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-acento hover:underline"
                  onClick={() => void openUrl('https://openrouter.ai/keys')}
                >
                  Conseguir una clave <ExternalLink size={12} />
                </button>
              </>
            }
          >
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-or-v1-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </Field>
          <Button variant="primary" type="submit" disabled={!key.trim() || busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? 'Comprobando…' : 'Guardar y activar'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-acento">✓ Activado en este dispositivo.</p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await assistant.setModel(modelValue);
                setModel(null);
              });
            }}
          >
            <div className="min-w-60 flex-1">
              <Field
                label="Modelo"
                hint="Cualquier modelo de OpenRouter que admita herramientas (tools)."
              >
                <Input
                  list="assistant-models"
                  spellCheck={false}
                  value={modelValue}
                  onChange={(e) => setModel(e.target.value)}
                />
              </Field>
              <datalist id="assistant-models">
                {SUGGESTED_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            {model !== null && model !== assistant.model && (
              <Button type="submit" disabled={busy} className="mb-6">
                Guardar modelo
              </Button>
            )}
          </form>
          <div className="flex flex-wrap gap-2">
            {confirmRemove ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => run(assistant.removeKey).then(() => setConfirmRemove(false))}
                >
                  Sí, quitar la clave
                </Button>
                <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmRemove(true)}>
                Quitar la API key
              </Button>
            )}
          </div>
        </div>
      )}

      {assistant.available && (
        <p className="text-xs text-texto-suave">
          Cuando usas el asistente, tus mensajes y los datos que consulta (tareas, hábitos, granja y
          notas no privadas) se envían a OpenRouter y al proveedor del modelo elegido. Las notas
          privadas nunca. El uso se cobra de tu crédito de OpenRouter.
        </p>
      )}

      {error && <p className="rounded-xl bg-peligro/10 px-3 py-2 text-sm text-peligro">{error}</p>}
    </Card>
  );
}
