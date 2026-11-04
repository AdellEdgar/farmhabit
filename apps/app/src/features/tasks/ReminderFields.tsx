import type { ReactNode } from 'react';
import { formatOffset } from '../../lib/format';
import { Chip, Field } from '../../components/ui';
import { REMINDER_PRESETS } from './task-meta';

/** Avisos antes de una tarea o un evento, compartido por los dos editores. */
export function ReminderFields({
  value,
  onChange,
  hint,
}: {
  value: number[];
  onChange: (minutes: number[]) => void;
  hint?: ReactNode;
}) {
  const toggle = (m: number) =>
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m]);

  return (
    <Field label="Avisos" hint={hint}>
      <div className="flex flex-wrap gap-2">
        {REMINDER_PRESETS.map((m) => (
          <Chip key={m} active={value.includes(m)} onClick={() => toggle(m)}>
            {formatOffset(m)}
          </Chip>
        ))}
      </div>
    </Field>
  );
}
