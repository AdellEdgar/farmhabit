import type { Priority } from '@farmhabit/core';
import { cx } from '../../lib/cx';
import { priorityMeta } from './task-meta';

/** Alturas de las tres barras, de la más baja a la más alta. */
const HEIGHTS = ['40%', '70%', '100%'];

/**
 * Prioridad como el icono de cobertura del móvil: baja llena la primera barra
 * en verde, media las dos primeras en amarillo y alta las tres en rojo.
 */
export function PriorityBars({ priority, className }: { priority: Priority; className?: string }) {
  const meta = priorityMeta(priority);
  return (
    <span
      role="img"
      aria-label={`Prioridad ${meta.label.toLowerCase()}`}
      title={`Prioridad ${meta.label.toLowerCase()}`}
      className={cx('inline-flex h-4 shrink-0 items-end gap-[2px]', className)}
    >
      {HEIGHTS.map((height, i) => (
        <span
          key={height}
          className="w-[5px] rounded-[1px]"
          style={{ height, background: i < meta.bars ? meta.color : 'var(--fh-borde)' }}
        />
      ))}
    </span>
  );
}
