import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { useApp } from '../../lib/use-app';
import { isDesktopApp } from '../../lib/drivers';
import { FARM_ALERT_TIME } from '../../lib/reminder-text';
import {
  applyCloseToTray,
  DEFAULT_CLOSE_TO_TRAY,
  getAutostart,
  getFlag,
  isDesktopShell,
  isMobileApp,
  notificationPermission,
  PREF_KEYS,
  requestNotificationPermission,
  setAutostart,
  setFlag,
  showNotification,
  type PermissionState,
} from '../../lib/platform';
import { errorMessage } from '../../lib/errors';
import { Button, Card, Toggle } from '../../components/ui';

export function NotificationSettings() {
  const { db, toast } = useApp();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [closeToTray, setCloseToTray] = useState(true);
  const [autostart, setAutostartState] = useState<boolean | null>(null);

  useEffect(() => {
    void (async () => {
      setPermission(await notificationPermission());
      setEnabled(await getFlag(db, PREF_KEYS.remindersEnabled, true));
      setCloseToTray(await getFlag(db, PREF_KEYS.closeToTray, DEFAULT_CLOSE_TO_TRAY));
      setAutostartState(await getAutostart());
    })();
  }, [db]);

  const ask = async () => setPermission(await requestNotificationPermission());

  const test = async () => {
    if (permission !== 'granted') {
      const p = await requestNotificationPermission();
      setPermission(p);
      if (p !== 'granted') return toast('No hay permiso para mostrar notificaciones', 'error');
    }
    await showNotification('🐔 FarmHabit', 'Así se verán tus avisos.');
  };

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v);
    await setFlag(db, PREF_KEYS.remindersEnabled, v);
  };

  const toggleTray = async (v: boolean) => {
    setCloseToTray(v);
    await setFlag(db, PREF_KEYS.closeToTray, v);
    await applyCloseToTray(v);
  };

  const toggleAutostart = async (v: boolean) => {
    try {
      await setAutostart(v);
      setAutostartState(await getAutostart());
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Avisos</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Recordatorios de tareas y hábitos, y un aviso a las {FARM_ALERT_TIME} si algún animal está
          a punto de morir.
        </p>
      </div>

      {permission === 'unsupported' ? (
        <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">
          Este navegador no admite notificaciones.
        </p>
      ) : permission !== null && permission !== 'granted' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-aviso/10 px-3 py-2.5 text-sm text-aviso">
          <span>
            {permission === 'denied'
              ? 'Las notificaciones están bloqueadas. Actívalas en la configuración del sistema.'
              : 'Falta dar permiso para mostrar notificaciones.'}
          </span>
          {permission === 'default' && (
            <Button variant="primary" onClick={ask}>
              Permitir
            </Button>
          )}
        </div>
      ) : null}

      <Toggle
        checked={enabled}
        onChange={toggleEnabled}
        label="Avisos activados"
        description="Desactívalos para silenciar todos los recordatorios en este dispositivo."
      />

      {isDesktopShell && (
        <>
          <Toggle
            checked={closeToTray}
            onChange={toggleTray}
            label="Seguir en la bandeja al cerrar"
            description="Al cerrar la ventana, FarmHabit sigue en la bandeja del sistema para avisarte. Para salir del todo: clic derecho en el icono → Salir."
          />
          <Toggle
            checked={autostart ?? false}
            disabled={autostart === null}
            onChange={toggleAutostart}
            label="Abrir al iniciar el ordenador"
            description="Arranca minimizada en la bandeja, así los avisos llegan aunque no abras la app."
          />
        </>
      )}
      {isMobileApp && (
        <p className="text-xs text-texto-suave">
          Los avisos de los próximos 7 días se programan en el móvil y llegan aunque la app esté
          cerrada. Abre la app de vez en cuando para que se renueven.
        </p>
      )}
      {!isDesktopApp && (
        <p className="text-xs text-texto-suave">
          En el modo navegador los avisos solo llegan con la pestaña abierta.
        </p>
      )}

      <Button onClick={test}>
        <BellRing size={16} /> Probar un aviso
      </Button>
    </Card>
  );
}
