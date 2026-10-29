import { useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import {
  exportDatabase,
  importIntoDatabase,
  MIN_PASSWORD_LENGTH,
  type MergeReport,
} from '@farmhabit/core';
import { backupFileName, pickBackup, saveBackup } from '../../lib/backup';
import { errorMessage } from '../../lib/errors';
import { useApp } from '../../lib/use-app';
import { Button, Card, Dialog, Field, Input } from '../../components/ui';

type Mode = { kind: 'export' } | { kind: 'import'; name: string; bytes: Uint8Array };

function summarize(report: MergeReport): string {
  let added = 0;
  let updated = 0;
  let deleted = 0;
  for (const c of Object.values(report.collections)) {
    added += c.added;
    updated += c.updated;
    deleted += c.deleted;
  }
  if (added + updated + deleted === 0) return 'La copia no tenía nada nuevo';
  return `Importado: ${added} nuevos, ${updated} actualizados, ${deleted} borrados`;
}

export function BackupSettings() {
  const { db, data, today, mutate, toast } = useApp();
  const [mode, setMode] = useState<Mode | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setMode(null);
    setPassword('');
    setPassword2('');
    setError(null);
  };

  const startImport = async () => {
    try {
      const picked = await pickBackup();
      if (picked) setMode({ kind: 'import', ...picked });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const confirm = async () => {
    if (!mode) return;
    setBusy(true);
    setError(null);
    try {
      if (mode.kind === 'export') {
        const bytes = await exportDatabase(db, password);
        if (await saveBackup(bytes, backupFileName(today))) toast('Copia de seguridad guardada');
      } else {
        const bytes = mode.bytes;
        // Sin mutate: así los errores (p. ej. contraseña incorrecta) se ven en el diálogo.
        const report = await importIntoDatabase(db, bytes, password);
        await mutate(async () => undefined);
        toast(summarize(report));
      }
      close();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const exporting = mode?.kind === 'export';
  const valid = password.length >= MIN_PASSWORD_LENGTH && (!exporting || password === password2);

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="font-semibold">Copia de seguridad</h2>
        <p className="mt-1 text-sm text-texto-suave">
          Un archivo cifrado con todo ({data.tasks.length} tareas, {data.habits.length} hábitos,{' '}
          {data.notes.length} notas…). Al importarlo se fusiona con lo que ya tengas: no se pierde
          nada.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setMode({ kind: 'export' })}>
          <Download size={16} /> Exportar copia
        </Button>
        <Button onClick={startImport}>
          <Upload size={16} /> Importar copia
        </Button>
      </div>

      <Dialog
        open={mode !== null}
        onOpenChange={(o) => !o && !busy && close()}
        title={exporting ? 'Exportar copia cifrada' : 'Importar copia'}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirm} disabled={!valid || busy}>
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy
                ? exporting
                  ? 'Cifrando…'
                  : 'Descifrando…'
                : exporting
                  ? 'Exportar'
                  : 'Importar'}
            </Button>
          </>
        }
      >
        {mode?.kind === 'import' && (
          <p className="text-sm text-texto-suave">Archivo: {mode.name}</p>
        )}
        <Field
          label="Contraseña de la copia"
          hint={
            exporting
              ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres. No se guarda en ningún sitio.`
              : undefined
          }
        >
          <Input
            autoFocus
            type="password"
            autoComplete={exporting ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && valid && void confirm()}
          />
        </Field>
        {exporting && (
          <Field label="Repítela">
            <Input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && valid && void confirm()}
            />
          </Field>
        )}
        {exporting && password2 && password !== password2 && (
          <p className="text-xs text-peligro">Las contraseñas no coinciden.</p>
        )}
        {error && (
          <p className="rounded-xl bg-peligro/10 px-3 py-2 text-sm text-peligro">{error}</p>
        )}
      </Dialog>
    </Card>
  );
}
