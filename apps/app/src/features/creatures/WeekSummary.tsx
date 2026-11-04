import { useEffect, useState } from 'react';
import {
  addDays,
  pickPhrase,
  startOfWeek,
  summaryToShow,
  type LocalDate,
  type WeekStats,
} from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { Button } from '../../components/ui';
import { CreatureImage } from './CreatureImage';
import { weekRange } from './creature-meta';
import { SpeechBubble } from './SpeechBubble';

/** Última semana resumida en este dispositivo (meta local, no se sincroniza). */
const SEEN_META = 'summary:seen';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-fondo px-3 py-2 text-center">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-texto-suave">{label}</p>
    </div>
  );
}

/** Lo que ocurrió en una semana: se usa en la pantalla completa y en la pestaña Semana. */
export function WeekSummaryContent({ week: w }: { week: WeekStats }) {
  const { game } = useApp();
  const star = game.creatures.find((c) => c.habitId === w.topHabitId);
  const percent = w.scheduled > 0 ? Math.round((w.done / w.scheduled) * 100) : 0;

  return (
    <div className="space-y-4">
      {star && star.stage > 0 && (
        <div className="flex items-center gap-3">
          <CreatureImage species={star.species} stage={star.stage} px={88} aura={star.aura} />
          <div className="min-w-0 space-y-1">
            <p className="text-xs text-texto-suave">Criatura estrella</p>
            <p className="truncate font-semibold">{star.name}</p>
            <SpeechBubble text={pickPhrase(star.species, 'feliz', `${star.habitId}|${w.week}`)} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="XP" value={w.xp} />
        <Stat label="Días perfectos" value={w.perfectDays} />
        <Stat label="Hábitos" value={`${percent} %`} />
        <Stat label="Tareas" value={w.tasksDone} />
        <Stat label="Mejor racha" value={w.bestStreak} />
        <Stat label="Misiones" value={w.missionsDone} />
        <Stat label="Nacimientos" value={w.hatched} />
        <Stat label="Evoluciones" value={w.evolved} />
        <Stat label="Retrocesos" value={w.demoted} />
      </div>
    </div>
  );
}

/**
 * Resumen a pantalla completa, una vez por dispositivo, la primera vez que se
 * abre la app en la semana. Queda debajo de las celebraciones. La primera vez
 * solo apunta la semana, para no sacar nada nada más actualizar.
 */
export function WeekSummaryOverlay() {
  const { db, game } = useApp();
  const [week, setWeek] = useState<LocalDate | null>(null);
  const today = game.today;

  useEffect(() => {
    void (async () => {
      const seen = await db.getMeta(SEEN_META);
      const toShow = summaryToShow(game, seen);
      if (toShow) setWeek(toShow);
      if (seen === null) await db.setMeta(SEEN_META, addDays(startOfWeek(today), -7));
    })();
    // Solo hace falta volver a mirar cuando cambia el día.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, today]);

  const stats = week ? game.weeks[week] : undefined;
  if (!week || !stats) return null;
  const close = () => {
    void db.setMeta(SEEN_META, week);
    setWeek(null);
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/70 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Resumen de la semana"
    >
      <div className="celebrate-pop w-full max-w-md space-y-4 rounded-3xl border border-borde bg-superficie p-6 shadow-2xl">
        <div>
          <p className="text-2xl font-bold">Tu semana</p>
          <p className="text-sm text-texto-suave">{weekRange(week)}</p>
        </div>
        <WeekSummaryContent week={stats} />
        <Button variant="primary" autoFocus onClick={close} className="w-full justify-center">
          ¡A por la siguiente!
        </Button>
      </div>
    </div>
  );
}
