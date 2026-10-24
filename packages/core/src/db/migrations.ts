import type { SqlDriver, SqlStatement } from './driver';

// Migraciones del esquema local. Son SQL CONGELADO: una vez publicada una
// migración no se edita nunca; los cambios van en una migración nueva.

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

const SYNC_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER`;

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'esquema inicial',
    statements: [
      `CREATE TABLE tags (${SYNC_COLUMNS},
        name TEXT NOT NULL,
        color TEXT NOT NULL)`,
      `CREATE TABLE tasks (${SYNC_COLUMNS},
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        priority INTEGER NOT NULL CHECK (priority IN (1, 2, 3)),
        status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
        due_date TEXT,
        due_time TEXT,
        rrule TEXT,
        reminders TEXT NOT NULL DEFAULT '[]',
        tag_ids TEXT NOT NULL DEFAULT '[]',
        completed_at INTEGER)`,
      `CREATE INDEX idx_tasks_due ON tasks (status, due_date)`,
      `CREATE TABLE task_completions (${SYNC_COLUMNS},
        task_id TEXT NOT NULL,
        occurrence_date TEXT NOT NULL,
        completed_at INTEGER NOT NULL)`,
      `CREATE INDEX idx_task_completions_task ON task_completions (task_id)`,
      `CREATE TABLE habits (${SYNC_COLUMNS},
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        sort_key TEXT NOT NULL,
        start_date TEXT NOT NULL,
        config_history TEXT NOT NULL,
        reminders TEXT NOT NULL DEFAULT '[]',
        archived_at INTEGER)`,
      `CREATE TABLE habit_logs (${SYNC_COLUMNS},
        habit_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
        value REAL)`,
      `CREATE INDEX idx_habit_logs_habit_date ON habit_logs (habit_id, date)`,
      `CREATE TABLE note_folders (${SYNC_COLUMNS},
        name TEXT NOT NULL,
        parent_id TEXT,
        sort_key TEXT NOT NULL)`,
      `CREATE TABLE notes (${SYNC_COLUMNS},
        folder_id TEXT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        plain_text TEXT NOT NULL DEFAULT '',
        tag_ids TEXT NOT NULL DEFAULT '[]',
        pinned INTEGER NOT NULL DEFAULT 0,
        is_private INTEGER NOT NULL DEFAULT 0,
        private_blob TEXT)`,
      `CREATE TABLE animals (${SYNC_COLUMNS},
        name TEXT NOT NULL,
        species TEXT NOT NULL,
        acquired_on TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('starter', 'bought', 'born')),
        price INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE vacations (${SYNC_COLUMNS},
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL)`,
      `CREATE TABLE settings (${SYNC_COLUMNS},
        key TEXT NOT NULL,
        value TEXT NOT NULL)`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** Tabla local (no se sincroniza) con deviceId, versión del esquema y reloj. */
const META_TABLE = `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`;

export async function getSchemaVersion(driver: SqlDriver): Promise<number> {
  await driver.execute(META_TABLE);
  const rows = await driver.select<{ value: string }>(
    `SELECT value FROM meta WHERE key = 'schemaVersion'`,
  );
  return rows[0] ? Number(rows[0].value) : 0;
}

/** Aplica las migraciones pendientes, cada una en su propia transacción. */
export async function migrate(driver: SqlDriver, migrations = MIGRATIONS): Promise<number> {
  let current = await getSchemaVersion(driver);
  const latest = migrations[migrations.length - 1]?.version ?? 0;
  if (current > latest) {
    throw new Error(
      `La base de datos es de una versión más nueva de FarmHabit (esquema ${current}). Actualiza la app.`,
    );
  }
  for (const m of migrations) {
    if (m.version <= current) continue;
    const statements: SqlStatement[] = m.statements.map((sql) => ({ sql }));
    statements.push({
      sql: `INSERT INTO meta (key, value) VALUES ('schemaVersion', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      params: [String(m.version)],
    });
    await driver.transaction(statements);
    current = m.version;
  }
  return current;
}
