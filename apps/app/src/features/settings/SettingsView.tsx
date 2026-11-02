import { APP_NAME, SCHEMA_VERSION } from '@farmhabit/core';
import { useApp } from '../../lib/use-app';
import { isDesktopApp } from '../../lib/drivers';
import { isDemo } from '../../lib/demo-data';
import { Card, PageHeader } from '../../components/ui';
import { AppearanceSettings } from './AppearanceSettings';
import { BackupSettings } from './BackupSettings';
import { NotificationSettings } from './NotificationSettings';
import { PrivateNotesSettings } from './PrivateNotesSettings';
import { SyncSettings } from './SyncSettings';
import { UpdateSettings } from './UpdateSettings';

const SHORTCUTS = [
  ['N', 'Nueva tarea (en Hoy y Tareas) o nueva nota (en Notas)'],
  ['/', 'Buscar en las notas'],
  ['Esc', 'Cerrar un diálogo'],
];

export function SettingsView() {
  const { db } = useApp();

  return (
    <>
      <PageHeader title="Ajustes" />

      <div className="space-y-5">
        <AppearanceSettings />

        <NotificationSettings />

        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Atajos de teclado</h2>
          <dl className="space-y-2 text-sm">
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="flex items-center gap-3">
                <dt>
                  <kbd className="inline-block min-w-8 rounded-md border border-borde bg-elevado px-2 py-0.5 text-center font-mono text-xs">
                    {key}
                  </kbd>
                </dt>
                <dd className="text-texto-suave">{desc}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <PrivateNotesSettings />
        <SyncSettings />
        <BackupSettings />
        <UpdateSettings />
        {!isDesktopApp && (
          <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">
            {isDemo
              ? 'Estás en la demo web: los datos son de ejemplo y se guardan solo en este navegador. Para usarla de verdad, descarga la app.'
              : 'Estás en el modo navegador de desarrollo: los datos se guardan solo en este navegador.'}
          </p>
        )}

        <p className="text-center text-xs text-texto-suave">
          {APP_NAME} {__APP_VERSION__} · esquema {SCHEMA_VERSION} · {db.deviceId.slice(0, 8)}
        </p>
      </div>
    </>
  );
}
