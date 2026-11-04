import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, startOfWeek } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Button, Card, EmptyState } from '../../components/ui';
import { weekRange } from './creature-meta';
import { WeekSummaryContent } from './WeekSummary';

/** Pestaña Semana: el resumen de cada semana, con flechas. Arranca en la anterior. */
export function WeekTab() {
  const { game } = useApp();
  const weeks = Object.keys(game.weeks).sort();
  const previous = addDays(startOfWeek(game.today), -7);
  const [picked, setPicked] = useState<string | null>(null);

  if (weeks.length === 0) {
    return (
      <EmptyState icon="📅" title="Aún no hay semanas">
        Cuando hagas tus hábitos y tareas, aquí verás cómo te ha ido.
      </EmptyState>
    );
  }
  const week =
    picked && weeks.includes(picked) ? picked : weeks.includes(previous) ? previous : weeks.at(-1)!;
  const index = weeks.indexOf(week);
  const isCurrent = week === startOfWeek(game.today);

  return (
    <Card className="mx-auto max-w-xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          aria-label="Semana anterior"
          disabled={index === 0}
          onClick={() => setPicked(weeks[index - 1]!)}
        >
          <ChevronLeft size={18} />
        </Button>
        <div className="text-center">
          <p className="font-semibold">{weekRange(week)}</p>
          {isCurrent && <p className="text-xs text-texto-suave">Esta semana, aún en curso</p>}
        </div>
        <Button
          variant="ghost"
          aria-label="Semana siguiente"
          disabled={index === weeks.length - 1}
          onClick={() => setPicked(weeks[index + 1]!)}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      <WeekSummaryContent week={game.weeks[week]!} />
    </Card>
  );
}
