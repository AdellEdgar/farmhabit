import { describeRecurrence, type RecurrenceDraft, type RepeatKind } from '../../lib/recurrence-ui';
import { WEEKDAYS } from '../../lib/format';
import { Chip, Field, Input, Select } from '../../components/ui';

/** Controles de repetición, compartidos por tareas y eventos. */
export function RecurrenceFields({
  value,
  onChange,
}: {
  value: RecurrenceDraft;
  onChange: (patch: Partial<RecurrenceDraft>) => void;
}) {
  const toggleDay = (iso: number) =>
    value.weekdays.includes(iso)
      ? value.weekdays.filter((x) => x !== iso)
      : [...value.weekdays, iso];

  return (
    <>
      <Field label="Repetir">
        <Select
          value={value.repeat}
          onChange={(e) => onChange({ repeat: e.target.value as RepeatKind })}
        >
          <option value="none">No se repite</option>
          <option value="daily">Cada día / cada N días</option>
          <option value="weekly">Cada semana</option>
          <option value="monthly">Cada mes</option>
          <option value="yearly">Cada año</option>
          {value.customRule && <option value="custom">{describeRecurrence('custom')}</option>}
        </Select>
      </Field>
      {value.repeat !== 'none' && value.repeat !== 'custom' && (
        <div className="space-y-3 rounded-xl bg-fondo p-3">
          <label className="flex items-center gap-2 text-sm">
            Cada
            <Input
              type="number"
              min={1}
              max={99}
              value={value.interval}
              onChange={(e) => onChange({ interval: Number(e.target.value) })}
              className="w-20"
            />
            {
              { daily: 'día(s)', weekly: 'semana(s)', monthly: 'mes(es)', yearly: 'año(s)' }[
                value.repeat
              ]
            }
          </label>
          {value.repeat === 'weekly' && (
            <div className="flex gap-1.5">
              {WEEKDAYS.map((w) => (
                <Chip
                  key={w.iso}
                  active={value.weekdays.includes(w.iso)}
                  onClick={() => onChange({ weekdays: toggleDay(w.iso) })}
                  title={w.name}
                  className="size-9 justify-center px-0"
                >
                  {w.short}
                </Chip>
              ))}
            </div>
          )}
          {value.repeat === 'monthly' && (
            <Select
              value={value.monthDay}
              onChange={(e) => onChange({ monthDay: Number(e.target.value) })}
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
    </>
  );
}
