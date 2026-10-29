import { useState } from 'react';
import { Palmtree } from 'lucide-react';
import { addDays, endVacation, MAX_VACATION_DAYS, scheduleVacation } from '@farmhabit/core';
import { formatRelativeDate } from '../../lib/format';
import { useApp } from '../../lib/use-app';
import { Button, Card, Field, Input } from '../../components/ui';

export function VacationCard() {
  const { data, today, mutate } = useApp();
  const tomorrow = addDays(today, 1);
  const [start, setStart] = useState(tomorrow);
  const [end, setEnd] = useState(addDays(today, 7));
  const [open, setOpen] = useState(false);

  const upcoming = data.vacations
    .filter((v) => v.endDate >= today)
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1));

  const save = async () => {
    const ok = await mutate((db) => scheduleVacation(db, start, end, today));
    if (ok) setOpen(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info/15 text-info">
          <Palmtree size={20} />
        </span>
        <div className="flex-1">
          <h2 className="font-semibold">Modo vacaciones</h2>
          <p className="text-sm text-texto-suave">
            ¿Te vas de viaje o vas a estar enfermo? Pausa las penalizaciones. Hay que programarlo
            antes de que empiece.
          </p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <ul className="mt-3 space-y-2">
          {upcoming.map((v) => {
            const active = v.startDate <= today;
            return (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-fondo px-3 py-2 text-sm"
              >
                <span>
                  {active
                    ? '🏖️ De vacaciones hasta '
                    : `Del ${formatRelativeDate(v.startDate, today).toLowerCase()} al `}
                  {formatRelativeDate(v.endDate, today).toLowerCase()}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => mutate((db) => endVacation(db, v.id, today))}
                >
                  {active ? 'Terminar' : 'Cancelar'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <div className="mt-3 space-y-3 rounded-xl bg-fondo p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde">
              <Input
                type="date"
                min={tomorrow}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Hasta">
              <Input
                type="date"
                min={start}
                max={addDays(start, MAX_VACATION_DAYS - 1)}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={save}>
              Programar
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button className="mt-3" onClick={() => setOpen(true)}>
          Programar vacaciones
        </Button>
      )}
    </Card>
  );
}
