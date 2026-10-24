import { invoke, isTauri } from '@tauri-apps/api/core';
import type { SqlDriver, SqlStatement, SqlValue } from '@farmhabit/core';

/** SQLite nativo (comandos Rust de src-tauri/src/db.rs). */
class TauriSqlDriver implements SqlDriver {
  select<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return invoke<T[]>('db_select', { sql, params });
  }

  async execute(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    return { changes: await invoke<number>('db_execute', { sql, params }) };
  }

  transaction(statements: SqlStatement[]): Promise<void> {
    return invoke('db_transaction', {
      statements: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })),
    });
  }
}

const BROWSER_KEY = 'farmhabit:demo-db';

/**
 * SQLite en WebAssembly para `pnpm dev:web` (desarrollo en el navegador, sin
 * Tauri). Los datos se guardan en localStorage de ese navegador: es solo un
 * modo de prueba, la app real usa el driver nativo.
 */
async function createBrowserDriver(): Promise<SqlDriver> {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
  ]);
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });

  let saved: Uint8Array | undefined;
  try {
    const b64 = localStorage.getItem(BROWSER_KEY);
    if (b64) saved = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    saved = undefined;
  }
  const db = new SQL.Database(saved);

  const persist = () => {
    try {
      const bytes = db.export();
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      localStorage.setItem(BROWSER_KEY, btoa(bin));
    } catch {
      // Sin almacenamiento disponible: los datos duran lo que la pestaña.
    }
  };

  return {
    async select<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    async execute(sql: string, params: SqlValue[] = []) {
      db.run(sql, params);
      const changes = db.getRowsModified();
      persist();
      return { changes };
    },
    async transaction(statements: SqlStatement[]) {
      db.exec('BEGIN');
      try {
        for (const s of statements) db.run(s.sql, s.params ?? []);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      persist();
    },
  };
}

export const isDesktopApp = isTauri();

export async function createDriver(): Promise<SqlDriver> {
  return isDesktopApp ? new TauriSqlDriver() : createBrowserDriver();
}
