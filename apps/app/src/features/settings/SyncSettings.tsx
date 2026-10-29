import { useState } from 'react';
import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { MIN_PASSWORD_LENGTH } from '@farmhabit/core';
import { isDesktopApp } from '../../lib/drivers';
import { errorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { useSync } from '../../lib/use-sync';
import { Button, Card, Field, Input } from '../../components/ui';

export function SyncSettings() {
  const sync = useSync();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phrase, setPhrase] = useState('');
  const [phrase2, setPhrase2] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPhrase('');
      setPhrase2('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const creating = sync.phase === 'needs-vault' && sync.vaultExists === false;
  const phraseOk = phrase.length >= MIN_PASSWORD_LENGTH && (!creating || phrase === phrase2);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info/15 text-info">
          {sync.phase === 'unavailable' || sync.phase === 'signed-out' ? (
            <CloudOff size={20} />
          ) : (
            <Cloud size={20} />
          )}
        </span>
        <div>
          <h2 className="font-semibold">Sincronización con Google Drive</h2>
          <p className="mt-0.5 text-sm text-texto-suave">
            Tus dispositivos se mantienen al día solos. Todo se cifra aquí antes de subirse a una
            carpeta oculta de tu Drive: Google no puede leerlo.
          </p>
        </div>
      </div>

      {sync.phase === 'unavailable' && (
        <p className="rounded-xl bg-aviso/10 px-3 py-2 text-sm text-aviso">
          {isDesktopApp
            ? 'Faltan las credenciales de Google de esta compilación. Sigue la guía docs/google-drive.md del proyecto.'
            : 'La sincronización solo funciona en la app instalada, no en el modo navegador.'}
        </p>
      )}

      {sync.phase === 'signed-out' && (
        <div className="space-y-2">
          <Button variant="primary" disabled={busy} onClick={() => run(sync.connect)}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Cloud size={16} />}
            {busy ? 'Completa el inicio de sesión en el navegador…' : 'Conectar con Google Drive'}
          </Button>
          <p className="text-xs text-texto-suave">
            Se abrirá tu navegador para iniciar sesión. FarmHabit solo pide acceso a su propia
            carpeta, no al resto de tu Drive.
          </p>
        </div>
      )}

      {sync.phase === 'needs-vault' && sync.vaultExists !== null && (
        <form
          className="space-y-3 rounded-xl bg-fondo p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (phraseOk)
              void run(() => (creating ? sync.createVault(phrase) : sync.joinVault(phrase)));
          }}
        >
          <p className="text-sm font-medium">
            {creating
              ? 'Elige una frase secreta para cifrar tus datos'
              : 'Este es otro dispositivo: escribe tu frase secreta'}
          </p>
          <Field
            label="Frase secreta"
            hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres. Mejor varias palabras que una contraseña corta.`}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
          </Field>
          {creating && (
            <Field label="Repítela">
              <Input
                type="password"
                autoComplete="new-password"
                value={phrase2}
                onChange={(e) => setPhrase2(e.target.value)}
              />
            </Field>
          )}
          {creating && (
            <p className="rounded-lg bg-aviso/10 px-3 py-2 text-xs text-aviso">
              Si la olvidas, nadie puede recuperar los datos sincronizados (tampoco Google). La
              pedirá cada dispositivo nuevo una sola vez.
            </p>
          )}
          <Button variant="primary" type="submit" disabled={!phraseOk || busy}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {creating ? 'Crear y sincronizar' : 'Unirse y sincronizar'}
          </Button>
        </form>
      )}

      {(sync.phase === 'ready' || sync.phase === 'syncing' || sync.phase === 'error') && (
        <div className="space-y-3">
          <p className="text-sm">
            {sync.phase === 'syncing' ? (
              <span className="inline-flex items-center gap-2 text-info">
                <Loader2 size={15} className="animate-spin" /> Sincronizando…
              </span>
            ) : sync.lastSyncAt ? (
              <span className="text-texto-suave">
                Última sincronización: {formatDateTime(sync.lastSyncAt)}
              </span>
            ) : (
              <span className="text-texto-suave">Conectado</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void sync.syncNow()} disabled={sync.phase === 'syncing'}>
              <RefreshCw size={16} /> Sincronizar ahora
            </Button>
            {confirmDisconnect ? (
              <>
                <Button
                  variant="danger"
                  onClick={() => run(sync.disconnect).then(() => setConfirmDisconnect(false))}
                >
                  Sí, desconectar este dispositivo
                </Button>
                <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDisconnect(true)}>
                Desconectar
              </Button>
            )}
          </div>
          {confirmDisconnect && (
            <p className="text-xs text-texto-suave">
              Los datos de este dispositivo se quedan como están; solo deja de sincronizar. Los
              demás dispositivos no se tocan.
            </p>
          )}
        </div>
      )}

      {(error ?? sync.error) && (
        <p className="rounded-xl bg-peligro/10 px-3 py-2 text-sm text-peligro">
          {error ?? sync.error}
        </p>
      )}
    </Card>
  );
}
