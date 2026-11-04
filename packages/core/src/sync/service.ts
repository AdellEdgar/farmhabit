import type { Database } from '../db/database';
import type { Dataset } from '../model/collections';
import { LATEST_SCHEMA_VERSION } from '../db/migrations';
import type { ExportPayload, FileSecret, FormatOptions } from './format';
import { decodeExport, encodeExport, InvalidFileError } from './format';
import type { MergeReport } from './merge';
import { mergeDatasets } from './merge';
import type { RemoteStore } from './vault';

// Exportar e importar la base de datos completa como archivo .agx, y
// sincronizar con un almacenamiento remoto (un archivo por dispositivo).

const lastSyncKey = (deviceId: string) => `lastSync:${deviceId}`;
const seenKey = (fileName: string) => `sync:seen:${fileName}`;
const LAST_UPLOAD_CLOCK = 'sync:lastUploadClock';

export function deviceFileName(deviceId: string): string {
  return `farmhabit-${deviceId}.agx`;
}

const DEVICE_FILE_RE = /^farmhabit-(.+)\.agx$/;

export async function exportDatabase(
  db: Database,
  secret: FileSecret,
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
    secret,
    { ...opts, deviceId: db.deviceId, now },
  );
}

/** Esquemas en los que los hábitos ganaron sus campos de criatura y sus especies pasadas. */
const CREATURE_SCHEMA_VERSION = 4;
const CREATURE_PAST_SCHEMA_VERSION = 5;

/**
 * Un archivo de una versión anterior a las criaturas trae los hábitos sin sus
 * campos (al leerlo valen null/''). Sin esto, ese dispositivo borraría la
 * especie, el nombre, el fondo y el aura de los demás al sincronizar: se
 * conservan los locales.
 */
function keepCreatureFields(local: Dataset, payload: ExportPayload): Dataset {
  if (payload.schemaVersion >= CREATURE_PAST_SCHEMA_VERSION) return payload.collections;
  const mine = new Map(local.habits.map((h) => [h.id, h]));
  return {
    ...payload.collections,
    habits: payload.collections.habits.map((h) => {
      const m = mine.get(h.id);
      if (!m) return h;
      if (payload.schemaVersion >= CREATURE_SCHEMA_VERSION)
        return { ...h, creaturePast: m.creaturePast };
      return {
        ...h,
        creaturePast: m.creaturePast,
        creatureSpecies: m.creatureSpecies,
        creatureName: m.creatureName,
        creatureBackground: m.creatureBackground,
        creatureAura: m.creatureAura,
      };
    }),
  };
}

/** Fusiona el contenido de un archivo ya descifrado con los datos locales. */
export async function mergeIntoDatabase(
  db: Database,
  payload: ExportPayload,
): Promise<MergeReport> {
  const now = db.source.now();
  const lastSync = await db.getMeta(lastSyncKey(payload.sourceDeviceId));
  const local = await db.exportDataset();
  const { changes, report } = mergeDatasets(local, keepCreatureFields(local, payload), {
    now,
    lastSyncedAt: lastSync === null ? null : Number(lastSync),
  });
  await db.applyEntities(changes);
  if (payload.sourceDeviceId !== db.deviceId) {
    await db.setMeta(lastSyncKey(payload.sourceDeviceId), String(now));
  }
  return report;
}

/** Importa un archivo y lo fusiona con los datos locales. */
export async function importIntoDatabase(
  db: Database,
  bytes: Uint8Array,
  secret: FileSecret,
): Promise<MergeReport> {
  const { payload } = await decodeExport(bytes, secret);
  return mergeIntoDatabase(db, payload);
}

export interface SyncResult {
  /** Dispositivos cuyos cambios se han traído en esta sincronización. */
  pulledFrom: string[];
  /** Elementos añadidos, actualizados o borrados en este dispositivo. */
  changed: number;
  conflictCopies: number;
  uploaded: boolean;
  /** Archivos remotos que no se pudieron leer (otro baúl, dañados…). */
  skipped: string[];
}

/**
 * Una pasada de sincronización: trae los archivos de los demás dispositivos
 * que hayan cambiado, los fusiona y sube el propio si hay cambios locales.
 */
export async function syncWithRemote(
  db: Database,
  store: RemoteStore,
  secret: FileSecret,
): Promise<SyncResult> {
  const result: SyncResult = {
    pulledFrom: [],
    changed: 0,
    conflictCopies: 0,
    uploaded: false,
    skipped: [],
  };
  const ownFile = deviceFileName(db.deviceId);
  const files = await store.list();

  for (const file of files) {
    const match = DEVICE_FILE_RE.exec(file.name);
    if (!match || file.name === ownFile) continue;
    const seen = String(file.modifiedAt);
    if ((await db.getMeta(seenKey(file.name))) === seen) continue;

    const bytes = await store.read(file.name);
    if (!bytes) continue;
    let payload: ExportPayload;
    try {
      payload = (await decodeExport(bytes, secret)).payload;
    } catch (e) {
      if (e instanceof InvalidFileError) {
        result.skipped.push(file.name);
        continue;
      }
      throw e;
    }
    const report = await mergeIntoDatabase(db, payload);
    for (const c of Object.values(report.collections))
      result.changed += c.added + c.updated + c.deleted;
    result.conflictCopies += report.conflictCopies;
    result.pulledFrom.push(payload.sourceDeviceId);
    await db.setMeta(seenKey(file.name), seen);
  }

  // Subir solo si algo cambió desde la última subida (o si el archivo no existe).
  const clock = String(db.clock.lastIssued);
  const ownExists = files.some((f) => f.name === ownFile);
  if (!ownExists || (await db.getMeta(LAST_UPLOAD_CLOCK)) !== clock) {
    await store.write(ownFile, await exportDatabase(db, secret));
    await db.setMeta(LAST_UPLOAD_CLOCK, clock);
    result.uploaded = true;
  }
  return result;
}
