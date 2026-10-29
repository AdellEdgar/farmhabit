import type { CollectionName } from '../model/collections';
import type { SqlValue } from './driver';

// Correspondencia entre las colecciones del modelo (camelCase) y las tablas
// SQLite (snake_case), con el tipo de cada columna para convertir valores.

type ColumnKind = 'text' | 'int' | 'real' | 'bool' | 'json';

interface TableSpec {
  table: string;
  columns: Record<string, ColumnKind>;
  /** Valores que se sobrescriben al borrar (no dejar contenido en tombstones). */
  purgeOnDelete?: Record<string, unknown>;
}

const sync = { id: 'text', createdAt: 'int', updatedAt: 'int', deletedAt: 'int' } as const;

export const TABLES: Record<CollectionName, TableSpec> = {
  tags: { table: 'tags', columns: { ...sync, name: 'text', color: 'text' } },
  tasks: {
    table: 'tasks',
    columns: {
      ...sync,
      title: 'text',
      notes: 'text',
      priority: 'int',
      status: 'text',
      dueDate: 'text',
      dueTime: 'text',
      rrule: 'text',
      reminders: 'json',
      tagIds: 'json',
      completedAt: 'int',
    },
    purgeOnDelete: { title: '', notes: '', reminders: [], tagIds: [] },
  },
  taskCompletions: {
    table: 'task_completions',
    columns: { ...sync, taskId: 'text', occurrenceDate: 'text', completedAt: 'int' },
  },
  habits: {
    table: 'habits',
    columns: {
      ...sync,
      name: 'text',
      description: 'text',
      icon: 'text',
      color: 'text',
      sortKey: 'text',
      startDate: 'text',
      configHistory: 'json',
      reminders: 'json',
      archivedAt: 'int',
    },
  },
  habitLogs: {
    table: 'habit_logs',
    columns: { ...sync, habitId: 'text', date: 'text', status: 'text', value: 'real' },
  },
  noteFolders: {
    table: 'note_folders',
    columns: { ...sync, name: 'text', parentId: 'text', sortKey: 'text' },
  },
  notes: {
    table: 'notes',
    columns: {
      ...sync,
      folderId: 'text',
      title: 'text',
      content: 'text',
      plainText: 'text',
      tagIds: 'json',
      pinned: 'bool',
      isPrivate: 'bool',
      privateBlob: 'text',
    },
    purgeOnDelete: { title: '', content: '', plainText: '', tagIds: [], privateBlob: null },
  },
  animals: {
    table: 'animals',
    columns: {
      ...sync,
      name: 'text',
      species: 'text',
      acquiredOn: 'text',
      source: 'text',
      price: 'int',
    },
  },
  vacations: {
    table: 'vacations',
    columns: { ...sync, startDate: 'text', endDate: 'text' },
  },
  settings: { table: 'settings', columns: { ...sync, key: 'text', value: 'text' } },
  calendarSources: {
    table: 'calendar_sources',
    columns: {
      ...sync,
      name: 'text',
      kind: 'text',
      url: 'text',
      ics: 'text',
      color: 'text',
      visible: 'bool',
    },
    purgeOnDelete: { url: null, ics: null },
  },
};

export function toSnake(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function encodeValue(kind: ColumnKind, value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'bool':
      return value ? 1 : 0;
    case 'json':
      return JSON.stringify(value);
    case 'int':
    case 'real':
      return value as number;
    case 'text':
      return value as string;
  }
}

export function decodeValue(kind: ColumnKind, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case 'bool':
      return value === 1 || value === true;
    case 'json':
      return JSON.parse(value as string);
    case 'int':
    case 'real':
      return Number(value);
    case 'text':
      return String(value);
  }
}

export function rowToEntity(spec: TableSpec, row: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {};
  for (const [field, kind] of Object.entries(spec.columns)) {
    out[field] = decodeValue(kind, row[toSnake(field)]);
  }
  return out;
}

/** Sentencia INSERT … ON CONFLICT DO UPDATE para guardar un elemento completo. */
export function upsertStatement(
  spec: TableSpec,
  entity: Record<string, unknown>,
): { sql: string; params: SqlValue[] } {
  const fields = Object.keys(spec.columns);
  const cols = fields.map(toSnake);
  const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
  return {
    sql: `INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
          ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
    params: fields.map((f) => encodeValue(spec.columns[f]!, entity[f])),
  };
}
