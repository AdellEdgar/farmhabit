import { AlertTriangle, Heart, Sparkles, Wheat } from 'lucide-react';
import { DEFAULT_RULES, type FarmState } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { Card, ProgressBar } from '../../components/ui';
import { SPECIES_EMOJI, wellbeingColor, wellbeingLabel } from './farm-meta';

/** Tarjeta con el estado de la granja: bienestar, nivel, grano y alertas. */
export function FarmSummary({ farm, onOpen }: { farm: FarmState; onOpen?: () => void }) {
  const alive = farm.animals.filter((a) => a.diedOn === null);
  const levelStart = DEFAULT_RULES.xpForLevel(farm.level);
  const levelEnd = DEFAULT_RULES.xpForLevel(farm.level + 1);
  const levelPct = ((farm.xp - levelStart) / (levelEnd - levelStart)) * 100;

  return (
    <Card className="overflow-hidden">
      {farm.deathWarning && (
        <div className="flex items-start gap-3 bg-peligro/15 px-4 py-3 text-sm text-peligro">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            <b>{farm.deathWarning.name}</b> está muy enfermo.{' '}
            {farm.deathWarning.daysLeft === 1
              ? 'Si hoy no cumples tus hábitos, morirá esta noche.'
              : `Le quedan ${farm.deathWarning.daysLeft} días malos antes de morir.`}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className="block w-full p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex -space-x-1 text-2xl" aria-hidden="true">
            {alive.length ? (
              alive.slice(0, 5).map((a) => <span key={a.id}>{SPECIES_EMOJI[a.species]}</span>)
            ) : (
              <span>🏡</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {alive.length ? wellbeingLabel(farm) : 'Tu granja está vacía'}
            </p>
            <p className="text-xs text-texto-suave">
              {alive.length
                ? `${alive.length} ${alive.length === 1 ? 'animal' : 'animales'}`
                : 'Adopta tu primer animal en Granja'}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-texto-suave">
              <span className="inline-flex items-center gap-1">
                <Heart size={13} /> Bienestar
              </span>
              <span className={cx('font-semibold', farm.sick && 'text-peligro')}>
                {farm.wellbeing}%
              </span>
            </div>
            <ProgressBar value={farm.wellbeing} color={wellbeingColor(farm.wellbeing)} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-texto-suave">
              <span className="inline-flex items-center gap-1">
                <Sparkles size={13} /> Nivel {farm.level}
              </span>
              <span>
                {farm.xp} / {levelEnd} XP
              </span>
            </div>
            <ProgressBar value={levelPct} color="bg-info" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5 text-grano">
              <Wheat size={15} /> {farm.grain} de grano
            </span>
            {farm.todayProgress.earned > 0 && (
              <span className="text-acento">+{farm.todayProgress.earned} hoy</span>
            )}
          </div>
        </div>
      </button>
    </Card>
  );
}
