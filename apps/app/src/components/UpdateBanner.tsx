import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../lib/use-app';
import { getFlag, PREF_KEYS } from '../lib/platform';
import { canUpdate, checkForUpdate, installUpdate, useUpdateState } from '../lib/updates';
import { ProgressBar } from './ui';

/**
 * Primera comprobación poco después de abrir (para no frenar el arranque),
 * luego dos veces al día y al volver a la app. Android no cierra la app al
 * salir de ella, solo la congela: sin lo último no se enteraría hasta 12 h
 * después. Al volver se comprueba como mucho una vez por hora.
 */
const FIRST_CHECK_MS = 8_000;
const CHECK_EVERY_MS = 12 * 3_600_000;
const MIN_GAP_MS = 3_600_000;

/** Aviso arriba de la app cuando hay una versión nueva. */
export function UpdateBanner() {
  const { db } = useApp();
  const update = useUpdateState();
  // "Más tarde" oculta el aviso de esa versión hasta que se vuelva a abrir la app.
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!canUpdate) return;
    let last = 0;
    const tick = async () => {
      if (Date.now() - last < MIN_GAP_MS) return;
      if (!(await getFlag(db, PREF_KEYS.autoUpdateCheck, true))) return;
      last = Date.now();
      await checkForUpdate({ quiet: true });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    const first = setTimeout(() => void tick(), FIRST_CHECK_MS);
    const interval = setInterval(() => void tick(), CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [db]);

  if (update.status === 'installing') {
    return (
      <div className="border-b border-borde bg-acento-suave px-4 py-2 text-sm">
        <p>
          Descargando FarmHabit {update.update.version}
          {update.progress !== null && ` (${Math.round(update.progress * 100)} %)`}… La app se
          reiniciará sola.
        </p>
        <ProgressBar value={(update.progress ?? 0) * 100} className="mt-1.5" />
      </div>
    );
  }

  const available =
    update.status === 'available' || update.status === 'error' ? update.update : undefined;
  if (!available || available.version === dismissed) return null;
  const mobile = available.install === null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-borde bg-acento-suave px-4 py-2 text-center text-sm">
      <span>
        {update.status === 'error' ? (
          <span className="text-peligro">{update.message}</span>
        ) : (
          <>
            🐔 <b>FarmHabit {available.version}</b> ya está disponible.
          </>
        )}
      </span>
      <button
        type="button"
        onClick={() => void installUpdate()}
        className="inline-flex items-center gap-1 font-semibold text-acento hover:underline"
      >
        <Download size={14} />{' '}
        {mobile ? 'Descargar' : update.status === 'error' ? 'Reintentar' : 'Actualizar y reiniciar'}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(available.version)}
        className="text-texto-suave hover:text-texto"
      >
        Más tarde
      </button>
    </div>
  );
}
