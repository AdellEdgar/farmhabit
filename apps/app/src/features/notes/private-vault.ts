import {
  parsePrivateVault,
  PRIVATE_VAULT_SETTING,
  settingId,
  type PrivateVaultInfo,
  type Setting,
} from '@farmhabit/core';

/** Caja de notas privadas guardada en los ajustes sincronizados (o null si aún no hay). */
export function privateVaultFrom(settings: Setting[]): PrivateVaultInfo | null {
  const row = settings.find(
    (s) => s.id === settingId(PRIVATE_VAULT_SETTING) && s.deletedAt === null,
  );
  if (!row) return null;
  try {
    return parsePrivateVault(row.value);
  } catch {
    return null;
  }
}
