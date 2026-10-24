/** Valor que se puede enlazar a un parámetro `?` de SQLite. */
export type SqlValue = string | number | null;

export interface SqlStatement {
  sql: string;
  params?: SqlValue[];
}

/**
 * Acceso mínimo a SQLite que el núcleo necesita. Cada plataforma aporta su
 * implementación (plugin-sql de Tauri en la app, node:sqlite en los tests).
 * Los parámetros son siempre posicionales con `?`.
 */
export interface SqlDriver {
  select<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  execute(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  /** Ejecuta todas las sentencias de forma atómica: o todas o ninguna. */
  transaction(statements: SqlStatement[]): Promise<void>;
}
