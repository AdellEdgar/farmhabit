import { useState } from 'react';
import { Archive, Plus, Trash2, X } from 'lucide-react';
import {
  changeHabitConfig,
  createHabit,
  currentConfig,
  type Habit,
  type HabitConfig,
  type HabitReminder,
  type HabitSchedule,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { WEEKDAYS } from '../../lib/format';
import { cx } from '../../lib/cx';
import {
  Button,
  Chip,
  Dialog,
  Field,
  IconButton,
  Input,
  Segmented,
  Select,
  Textarea,
} from '../../components/ui';
import {
  EFFORT_LABELS,
  HABIT_COLORS,
  HABIT_ICONS,
  penaltyFor,
  rewardFor,
  sameConfig,
} from './habit-meta';

type ScheduleType = HabitSchedule['type'];

export function HabitEditor({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const { mutate, today, now } = useApp();
  const cfg = habit ? currentConfig(habit) : null;

  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [icon, setIcon] = useState(habit?.icon || HABIT_ICONS[0]!);
  const [color, setColor] = useState(habit?.color || HABIT_COLORS[0]!);
  const [effort, setEffort] = useState(cfg?.effort ?? 3);
  const [type, setType] = useState<ScheduleType>(cfg?.schedule.type ?? 'daily');
  const [days, setDays] = useState<number[]>(
    cfg?.schedule.type === 'weekdays' ? cfg.schedule.days : [1, 2, 3, 4, 5],
  );
  const [times, setTimes] = useState(
    cfg?.schedule.type === 'timesPerWeek' || cfg?.schedule.type === 'timesPerMonth'
      ? cfg.schedule.times
      : 3,
  );
  const [everyN, setEveryN] = useState(
    cfg?.schedule.type === 'everyNDays' ? cfg.schedule.interval : 2,
  );
  const [hasTarget, setHasTarget] = useState(!!cfg?.target);
  const [quantity, setQuantity] = useState(cfg?.target ? String(cfg.target.quantity) : '');
  const [unit, setUnit] = useState(cfg?.target?.unit ?? '');
  const [reminders, setReminders] = useState<HabitReminder[]>(habit?.reminders ?? []);
  const [startDate, setStartDate] = useState(habit?.startDate ?? today);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const schedule = (): HabitSchedule => {
    switch (type) {
      case 'daily':
        return { type };
      case 'weekdays':
        return { type, days: days.length ? [...days].sort() : [1] };
      case 'timesPerWeek':
        return { type, times: Math.min(7, Math.max(1, times)) };
      case 'timesPerMonth':
        return { type, times: Math.min(31, Math.max(1, times)) };
      case 'everyNDays':
        return { type, interval: Math.min(365, Math.max(2, everyN)) };
    }
  };

  const target = (): HabitConfig['target'] => {
    const q = Number(quantity.replace(',', '.'));
    return hasTarget && q > 0 ? { quantity: q, unit: unit.trim() } : null;
  };

  const save = async () => {
    if (!name.trim()) return;
    const config = { effort, schedule: schedule(), target: target() };
    const base = { name: name.trim(), description, icon, color, reminders };
    const ok = await mutate(async (db) => {
      if (!habit) return createHabit(db, { ...base, startDate, config });
      const updated = await db.repo('habits').update(habit.id, base);
      return sameConfig(currentConfig(habit), config)
        ? updated
        : changeHabitConfig(db, habit.id, config, today);
    });
    if (ok) onClose();
  };

  const archive = async () => {
    if (!habit) return;
    await mutate((db) =>
      db.repo('habits').update(habit.id, { archivedAt: habit.archivedAt ? null : now }),
    );
    onClose();
  };

  const remove = async () => {
    if (!habit) return;
    await mutate((db) => db.repo('habits').remove(habit.id));
    onClose();
  };

  const configChanged =
    habit && cfg && !sameConfig(cfg, { effort, schedule: schedule(), target: target() });

  return (
    <Dialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title={habit ? 'Editar hábito' : 'Nuevo hábito'}
      footer={
        <>
          {habit && (
            <div className="mr-auto flex gap-2">
              <Button variant="ghost" onClick={archive}>
                <Archive size={16} /> {habit.archivedAt ? 'Reactivar' : 'Archivar'}
              </Button>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={16} /> Borrar
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      {confirmDelete ? (
        <div className="space-y-3 rounded-xl bg-peligro/10 p-4 text-sm">
          <p className="font-medium text-peligro">¿Borrar «{habit?.name}»?</p>
          <p className="text-texto-suave">
            Desaparecerá de tu lista, pero las penalizaciones de los días ya cerrados se mantienen
            en la granja. Si solo quieres dejarlo por un tiempo, mejor archívalo.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={remove}>
              Sí, borrar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              No
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-xl text-2xl"
          style={{ background: `${color}26` }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <Input
          autoFocus
          placeholder="Nombre del hábito"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-base"
          aria-label="Nombre"
        />
      </div>

      <Field label="Icono y color">
        <div className="flex flex-wrap gap-1.5">
          {HABIT_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              aria-label={`Icono ${i}`}
              aria-pressed={icon === i}
              className={cx(
                'grid size-9 place-items-center rounded-lg text-lg transition',
                icon === i ? 'bg-acento-suave ring-2 ring-acento' : 'hover:bg-elevado',
              )}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {HABIT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              className={cx(
                'size-7 rounded-full transition',
                color === c && 'ring-2 ring-texto ring-offset-2 ring-offset-superficie',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </Field>

      <Field
        label="Importancia para tu granja"
        hint={
          <>
            Si lo haces: <b className="text-acento">+{rewardFor(effort)}</b> puntos. Si no:{' '}
            <b className="text-peligro">−{penaltyFor(effort)}</b>. Fallar un hábito fácil penaliza
            más.
          </>
        }
      >
        <Segmented
          value={String(effort)}
          onChange={(v) => setEffort(Number(v))}
          className="flex w-full [&>button]:flex-1"
          options={[1, 2, 3, 4, 5].map((e) => ({ value: String(e), label: EFFORT_LABELS[e] }))}
        />
      </Field>

      <Field label="Frecuencia">
        <Select value={type} onChange={(e) => setType(e.target.value as ScheduleType)}>
          <option value="daily">Cada día</option>
          <option value="weekdays">Días concretos de la semana</option>
          <option value="timesPerWeek">Varias veces por semana</option>
          <option value="timesPerMonth">Varias veces al mes</option>
          <option value="everyNDays">Cada N días</option>
        </Select>
      </Field>
      {type === 'weekdays' && (
        <div className="flex gap-1.5">
          {WEEKDAYS.map((w) => (
            <Chip
              key={w.iso}
              title={w.name}
              active={days.includes(w.iso)}
              onClick={() =>
                setDays(days.includes(w.iso) ? days.filter((d) => d !== w.iso) : [...days, w.iso])
              }
              className="size-9 justify-center px-0"
            >
              {w.short}
            </Chip>
          ))}
        </div>
      )}
      {(type === 'timesPerWeek' || type === 'timesPerMonth') && (
        <label className="flex items-center gap-2 text-sm">
          <Input
            type="number"
            min={1}
            max={type === 'timesPerWeek' ? 7 : 31}
            value={times}
            onChange={(e) => setTimes(Number(e.target.value))}
            className="w-20"
          />
          veces {type === 'timesPerWeek' ? 'por semana' : 'al mes'}
        </label>
      )}
      {type === 'everyNDays' && (
        <label className="flex items-center gap-2 text-sm">
          Cada
          <Input
            type="number"
            min={2}
            max={365}
            value={everyN}
            onChange={(e) => setEveryN(Number(e.target.value))}
            className="w-20"
          />
          días
        </label>
      )}

      <Field label="Objetivo de cantidad (opcional)">
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasTarget}
            onChange={(e) => setHasTarget(e.target.checked)}
            className="size-4 accent-[var(--fh-acento)]"
          />
          Medir una cantidad (p. ej. 2 L de agua, 8000 pasos)
        </label>
        {hasTarget && (
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              placeholder="Cantidad"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-32"
              aria-label="Cantidad objetivo"
            />
            <Input
              placeholder="Unidad (L, pasos, min…)"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Unidad"
            />
          </div>
        )}
      </Field>

      <Field label="Recordatorios">
        <div className="space-y-2">
          {reminders.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-fondo p-2">
              <Input
                type="time"
                value={r.time}
                onChange={(e) =>
                  setReminders(
                    reminders.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)),
                  )
                }
                className="w-28"
                aria-label="Hora"
              />
              <div className="flex gap-1">
                {WEEKDAYS.map((w) => (
                  <Chip
                    key={w.iso}
                    title={w.name}
                    active={r.days.length === 0 || r.days.includes(w.iso)}
                    onClick={() => {
                      const all = r.days.length === 0 ? WEEKDAYS.map((x) => x.iso) : r.days;
                      const next = all.includes(w.iso)
                        ? all.filter((d) => d !== w.iso)
                        : [...all, w.iso];
                      setReminders(
                        reminders.map((x, j) =>
                          j === i ? { ...x, days: next.length === 7 ? [] : next.sort() } : x,
                        ),
                      );
                    }}
                    className="size-7 justify-center px-0 text-[11px]"
                  >
                    {w.short}
                  </Chip>
                ))}
              </div>
              <IconButton
                label="Quitar recordatorio"
                onClick={() => setReminders(reminders.filter((_, j) => j !== i))}
                className="ml-auto"
              >
                <X size={16} />
              </IconButton>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() => setReminders([...reminders, { time: '21:00', days: [] }])}
          >
            <Plus size={16} /> Añadir recordatorio
          </Button>
          <p className="text-xs text-texto-suave">Los avisos se activarán en la Fase 3.</p>
        </div>
      </Field>

      <Textarea
        placeholder="Descripción o motivación (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        aria-label="Descripción"
      />

      {!habit && (
        <Field
          label="Empieza el"
          hint="Los primeros 7 días no cuentan para recuperar el bienestar de la granja."
        >
          <Input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => setStartDate(e.target.value || today)}
            className="w-44"
          />
        </Field>
      )}
      {configChanged && (
        <p className="rounded-xl bg-info/10 p-3 text-sm text-info">
          Los cambios de importancia, frecuencia u objetivo se aplican a partir de mañana: el pasado
          no se reescribe.
        </p>
      )}
    </Dialog>
  );
}
