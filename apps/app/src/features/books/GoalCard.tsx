import { useState } from 'react';
import { finishedIn, parseReadingGoal, readingGoalKey, setReadingGoal } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Button, Card, Input, ProgressBar } from '../../components/ui';

/** Reto anual de lectura. */
export function GoalCard() {
  const { data, mutate, today } = useApp();
  const year = Number(today.slice(0, 4));
  const key = readingGoalKey(year);
  const goal = parseReadingGoal(data.settings.find((s) => s.key === key)?.value);
  const read = finishedIn(data.books, year);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const save = async () => {
    const ok = await mutate(async (db) => {
      await setReadingGoal(db, year, Number(draft));
      return true;
    });
    if (ok) setEditing(false);
  };
  const edit = () => {
    setDraft(goal ? String(goal) : '12');
    setEditing(true);
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Reto de {year}</p>
        {editing ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              autoFocus
              type="number"
              min={1}
              max={999}
              aria-label="Libros del reto"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-20"
            />
            <span className="text-sm text-texto-suave">libros</span>
            <Button type="submit" variant="primary" disabled={Number(draft) < 1}>
              Guardar
            </Button>
          </form>
        ) : (
          <Button variant="ghost" onClick={edit}>
            {goal ? 'Cambiar' : 'Ponerte un reto'}
          </Button>
        )}
      </div>
      {goal ? (
        <>
          <ProgressBar value={Math.min(100, (read / goal) * 100)} className="mt-2" />
          <p className="mt-1 text-xs text-texto-suave tabular-nums">
            {read >= goal
              ? `¡Reto cumplido! ${read} de ${goal} libros`
              : `${read} de ${goal} libros`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-texto-suave">
          Llevas {read} {read === 1 ? 'libro' : 'libros'} este año.
        </p>
      )}
    </Card>
  );
}
