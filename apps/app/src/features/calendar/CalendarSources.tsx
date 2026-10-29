import { useEffect, useState } from 'react';
import { Eye, EyeOff, FileUp, Link2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import {
  addFileCalendar,
  addUrlCalendar,
  removeCalendar,
  type CalendarSource,
} from '@farmhabit/core';
import { calendarsChanged, lastFetched, refreshSource } from '../../lib/calendars';
import { isDesktopApp } from '../../lib/drivers';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { useApp } from '../../lib/use-app';
import { Button, Dialog, Field, IconButton, Input, Segmented } from '../../components/ui';
import { cx } from '../../lib/cx';

const CALENDAR_COLORS = [
  '#5b9cf0',
  '#e3a33b',
  '#b57edc',
  '#4fc1c6',
  '#e07bb0',
  '#e5534b',
  '#7cc46b',
  '#a3a86b',
];

async function pickIcsFile(): Promise<{ name: string; text: string } | null> {
  if (isDesktopApp) {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'Calendario', extensions: ['ics'] }],
    });
    if (!path) return null;
    const name = decodeURIComponent(path.split(/[\\/]/).pop() ?? 'Calendario').replace(
      /\.ics$/i,
      '',
    );
    return { name, text: await readTextFile(path) };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ics,text/calendar';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name.replace(/\.ics$/i, ''), text: await file.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function SourceRow({ source }: { source: CalendarSource }) {
  const { db, mutate, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void lastFetched(db, source).then(setFetched);
  }, [db, source]);

  const refresh = async () => {
    setBusy(true);
    try {
      const n = await refreshSource(db, source);
      setFetched(Date.now());
      toast(`«${source.name}» actualizado: ${n} eventos`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-elevado">
      <span className="size-3 shrink-0 rounded-full" style={{ background: source.color }} />
      <div className={cx('min-w-0 flex-1', !source.visible && 'opacity-50')}>
        <p className="truncate text-sm font-medium">{source.name}</p>
        <p className="truncate text-xs text-texto-suave">
          {source.kind === 'file'
            ? 'Archivo importado'
            : fetched
              ? `Actualizado ${formatDateTime(fetched)}`
              : 'Sin descargar todavía'}
        </p>
      </div>
      {confirm ? (
        <>
          <Button
            variant="danger"
            onClick={() => mutate((d) => removeCalendar(d, source.id)).then(calendarsChanged)}
          >
            Quitar
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            No
          </Button>
        </>
      ) : (
        <>
          <IconButton
            label={source.visible ? 'Ocultar' : 'Mostrar'}
            onClick={() =>
              mutate((d) =>
                d.repo('calendarSources').update(source.id, { visible: !source.visible }),
              )
            }
          >
            {source.visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </IconButton>
          {source.kind === 'url' && (
            <IconButton label="Actualizar ahora" onClick={refresh} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </IconButton>
          )}
          <IconButton
            label="Quitar calendario"
            onClick={() => setConfirm(true)}
            className="hover:text-peligro"
          >
            <Trash2 size={16} />
          </IconButton>
        </>
      )}
    </li>
  );
}

export function CalendarSources({ onClose }: { onClose: () => void }) {
  const { db, data, mutate, toast } = useApp();
  const sources = data.calendarSources;
  const [mode, setMode] = useState<'url' | 'file'>('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState(CALENDAR_COLORS[sources.length % CALENDAR_COLORS.length]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addUrl = async () => {
    setBusy(true);
    setError(null);
    try {
      const source = await addUrlCalendar(db, name || 'Calendario', url, color);
      try {
        const n = await refreshSource(db, source);
        toast(`Calendario añadido: ${n} eventos`);
      } catch (e) {
        toast(`Añadido, pero no se pudo descargar todavía: ${errorMessage(e)}`, 'error');
      }
      await mutate(async () => undefined);
      setName('');
      setUrl('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const importFile = async () => {
    setError(null);
    try {
      const file = await pickIcsFile();
      if (!file) return;
      const source = await mutate((d) => addFileCalendar(d, name || file.name, file.text, color));
      if (source) {
        calendarsChanged();
        toast(`«${source.name}» importado`);
        setName('');
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Calendarios" wide>
      {sources.length > 0 ? (
        <ul className="-mx-2">
          {sources.map((s) => (
            <SourceRow key={s.id} source={s} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-texto-suave">
          Añade el calendario de tu universidad, de Google o de Outlook para verlo junto a tus
          tareas. Solo se lee: FarmHabit no cambia nada en él.
        </p>
      )}

      <div className="space-y-3 rounded-xl bg-fondo p-4">
        <p className="text-sm font-semibold">Añadir calendario</p>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'url', label: '🔗 Suscribirse a un enlace' },
            { value: 'file', label: '📄 Importar archivo .ics' },
          ]}
        />
        <Field label="Nombre">
          <Input
            placeholder="Universidad, Trabajo…"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {mode === 'url' && (
          <Field
            label="Enlace iCal"
            hint="Empieza por https:// o webcal://. Se actualiza solo cada pocas horas."
          >
            <Input
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        )}
        {mode === 'file' && (
          <p className="text-xs text-texto-suave">
            Un archivo importado es una foto fija: si el calendario cambia, vuelve a importarlo o
            usa un enlace.
          </p>
        )}
        <div className="flex gap-2">
          {CALENDAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={cx(
                'size-7 rounded-full transition',
                color === c && 'ring-2 ring-texto ring-offset-2 ring-offset-fondo',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
        {mode === 'url' ? (
          <Button variant="primary" onClick={addUrl} disabled={!url.trim() || busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}{' '}
            Suscribirse
          </Button>
        ) : (
          <Button variant="primary" onClick={importFile}>
            <FileUp size={16} /> Elegir archivo .ics
          </Button>
        )}
        {error && (
          <p className="rounded-xl bg-peligro/10 px-3 py-2 text-sm text-peligro">{error}</p>
        )}
      </div>
    </Dialog>
  );
}
