import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import {
  changePrivatePassword,
  createPrivateVault,
  MIN_PASSWORD_LENGTH,
  savePrivateVault,
  unlockPrivateVault,
} from '@farmhabit/core';
import { errorMessage } from '../../lib/errors';
import { unlockPrivateNotes } from '../../lib/private-session';
import { useApp } from '../../lib/use-app';
import { Button, Dialog, Field, Input } from '../../components/ui';
import { privateVaultFrom } from './private-vault';

export type PrivateDialogMode = 'unlock' | 'create' | 'change';

/**
 * Diálogo de notas privadas: crear la contraseña, desbloquear o cambiarla.
 * Al crear o desbloquear, la clave queda en memoria hasta que se bloquee.
 */
export function PrivateDialog({
  mode,
  onClose,
  onDone,
}: {
  mode: PrivateDialogMode;
  onClose: () => void;
  onDone?: () => void;
}) {
  const { data, mutate, toast } = useApp();
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vault = privateVaultFrom(data.settings);

  const needsRepeat = mode !== 'unlock';
  const valid =
    password.length >= (mode === 'unlock' ? 1 : MIN_PASSWORD_LENGTH) &&
    (!needsRepeat || password === password2) &&
    (mode !== 'change' || current.length > 0);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        const { info, dek } = await createPrivateVault(password);
        await mutate((db) => savePrivateVault(db, info));
        unlockPrivateNotes(dek);
        toast('Notas privadas activadas');
      } else if (mode === 'unlock') {
        if (!vault) throw new Error('Todavía no has creado la contraseña de notas privadas');
        unlockPrivateNotes(await unlockPrivateVault(vault, password));
      } else {
        if (!vault) throw new Error('Todavía no has creado la contraseña de notas privadas');
        const info = await changePrivatePassword(vault, current, password);
        await mutate((db) => savePrivateVault(db, info));
        toast('Contraseña de notas privadas cambiada');
      }
      onDone?.();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = {
    unlock: 'Desbloquear notas privadas',
    create: 'Contraseña de notas privadas',
    change: 'Cambiar la contraseña',
  }[mode];

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onClose()}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid || busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {mode === 'unlock' ? 'Desbloquear' : 'Guardar'}
          </Button>
        </>
      }
    >
      {mode === 'create' && (
        <p className="text-sm text-texto-suave">
          Las notas privadas llevan una capa extra de cifrado y piden esta contraseña para abrirse.
          Es distinta de la de las copias y de la frase de sincronización. Si la olvidas, esas notas
          no se pueden recuperar.
        </p>
      )}
      {mode === 'change' && (
        <Field label="Contraseña actual">
          <Input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
      )}
      <Field
        label={mode === 'change' ? 'Contraseña nueva' : 'Contraseña'}
        hint={mode !== 'unlock' ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres.` : undefined}
      >
        <Input
          type="password"
          autoFocus={mode !== 'change'}
          autoComplete={mode === 'unlock' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
      </Field>
      {needsRepeat && (
        <Field label="Repítela">
          <Input
            type="password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
          />
        </Field>
      )}
      {error && <p className="rounded-xl bg-peligro/10 px-3 py-2 text-sm text-peligro">{error}</p>}
    </Dialog>
  );
}
