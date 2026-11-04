import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  createEvent,
  deleteEvent,
  followStartDate,
  shiftEndDate,
  updateEvent,
  type CalendarEvent,
  type LocalDate,
} from '@farmhabit/core';
import { recurrenceDraft, recurrenceRule } from '../../lib/recurrence-ui';
import { useApp } from '../../lib/use-app';
import { Button, Dialog, Field, Input, Textarea, Toggle } from '../../components/ui';
import { RecurrenceFields } from '../tasks/RecurrenceFields';
import { ReminderFields } from '../tasks/ReminderFields';
import { toReminders } from '../tasks/task-meta';

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const timeOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Crear o editar un evento propio. Si se repite, los cambios afectan a toda la serie. */
export function EventEditor({
  event,
  defaultDate,
  onClose,
}: {
  event: CalendarEvent | null;
  defaultDate: LocalDate;
  onClose: () => void;
}) {
  const { mutate } = useApp();
  const [title, setTitle] = useState(event?.title ?? '');
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDate, setStartDate] = useState(event?.startDate ?? defaultDate);
  const [startTime, setStartTime] = useState(event?.startTime ?? '10:00');
  const [endDate, setEndDate] = useState(event?.endDate ?? defaultDate);
  const [endTime, setEndTime] = useState(event?.endTime ?? '11:00');
  const [location, setLocation] = useState(event?.location ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [recurrence, setRecurrence] = useState(() =>
    recurrenceDraft(event?.rrule ?? null, startDate),
  );
  const [reminders, setReminders] = useState(event?.reminders.map((r) => r.offsetMin) ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Al mover el inicio, el fin se mueve con él para mantener la duración.
  const moveStartDate = (next: string) => {
    setEndDate(shiftEndDate(startDate, next, endDate));
    setRecurrence(followStartDate(recurrence, startDate, next));
    setStartDate(next);
  };
  const moveStartTime = (next: string) => {
    if (next && startTime && endTime) {
      const end = minutesOf(endTime) + minutesOf(next) - minutesOf(startTime);
      setEndTime(timeOf(Math.max(0, Math.min(23 * 60 + 59, end))));
    }
    setStartTime(next);
  };

  const save = async () => {
    const fields = {
      title: title.trim(),
      location: location.trim(),
      description,
      allDay,
      startDate,
      startTime: allDay ? null : startTime,
      endDate,
      endTime: allDay ? null : endTime,
      rrule: recurrenceRule(recurrence, startDate),
      reminders: toReminders(reminders),
    };
    const ok = await mutate((db) =>
      event ? updateEvent(db, event.id, fields) : createEvent(db, fields),
    );
    if (ok) onClose();
  };

  const remove = async () => {
    if (!event) return;
    await mutate((db) => deleteEvent(db, event.id));
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={event ? 'Editar evento' : 'Nuevo evento'}
      footer={
        <>
          {event &&
            (confirmDelete ? (
              <Button variant="danger" onClick={() => void remove()} className="mr-auto">
                {event.rrule ? 'Sí, borrar toda la serie' : 'Sí, borrar'}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="mr-auto">
                <Trash2 size={16} /> Borrar
              </Button>
            ))}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!title.trim()}>
            Guardar
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        placeholder="Título del evento"
        value={title}
        maxLength={200}
        onChange={(e) => setTitle(e.target.value)}
        className="text-base"
        aria-label="Título"
      />

      <Toggle checked={allDay} onChange={setAllDay} label="Todo el día" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Empieza">
          <Input type="date" value={startDate} onChange={(e) => moveStartDate(e.target.value)} />
        </Field>
        {!allDay && (
          <Field label="Hora">
            <Input type="time" value={startTime} onChange={(e) => moveStartTime(e.target.value)} />
          </Field>
        )}
        <Field label="Termina">
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        {!allDay && (
          <Field label="Hora">
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        )}
      </div>

      <Field label="Lugar">
        <Input
          placeholder="Opcional"
          value={location}
          maxLength={200}
          onChange={(e) => setLocation(e.target.value)}
        />
      </Field>

      <RecurrenceFields
        value={recurrence}
        onChange={(p) => setRecurrence({ ...recurrence, ...p })}
      />

      <ReminderFields
        value={reminders}
        onChange={setReminders}
        hint={
          allDay ? 'En un evento de todo el día, los avisos cuentan desde las 9:00.' : undefined
        }
      />

      <Field label="Descripción">
        <Textarea
          placeholder="Opcional"
          rows={3}
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      {event?.rrule && (
        <p className="text-xs text-texto-suave">Los cambios afectan a toda la serie.</p>
      )}
    </Dialog>
  );
}
