import { useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { lockPrivateNotes, usePrivateSession } from '../../lib/private-session';
import { useApp } from '../../lib/use-app';
import { Button, Card } from '../../components/ui';
import { PrivateDialog, type PrivateDialogMode } from '../notes/PrivateDialog';
import { privateVaultFrom } from '../notes/private-vault';

export function PrivateNotesSettings() {
  const { data } = useApp();
  const dek = usePrivateSession();
  const [dialog, setDialog] = useState<PrivateDialogMode | null>(null);
  const vault = privateVaultFrom(data.settings);
  const count = data.notes.filter((n) => n.isPrivate).length;

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="font-semibold">Notas privadas</h2>
        <p className="mt-1 text-sm text-texto-suave">
          {vault
            ? `${count} ${count === 1 ? 'nota privada' : 'notas privadas'}, cifradas con su propia contraseña. Se bloquean solas tras 5 minutos sin usarlas.`
            : 'Marca una nota con el candado para cifrarla con una contraseña aparte. También viajan cifradas al sincronizar y en las copias.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!vault && <Button onClick={() => setDialog('create')}>Crear contraseña</Button>}
        {vault && dek && (
          <Button onClick={lockPrivateNotes}>
            <Lock size={16} /> Bloquear ahora
          </Button>
        )}
        {vault && !dek && (
          <Button onClick={() => setDialog('unlock')}>
            <LockOpen size={16} /> Desbloquear
          </Button>
        )}
        {vault && (
          <Button variant="ghost" onClick={() => setDialog('change')}>
            Cambiar contraseña
          </Button>
        )}
      </div>
      {dialog && <PrivateDialog mode={dialog} onClose={() => setDialog(null)} />}
    </Card>
  );
}
