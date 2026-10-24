import { COLLECTION_NAMES } from '../model/collections';
import type { CollectionName, Dataset } from '../model/collections';
import type { Note, SyncEntity } from '../model/types';
import { canonicalJson } from '../util/canonical-json';
import { deterministicId } from '../util/ids';

// Fusión por elemento con "gana el más reciente" (LWW). Es determinista:
// el resultado no depende del orden en que se fusionen las copias
// (conmutativa, asociativa e idempotente).

/** Margen a partir del cual una marca de tiempo "del futuro" es sospechosa. */
export const FUTURE_TOLERANCE_MS = 5 * 60_000;

/** > 0 si `a` gana a `b`, < 0 si gana `b`, 0 si son idénticos. */
export function compareVersions(a: SyncEntity, b: SyncEntity): number {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
  // Empate: gana el borrado.
  const aDel = a.deletedAt !== null;
  const bDel = b.deletedAt !== null;
  if (aDel !== bDel) return aDel ? 1 : -1;
  // Empate total: desempate determinista por contenido.
  const ja = canonicalJson(a);
  const jb = canonicalJson(b);
  return ja === jb ? 0 : ja > jb ? 1 : -1;
}

/** Une dos copias de una colección quedándose con la versión ganadora de cada id. */
export function mergeEntities<T extends SyncEntity>(a: T[], b: T[]): T[] {
  const byId = new Map<string, T>();
  for (const e of [...a, ...b]) {
    const prev = byId.get(e.id);
    if (!prev || compareVersions(e, prev) > 0) byId.set(e.id, e);
  }
  return [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export interface CollectionReport {
  added: number;
  updated: number;
  deleted: number;
  unchanged: number;
}

export interface MergeReport {
  collections: Record<CollectionName, CollectionReport>;
  conflictCopies: number;
  /** Elementos con updatedAt sospechosamente en el futuro (reloj desajustado). */
  futureTimestamps: { collection: CollectionName; id: string; updatedAt: number }[];
}

export interface MergeResult {
  /** Elementos que hay que escribir en la base de datos local. */
  changes: Dataset;
  report: MergeReport;
}

export interface MergeOptions {
  now: number;
  /**
   * Momento de la última sincronización con el dispositivo remoto. Si una nota
   * cambió en los dos lados después, se conserva también la versión perdedora.
   */
  lastSyncedAt?: number | null;
}

function emptyReport(): CollectionReport {
  return { added: 0, updated: 0, deleted: 0, unchanged: 0 };
}

export function mergeDatasets(local: Dataset, remote: Dataset, opts: MergeOptions): MergeResult {
  const changes = {} as Record<CollectionName, SyncEntity[]>;
  const collections = {} as Record<CollectionName, CollectionReport>;
  const futureTimestamps: MergeReport['futureTimestamps'] = [];
  let conflictCopies = 0;

  for (const name of COLLECTION_NAMES) {
    const localItems = local[name] as SyncEntity[];
    const remoteItems = remote[name] as SyncEntity[];
    const localById = new Map(localItems.map((e) => [e.id, e]));
    const report = emptyReport();
    const out: SyncEntity[] = [];

    for (const r of remoteItems) {
      if (r.updatedAt > opts.now + FUTURE_TOLERANCE_MS) {
        futureTimestamps.push({ collection: name, id: r.id, updatedAt: r.updatedAt });
      }
    }

    for (const winner of mergeEntities(localItems, remoteItems)) {
      const mine = localById.get(winner.id);
      if (mine && compareVersions(winner, mine) === 0) {
        report.unchanged++;
        continue;
      }
      out.push(winner);
      if (winner.deletedAt !== null) report.deleted++;
      else if (mine) report.updated++;
      else report.added++;

      if (name === 'notes' && mine) {
        const copy = conflictCopy(mine as Note, winner as Note, remoteItems, opts);
        if (copy && !localById.has(copy.id)) {
          out.push(copy);
          conflictCopies++;
        }
      }
    }

    // Si la versión local ganó a una remota editada a la vez, la copia de
    // conflicto se crea con la remota (perdedora).
    if (name === 'notes') {
      for (const r of remoteItems as Note[]) {
        const mine = localById.get(r.id) as Note | undefined;
        if (!mine || compareVersions(mine, r) <= 0) continue;
        const copy = conflictCopy(r, mine, remoteItems, opts);
        if (copy && !localById.has(copy.id) && !out.some((e) => e.id === copy.id)) {
          out.push(copy);
          conflictCopies++;
        }
      }
    }

    changes[name] = out;
    collections[name] = report;
  }

  return {
    changes: changes as unknown as Dataset,
    report: { collections, conflictCopies, futureTimestamps },
  };
}

/**
 * Copia de la versión perdedora de una nota editada en ambos lados desde la
 * última sincronización. Id determinista: los dos dispositivos crean la misma.
 */
function conflictCopy(
  loser: Note,
  winner: Note,
  remoteItems: SyncEntity[],
  opts: MergeOptions,
): Note | null {
  if (opts.lastSyncedAt == null) return null;
  if (loser.deletedAt !== null || winner.deletedAt !== null) return null;
  if (loser.updatedAt <= opts.lastSyncedAt || winner.updatedAt <= opts.lastSyncedAt) return null;
  if (
    loser.title === winner.title &&
    loser.content === winner.content &&
    loser.privateBlob === winner.privateBlob
  ) {
    return null;
  }
  const id = deterministicId('noteConflict', loser.id, String(loser.updatedAt));
  if (remoteItems.some((e) => e.id === id)) return null;
  return {
    ...loser,
    id,
    title: loser.isPrivate ? loser.title : `${loser.title} (conflicto)`.trim(),
    createdAt: loser.updatedAt,
    updatedAt: loser.updatedAt,
  };
}
