import { useState } from 'react';
import { CalendarPlus, Plus, Trash2 } from 'lucide-react';
import {
  addDays,
  addSubtask,
  deleteTask,
  taskToEvent,
  type LocalDate,
  type Priority,
  type Task,
} from '@farmhabit/core';
import { recurrenceDraft, recurrenceRule, type RecurrenceDraft } from '../../lib/recurrence-ui';
import { useApp } from '../../lib/use-app';
import { Button, Chip, Dialog, Field, Input, Segmented, Textarea } from '../../components/ui';
import { PriorityBars } from './PriorityBars';
import { RecurrenceFields } from './RecurrenceFields';
import { ReminderFields } from './ReminderFields';
import { SubtaskEditor } from './SubtaskEditor';
import { PRIORITIES, TAG_COLORS, toReminders } from './task-meta';

interface Draft {
  title: string;
  notes: string;
  priority: Priority;
  dueDate: string;
  dueTime: string;
  recurrence: RecurrenceDraft;
  reminders: number[];
  tagIds: string[];
  /** Subtareas de una tarea nueva: se crean al guardarla. */
  newSubtasks: string[];
}

function toDraft(task: Task | null, defaultDate: LocalDate | null): Draft {
  return {
    title: task?.title ?? '',
    notes: task?.notes ?? '',
    priority: task?.priority ?? 2,
    dueDate: task?.dueDate ?? defaultDate ?? '',
    dueTime: task?.dueTime ?? '',
    recurrence: recurrenceDraft(task?.rrule ?? null),
    reminders: task?.reminders.map((r) => r.offsetMin) ?? [],
    tagIds: task?.tagIds ?? [],
    newSubtasks: [],
  };
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
  const { data, mutate, today, toast } = useApp();
  const [draft, setDraft] = useState<Draft>(() => toDraft(task, defaultDate));
  const [newTag, setNewTag] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const [confirmConvert, setConfirmConvert] = useState(false);
  const subtaskCount = task
    ? data.subtasks.filter((s) => s.taskId === task.id && s.deletedAt === null).length
    : 0;

  const needsDate = draft.recurrence.repeat !== 'none' || draft.reminders.length > 0;

  const fieldsOf = () => {
    const dueDate = draft.dueDate || (needsDate ? today : '');
    return {
      title: draft.title.trim(),
      notes: draft.notes,
      priority: draft.priority,
      dueDate: dueDate || null,
      dueTime: dueDate && draft.dueTime ? draft.dueTime : null,
      rrule: recurrenceRule(draft.recurrence, dueDate),
      reminders: dueDate ? toReminders(draft.reminders) : [],
      tagIds: draft.tagIds,
    };
  };

  const save = async () => {
    const fields = fieldsOf();
    if (!fields.title) return;
    const ok = await mutate(async (db) => {
      if (task) return db.repo('tasks').update(task.id, fields);
      const created = await db
        .repo('tasks')
        .create({ ...fields, status: 'pending', completedAt: null });
      for (const title of draft.newSubtasks) await addSubtask(db, created.id, title);
      return created;
    });
    if (ok) onClose();
  };

  const remove = async () => {
    if (!task) return;
    await mutate((db) => deleteTask(db, task.id));
    onClose();
  };

  const convert = async () => {
    if (!task) return;
    if (subtaskCount > 0 && !confirmConvert) {
      setConfirmConvert(true);
      return;
    }
    // Primero lo que se haya cambiado en el editor, para no perderlo.
    const ok = await mutate(async (db) => {
      await db.repo('tasks').update(task.id, fieldsOf());
      return taskToEvent(db, task.id);
    });
    if (!ok) return;
    toast('Tarea convertida en evento');
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

      <Field label="Subtareas" hint="Al completarlas todas, la tarea se completa sola.">
        <SubtaskEditor
          taskId={task?.id ?? null}
          pending={draft.newSubtasks}
          onPendingChange={(titles) => set('newSubtasks', titles)}
        />
      </Field>

      <Field label="Prioridad">
        <Segmented
          value={String(draft.priority)}
          onChange={(v) => set('priority', Number(v) as Priority)}
          options={PRIORITIES.map((p) => ({
            value: String(p.value),
            label: (
              <span className="inline-flex items-center gap-1.5">
                <PriorityBars priority={p.value} />
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

      <RecurrenceFields
        value={draft.recurrence}
        onChange={(patch) => set('recurrence', { ...draft.recurrence, ...patch })}
      />

      <ReminderFields
        value={draft.reminders}
        onChange={(v) => set('reminders', v)}
        hint={
          !draft.dueDate
            ? 'Sin fecha se usará la de hoy.'
            : !draft.dueTime
              ? 'Sin hora, los avisos toman como referencia las 9:00.'
              : undefined
        }
      />

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
      {task && draft.dueDate && (
        <Button
          variant="ghost"
          onClick={() => void convert()}
          disabled={!draft.title.trim()}
          className="self-start"
        >
          <CalendarPlus size={16} />
          {confirmConvert
            ? 'Se perderán sus ' + subtaskCount + ' subtareas. ¿Convertir?'
            : 'Convertir en evento'}
        </Button>
      )}
    </Dialog>
  );
}
