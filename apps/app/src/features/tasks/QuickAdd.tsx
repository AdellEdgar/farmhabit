import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { LocalDate } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';

/** Añadir una tarea escribiendo y pulsando Enter. */
export function QuickAdd({
  dueDate,
  placeholder = 'Añadir tarea…',
}: {
  dueDate: LocalDate | null;
  placeholder?: string;
}) {
  const { mutate } = useApp();
  const [title, setTitle] = useState('');

  const add = async () => {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    await mutate((db) =>
      db.repo('tasks').create({
        title: t,
        notes: '',
        priority: 2,
        status: 'pending',
        dueDate,
        dueTime: null,
        rrule: null,
        reminders: [],
        tagIds: [],
        completedAt: null,
      }),
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void add();
      }}
      className="flex items-center gap-3 rounded-xl border border-dashed border-borde px-3 py-2.5 focus-within:border-acento"
    >
      <Plus size={20} className="text-texto-suave" aria-hidden="true" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label="Nueva tarea"
        className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-texto-suave/80"
      />
    </form>
  );
}
