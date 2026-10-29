import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { useApp } from '../../lib/use-app';
import { getFlag, isMobileApp, PREF_KEYS, setFlag } from '../../lib/platform';
import { canUpdate, checkForUpdate, installUpdate, useUpdateState } from '../../lib/updates';
import { Button, Card, Toggle } from '../../components/ui';

export function UpdateSettings() {
  const { db } = useApp();
  const update = useUpdateState();
  const [autoCheck, setAutoCheck] = useState(true);

  useEffect(() => {
    void getFlag(db, PREF_KEYS.autoUpdateCheck, true).then(setAutoCheck);
  }, [db]);

  if (!canUpdate) return null;

  const toggleAutoCheck = async (v: boolean) => {
    setAutoCheck(v);
    await setFlag(db, PREF_KEYS.autoUpdateCheck, v);
  };

  const available =
    update.status === 'available' || update.status === 'error' ? update.update : undefined;

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Actualizaciones</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Tienes la versión {__APP_VERSION__}.{' '}
          {isMobileApp
            ? 'En Android, las versiones nuevas se descargan e instalan encima de esta: tus datos se conservan.'
            : 'Las versiones nuevas se instalan desde aquí, firmadas por el autor: la app comprueba la firma antes de instalarlas.'}
        </p>
      </div>

      <Toggle
        checked={autoCheck}
        onChange={toggleAutoCheck}
        label="Buscar actualizaciones automáticamente"
        description="Al abrir la app y dos veces al día. Solo consulta qué versión es la última: no envía ningún dato tuyo."
      />

      {update.status === 'none' && <p className="text-sm text-acento">Tienes la última versión.</p>}
      {update.status === 'error' && <p className="text-sm text-peligro">{update.message}</p>}
      {available && (
        <div className="space-y-2 rounded-xl bg-acento-suave px-3 py-2.5 text-sm">
          <p>
            <b>FarmHabit {available.version}</b> ya está disponible.
          </p>
          {available.notes && (
            <p className="text-xs whitespace-pre-line text-texto-suave">{available.notes}</p>
          )}
          <Button variant="primary" onClick={() => void installUpdate()}>
            <Download size={16} />{' '}
            {available.install ? 'Actualizar y reiniciar' : 'Descargar la versión nueva'}
          </Button>
        </div>
      )}
      {update.status === 'installing' && (
        <p className="text-sm">Instalando FarmHabit {update.update.version}…</p>
      )}

      <Button
        onClick={() => void checkForUpdate()}
        disabled={update.status === 'checking' || update.status === 'installing'}
      >
        <RefreshCw size={16} className={update.status === 'checking' ? 'animate-spin' : ''} />
        {update.status === 'checking' ? 'Buscando…' : 'Buscar actualizaciones'}
      </Button>
    </Card>
  );
}
