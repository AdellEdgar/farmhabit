import type { Database } from '../db/database';
import { LATEST_SCHEMA_VERSION } from '../db/migrations';
import type { FormatOptions } from './format';
import { decodeExport, encodeExport } from './format';
import type { MergeReport } from './merge';
import { mergeDatasets } from './merge';

// Exportar e importar la base de datos completa como archivo .agx.

const lastSyncKey = (deviceId: string) => `lastSync:${deviceId}`;

export async function exportDatabase(
  db: Database,
  password: string,
  opts: Pick<FormatOptions, 'kdf'> = {},
): Promise<Uint8Array> {
  const now = db.source.now();
  return encodeExport(
    {
      formatVersion: 1,
      schemaVersion: LATEST_SCHEMA_VERSION,
      exportedAt: now,
      sourceDeviceId: db.deviceId,
      collections: await db.exportDataset(),
      privateVault: null,
    },
    password,
    { ...opts, deviceId: db.deviceId, now },
  );
}

/** Importa un archivo y lo fusiona con los datos locales. */
export async function importIntoDatabase(
  db: Database,
  bytes: Uint8Array,
  password: string,
): Promise<MergeReport> {
  const { payload } = await decodeExport(bytes, password);
  const now = db.source.now();
  const lastSync = await db.getMeta(lastSyncKey(payload.sourceDeviceId));
  const { changes, report } = mergeDatasets(await db.exportDataset(), payload.collections, {
    now,
    lastSyncedAt: lastSync === null ? null : Number(lastSync),
  });
  await db.applyEntities(changes);
  if (payload.sourceDeviceId !== db.deviceId) {
    await db.setMeta(lastSyncKey(payload.sourceDeviceId), String(now));
  }
  return report;
}
