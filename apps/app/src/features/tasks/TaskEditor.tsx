import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  addDays,
  toRRule,
  type LocalDate,
  type Priority,
  type SimpleRecurrence,
  type Task,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { formatOffset, WEEKDAYS } from '../../lib/format';
import { describeRecurrence, parseRRule } from '../../lib/recurrence-ui';
import {
  Button,
  Chip,
  Dialog,
  Field,
  Input,
  Segmented,
  Select,
  Textarea,
} from '../../components/ui';
import { PRIORITIES, REMINDER_PRESETS, TAG_COLORS } from './task-meta';

type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

interface Draft {
  title: string;
  notes: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  repeat: RepeatKind;
  interval: number;
  weekdays: number[];
  monthDay: number;
  customRule: string | null;
  reminders: number[];
  tagIds: string[];
}

function toDraft(task: Task | null, defaultDate: LocalDate | null): Draft {
  const rec = parseRRule(task?.rrule ?? null);
  return {
    title: task?.title ?? '',
    notes: task?.notes ?? '',
    priority: task?.priority ?? 2,
    dueDate: task?.dueDate ?? defaultDate ?? '',
    dueTime: task?.dueTime ?? '',
    repeat: rec === null ? 'none' : rec === 'custom' ? 'custom' : rec.freq,
    interval: rec && rec !== 'custom' ? (rec.interval ?? 1) : 1,
    weekdays: rec && rec !== 'custom' && rec.freq === 'weekly' ? rec.weekdays : [],
    monthDay: rec && rec !== 'custom' && rec.freq === 'monthly' ? rec.monthDay : 1,
    customRule: rec === 'custom' ? (task?.rrule ?? null) : null,
    reminders: task?.reminders.map((r) => r.offsetMin) ?? [],
    tagIds: task?.tagIds ?? [],
  };
}

function draftRecurrence(d: Draft, dueDate: string): SimpleRecurrence | null {
  const interval = Math.max(1, d.interval || 1);
  switch (d.repeat) {
    case 'daily':
      return { freq: 'daily', interval };
    case 'weekly': {
      // Sin días elegidos: el mismo día de la semana que la fecha límite.
      const day = new Date(`${dueDate}T12:00:00Z`).getUTCDay() || 7;
      return { freq: 'weekly', interval, weekdays: d.weekdays.length ? d.weekdays : [day] };
    }
    case 'monthly':
      return { freq: 'monthly', interval, monthDay: d.monthDay };
    case 'yearly':
      return { freq: 'yearly', interval };
    default:
      return null;
  }
}

