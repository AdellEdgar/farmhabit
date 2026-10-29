import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { getSetting, newId, putSetting } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { allThemes, applyTheme, loadTheme, saveTheme, type ThemeChoice } from '../../lib/theme';
import {
  buildTheme,
  CUSTOM_THEMES_SETTING,
  parseCustomThemes,
  PRESET_THEMES,
  type CustomThemeInput,
  type Theme,
} from '../../lib/themes';
import { useApp } from '../../lib/use-app';
import { Button, Card, Dialog, Field, Input, Segmented } from '../../components/ui';

/** Muestra de un tema: fondo, tarjeta, texto y acento. */
function Swatch({ theme }: { theme: Theme }) {
  const c = theme.colors;
  return (
    <span
      className="flex h-12 w-full overflow-hidden rounded-lg border"
      style={{ background: c.fondo, borderColor: c.borde }}
      aria-hidden="true"
    >
      <span
        className="m-1.5 flex flex-1 flex-col justify-center gap-1 rounded-md px-2"
        style={{ background: c.superficie }}
      >
        <span className="h-1.5 w-3/4 rounded-full" style={{ background: c.texto }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: c.acento }} />
      </span>
    </span>
  );
}

export function AppearanceSettings() {
  const { db, data, mutate } = useApp();
  const [choice, setChoice] = useState<ThemeChoice>('oscuro');
  const [editing, setEditing] = useState<CustomThemeInput | null>(null);
  const themes = useMemo(() => allThemes(data.settings), [data.settings]);
  const presetIds = new Set(PRESET_THEMES.map((t) => t.id));
  const customIds = new Set(themes.filter((t) => !presetIds.has(t.id)).map((t) => t.id));

  useEffect(() => {
    void loadTheme(db).then(setChoice);
  }, [db]);

  const choose = (t: ThemeChoice) => {
    setChoice(t);
    void saveTheme(db, t, themes);
  };

  const saveCustom = async (input: CustomThemeInput) => {
    await mutate(async (d) => {
      const list = parseCustomThemes(await getSetting(d, CUSTOM_THEMES_SETTING));
      const next = list.some((t) => t.id === input.id)
        ? list.map((t) => (t.id === input.id ? input : t))
        : [...list, input];
      await putSetting(d, CUSTOM_THEMES_SETTING, JSON.stringify(next));
    });
    setEditing(null);
    choose(input.id);
  };

  const deleteCustom = async (id: string) => {
    await mutate(async (d) => {
      const list = parseCustomThemes(await getSetting(d, CUSTOM_THEMES_SETTING));
      await putSetting(d, CUSTOM_THEMES_SETTING, JSON.stringify(list.filter((t) => t.id !== id)));
    });
    setEditing(null);
    if (choice === id) choose('oscuro');
  };

  const editTheme = (t: Theme) => {
    const c = t.colors;
    setEditing({
      id: customIds.has(t.id) ? t.id : newId(),
      name: customIds.has(t.id) ? t.name : `${t.name} (mío)`,
      dark: t.dark,
      fondo: c.fondo,
      superficie: c.superficie,
      texto: c.texto,
      acento: c.acento,
    });
  };

  return (
    <Card className="p-5">
      <h2 className="mb-1 font-semibold">Apariencia</h2>
      <p className="mb-3 text-sm text-texto-suave">
        Elige un tema o crea el tuyo. Los temas que crees se sincronizan con tus otros dispositivos.
      </p>

      <div className="mb-3">
        <Segmented
          value={choice === 'sistema' ? 'sistema' : 'manual'}
          onChange={(v) => choose(v === 'sistema' ? 'sistema' : 'oscuro')}
          options={[
            { value: 'manual', label: '🎨 Elegir tema' },
            { value: 'sistema', label: '💻 Seguir al sistema' },
          ]}
        />
      </div>

      {choice !== 'sistema' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {themes.map((t) => (
            <div key={t.id} className="group relative">
              <button
                type="button"
                onClick={() => choose(t.id)}
                aria-pressed={choice === t.id}
                className={cx(
                  'flex w-full flex-col gap-1.5 rounded-xl border p-2 text-left text-sm transition',
                  choice === t.id
                    ? 'border-acento ring-2 ring-acento/40'
                    : 'border-borde hover:border-texto-suave',
                )}
              >
                <Swatch theme={t} />
                <span className="flex items-center justify-between gap-1 px-0.5">
                  <span className="truncate">{t.name}</span>
                  {choice === t.id && <Check size={14} className="text-acento" />}
                </span>
              </button>
              <button
                type="button"
                onClick={() => editTheme(t)}
                aria-label={
                  customIds.has(t.id) ? `Editar ${t.name}` : `Crear un tema a partir de ${t.name}`
                }
                title={customIds.has(t.id) ? 'Editar' : 'Personalizar a partir de este'}
                className="absolute top-3 right-3 grid size-6 place-items-center rounded-md bg-black/40 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <Pencil size={12} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => editTheme(themes.find((t) => t.id === choice) ?? themes[0]!)}
            className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-borde text-sm text-texto-suave hover:border-texto-suave hover:text-texto"
          >
            <Plus size={18} /> Crear tema
          </button>
        </div>
      )}

      {editing && (
        <ThemeEditor
          key={editing.id}
          initial={editing}
          isNew={!customIds.has(editing.id)}
          onCancel={() => {
            setEditing(null);
            applyTheme(choice, themes);
          }}
          onSave={saveCustom}
          onDelete={() => deleteCustom(editing.id)}
        />
      )}
    </Card>
  );
}

const COLOR_FIELDS: { key: 'fondo' | 'superficie' | 'texto' | 'acento'; label: string }[] = [
  { key: 'fondo', label: 'Fondo' },
  { key: 'superficie', label: 'Tarjetas' },
  { key: 'texto', label: 'Texto' },
  { key: 'acento', label: 'Acento' },
];

function ThemeEditor({
  initial,
  isNew,
  onCancel,
  onSave,
  onDelete,
}: {
  initial: CustomThemeInput;
  isNew: boolean;
  onCancel: () => void;
  onSave: (t: CustomThemeInput) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof CustomThemeInput>(k: K, v: CustomThemeInput[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  // Vista previa en directo mientras se edita.
  useEffect(() => {
    applyTheme(draft.id, [buildTheme(draft)]);
  }, [draft]);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      title={isNew ? 'Nuevo tema' : 'Editar tema'}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" onClick={onDelete} className="mr-auto">
              <Trash2 size={16} /> Borrar
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave({ ...draft, name: draft.name.trim() || 'Mi tema' })}
          >
            Guardar
          </Button>
        </>
      }
    >
      <p className="text-sm text-texto-suave">
        Los cambios se ven en directo. Los bordes y tonos intermedios se calculan solos.
      </p>
      <Field label="Nombre">
        <Input value={draft.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Tipo">
        <Segmented
          value={draft.dark ? 'oscuro' : 'claro'}
          onChange={(v) => set('dark', v === 'oscuro')}
          options={[
            { value: 'oscuro', label: '🌙 Oscuro' },
            { value: 'claro', label: '☀️ Claro' },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {COLOR_FIELDS.map((f) => (
          <label
            key={f.key}
            className="flex items-center gap-3 rounded-xl border border-borde p-2.5"
          >
            <input
              type="color"
              value={draft[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              className="size-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
              aria-label={f.label}
            />
            <span className="text-sm">
              {f.label}
              <span className="block font-mono text-xs text-texto-suave">{draft[f.key]}</span>
            </span>
          </label>
        ))}
      </div>
    </Dialog>
  );
}
