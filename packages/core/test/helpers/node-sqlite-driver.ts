import { DatabaseSync } from 'node:sqlite';
import type { SqlDriver, SqlStatement, SqlValue } from '../../src/db/driver';

/** SqlDriver para tests sobre el SQLite que trae Node (en memoria por defecto). */
export class NodeSqliteDriver implements SqlDriver {
  readonly raw: DatabaseSync;

  constructor(path = ':memory:') {
    this.raw = new DatabaseSync(path);
  }

  async select<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  async execute(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    const r = this.raw.prepare(sql).run(...params);
    return { changes: Number(r.changes) };
  }

  async transaction(statements: SqlStatement[]): Promise<void> {
    this.raw.exec('BEGIN');
    try {
      for (const s of statements) this.raw.prepare(s.sql).run(...(s.params ?? []));
      this.raw.exec('COMMIT');
    } catch (e) {
      this.raw.exec('ROLLBACK');
      throw e;
    }
  }
}