export function TaskEditor({
  open,
  task,
  defaultDate = null,
  onClose,
}: {
  open: boolean;
  task: Task | null;
  defaultDate?: LocalDate | null;
  onClose: () => void;
}) {
  const { data, mutate, today } = useApp();
  const [draft, setDraft] = useState<Draft>(() => toDraft(task, defaultDate));
  const [newTag, setNewTag] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleIn = (list: number[], v: number) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const needsDate = draft.repeat !== 'none' || draft.reminders.length > 0;

  const save = async () => {
    const dueDate = draft.dueDate || (needsDate ? today : '');
    const rec = draftRecurrence(draft, dueDate);
    const fields = {
      title: draft.title.trim(),
      notes: draft.notes,
      priority: draft.priority,
      dueDate: dueDate || null,
      dueTime: dueDate && draft.dueTime ? draft.dueTime : null,
      rrule: draft.repeat === 'custom' ? draft.customRule : rec ? toRRule(rec) : null,
      reminders: dueDate
        ? [...new Set(draft.reminders)].sort((a, b) => b - a).map((offsetMin) => ({ offsetMin }))
        : [],
      tagIds: draft.tagIds,
    };
    if (!fields.title) return;
    const ok = await mutate((db) =>
      task
        ? db.repo('tasks').update(task.id, fields)
        : db.repo('tasks').create({ ...fields, status: 'pending', completedAt: null }),
    );
    if (ok) onClose();
  };

  const remove = async () => {
    if (!task) return;
    await mutate((db) => db.repo('tasks').remove(task.id));
    onClose();
  };

  const addTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    const existing = data.tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const tag =
      existing ??
      (await mutate((db) =>
        db.repo('tags').create({ name, color: TAG_COLORS[data.tags.length % TAG_COLORS.length]! }),
      ));
    if (tag) set('tagIds', [...new Set([...draft.tagIds, tag.id])]);
    setNewTag('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      footer={
        <>
          {task && (
            <Button variant="danger" onClick={remove} className="mr-auto">
              <Trash2 size={16} /> Borrar
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!draft.title.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        placeholder="¿Qué tienes que hacer?"
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && void save()}
        className="text-base"
        aria-label="Título"
      />
      <Textarea
        placeholder="Notas (opcional)"
        value={draft.notes}
        onChange={(e) => set('notes', e.target.value)}
        aria-label="Notas"
      />

      <Field label="Prioridad">
        <Segmented
          value={String(draft.priority)}
          onChange={(v) => set('priority', Number(v) as Priority)}
          options={PRIORITIES.map((p) => ({
            value: String(p.value),
            label: (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </span>
            ),
          }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha límite">
          <Input
            type="date"
            value={draft.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
        </Field>
        <Field label="Hora (opcional)">
          <Input
            type="time"
            value={draft.dueTime}
            disabled={!draft.dueDate}
            onChange={(e) => set('dueTime', e.target.value)}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip active={draft.dueDate === today} onClick={() => set('dueDate', today)}>
          Hoy
        </Chip>
        <Chip
          active={draft.dueDate === addDays(today, 1)}
          onClick={() => set('dueDate', addDays(today, 1))}
        >
          Mañana
        </Chip>
        {draft.dueDate && (
          <Chip onClick={() => setDraft((d) => ({ ...d, dueDate: '', dueTime: '' }))}>
            Sin fecha
          </Chip>
        )}
      </div>

      <Field label="Repetir">
        <Select value={draft.repeat} onChange={(e) => set('repeat', e.target.value as RepeatKind)}>
          <option value="none">No se repite</option>
          <option value="daily">Cada día / cada N días</option>
          <option value="weekly">Cada semana</option>
          <option value="monthly">Cada mes</option>
          <option value="yearly">Cada año</option>
          {draft.customRule && <option value="custom">{describeRecurrence('custom')}</option>}
        </Select>
      </Field>
      {draft.repeat !== 'none' && draft.repeat !== 'custom' && (
        <div className="space-y-3 rounded-xl bg-fondo p-3">
          <label className="flex items-center gap-2 text-sm">
            Cada
            <Input
              type="number"
              min={1}
              max={99}
              value={draft.interval}
              onChange={(e) => set('interval', Number(e.target.value))}
              className="w-20"
            />
            {
              { daily: 'día(s)', weekly: 'semana(s)', monthly: 'mes(es)', yearly: 'año(s)' }[
                draft.repeat
              ]
            }
          </label>
          {draft.repeat === 'weekly' && (
            <div className="flex gap-1.5">
              {WEEKDAYS.map((w) => (
                <Chip
                  key={w.iso}
                  active={draft.weekdays.includes(w.iso)}
                  onClick={() => set('weekdays', toggleIn(draft.weekdays, w.iso))}
                  title={w.name}
                  className="size-9 justify-center px-0"
                >
                  {w.short}
                </Chip>
              ))}
            </div>
          )}
          {draft.repeat === 'monthly' && (
            <Select
              value={draft.monthDay}
              onChange={(e) => set('monthDay', Number(e.target.value))}
            >
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  El día {i + 1}
                </option>
              ))}
              <option value={-1}>El último día del mes</option>
            </Select>
          )}
        </div>
      )}

      <Field
        label="Avisos"
        hint={
          !draft.dueDate
            ? 'Sin fecha se usará la de hoy.'
            : !draft.dueTime
              ? 'Sin hora, los avisos toman como referencia las 9:00.'
              : undefined
        }
      >
        <div className="flex flex-wrap gap-2">
          {REMINDER_PRESETS.map((m) => (
            <Chip
              key={m}
              active={draft.reminders.includes(m)}
              onClick={() => set('reminders', toggleIn(draft.reminders, m))}
            >
              {formatOffset(m)}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Etiquetas">
        <div className="flex flex-wrap gap-2">
          {data.tags.map((t) => (
            <Chip
              key={t.id}
              active={draft.tagIds.includes(t.id)}
              onClick={() =>
                set(
                  'tagIds',
                  draft.tagIds.includes(t.id)
                    ? draft.tagIds.filter((x) => x !== t.id)
                    : [...draft.tagIds, t.id],
                )
              }
            >
              <span className="size-2 rounded-full" style={{ background: t.color }} />
              {t.name}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            placeholder="Nueva etiqueta"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addTag();
              }
            }}
          />
          <Button onClick={addTag} disabled={!newTag.trim()}>
            <Plus size={16} /> Añadir
          </Button>
        </div>
      </Field>
    </Dialog>
  );
}
