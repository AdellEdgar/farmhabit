import { COLLECTION_NAMES, COLLECTIONS, emptyDataset } from '../model/collections';
import type { CollectionName, Dataset, EntityOf } from '../model/collections';
import type { Clock } from '../util/clock';
import { MonotonicClock, systemClock } from '../util/clock';
import { newId } from '../util/ids';
import type { SqlDriver, SqlStatement } from './driver';
import { migrate } from './migrations';
import { rowToEntity, TABLES, upsertStatement } from './tables';

/** Datos de un elemento sin los campos de sincronización (los pone la BD). */
export type NewEntity<C extends CollectionName> = Omit<
  EntityOf<C>,
  'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
> & { id?: string };

export type EntityPatch<C extends CollectionName> = Partial<
  Omit<EntityOf<C>, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
>;

export class NotFoundError extends Error {
  constructor(collection: string, id: string) {
    super(`No existe ${collection}/${id}`);
    this.name = 'NotFoundError';
  }
}

/**
 * Base de datos local de FarmHabit. Aplica migraciones al abrir, gestiona el
 * deviceId y el reloj monotónico, y ofrece un repositorio por colección.
 */
export class Database {
  private constructor(
    readonly driver: SqlDriver,
    readonly deviceId: string,
    readonly clock: MonotonicClock,
    readonly source: Clock,
  ) {}

  static async open(driver: SqlDriver, source: Clock = systemClock): Promise<Database> {
    await migrate(driver);
    const meta = await readMeta(driver);
    let deviceId = meta.get('deviceId');
    if (!deviceId) {
      deviceId = newId();
      await driver.execute(`INSERT INTO meta (key, value) VALUES ('deviceId', ?)`, [deviceId]);
    }
    const lastClock = Number(meta.get('lastClock') ?? 0);
    return new Database(driver, deviceId, new MonotonicClock(source, lastClock), source);
  }

  /** Marca de tiempo nueva + sentencia que la persiste (va en la misma transacción). */
  nextTimestamp(): { ts: number; persist: SqlStatement } {
    const ts = this.clock.next();
    return { ts, persist: saveClockStatement(ts) };
  }

  repo<C extends CollectionName>(collection: C): Repository<C> {
    return new Repository(this, collection);
  }

  async getMeta(key: string): Promise<string | null> {
    return (await readMeta(this.driver)).get(key) ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.driver.execute(
      `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value],
    );
  }

  /**
   * Huella de cada colección (filas y suma de `updated_at`). Como toda
   * escritura cambia `updated_at`, si la huella no cambia la colección
   * tampoco: la interfaz solo relee lo que ha cambiado.
   */
  async collectionSignatures(): Promise<Record<CollectionName, string>> {
    const sql = COLLECTION_NAMES.map(
      (name) =>
        `SELECT '${name}' AS c, COUNT(*) || ':' || CAST(COALESCE(SUM(updated_at), 0) AS TEXT) AS s FROM ${TABLES[name].table}`,
    ).join(' UNION ALL ');
    const rows = await this.driver.select<{ c: CollectionName; s: string }>(sql);
    return Object.fromEntries(rows.map((r) => [r.c, String(r.s)])) as Record<
      CollectionName,
      string
    >;
  }

  /** Todos los datos, tombstones incluidos (para exportar o fusionar). */
  async exportDataset(): Promise<Dataset> {
    const out = emptyDataset();
    for (const name of COLLECTION_NAMES) {
      (out[name] as unknown[]) = await this.repo(name).list({ includeDeleted: true });
    }
    return out;
  }

  /**
   * Guarda elementos tal cual llegan (resultado de una fusión), sin tocar sus
   * marcas de tiempo. Todo en una transacción.
   */
  async applyEntities(changes: Partial<Dataset>): Promise<void> {
    const statements: SqlStatement[] = [];
    let maxTs = 0;
    for (const name of COLLECTION_NAMES) {
      for (const entity of changes[name] ?? []) {
        const valid = COLLECTIONS[name].parse(entity) as Record<string, unknown>;
        statements.push(upsertStatement(TABLES[name], valid));
        maxTs = Math.max(maxTs, valid.updatedAt as number);
      }
    }
    if (statements.length === 0) return;
    // Que nuestras próximas escrituras queden por delante de lo importado.
    this.clock.observe(maxTs);
    statements.push(saveClockStatement(this.clock.lastIssued));
    await this.driver.transaction(statements);
  }
}

export class Repository<C extends CollectionName> {
  private readonly spec;
  private readonly schema;

  constructor(
    private readonly db: Database,
    readonly collection: C,
  ) {
    this.spec = TABLES[collection];
    this.schema = COLLECTIONS[collection];
  }

  async get(id: string, opts: { includeDeleted?: boolean } = {}): Promise<EntityOf<C> | null> {
    const where = opts.includeDeleted ? '' : ' AND deleted_at IS NULL';
    const rows = await this.db.driver.select(
      `SELECT * FROM ${this.spec.table} WHERE id = ?${where}`,
      [id],
    );
    return rows[0] ? (rowToEntity(this.spec, rows[0]) as EntityOf<C>) : null;
  }

  async list(opts: { includeDeleted?: boolean } = {}): Promise<EntityOf<C>[]> {
    const where = opts.includeDeleted ? '' : ' WHERE deleted_at IS NULL';
    const rows = await this.db.driver.select(
      `SELECT * FROM ${this.spec.table}${where} ORDER BY created_at, id`,
    );
    return rows.map((r) => rowToEntity(this.spec, r) as EntityOf<C>);
  }

  async create(data: NewEntity<C>): Promise<EntityOf<C>> {
    const { ts, persist } = this.db.nextTimestamp();
    const entity = this.schema.parse({
      ...data,
      id: data.id ?? newId(),
      createdAt: ts,
      updatedAt: ts,
      deletedAt: null,
    }) as EntityOf<C>;
    await this.write(entity, persist);
    return entity;
  }

  /** Crea o reemplaza un elemento con un id concreto (ids deterministas). */
  async put(id: string, data: NewEntity<C>): Promise<EntityOf<C>> {
    const existing = await this.get(id, { includeDeleted: true });
    const { ts, persist } = this.db.nextTimestamp();
    const entity = this.schema.parse({
      ...data,
      id,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
      deletedAt: null,
    }) as EntityOf<C>;
    await this.write(entity, persist);
    return entity;
  }

  async update(id: string, patch: EntityPatch<C>): Promise<EntityOf<C>> {
    const current = await this.get(id);
    if (!current) throw new NotFoundError(this.collection, id);
    const { ts, persist } = this.db.nextTimestamp();
    const entity = this.schema.parse({
      ...current,
      ...patch,
      id,
      createdAt: current.createdAt,
      updatedAt: ts,
      deletedAt: null,
    }) as EntityOf<C>;
    await this.write(entity, persist);
    return entity;
  }

  /**
   * Borrado lógico (tombstone): la fila se queda para que el borrado viaje a
   * los demás dispositivos. El contenido sensible se vacía.
   */
  async remove(id: string): Promise<void> {
    const current = await this.get(id);
    if (!current) return;
    const { ts, persist } = this.db.nextTimestamp();
    const entity = {
      ...current,
      ...(this.spec.purgeOnDelete ?? {}),
      updatedAt: ts,
      deletedAt: ts,
    } as EntityOf<C>;
    await this.write(entity, persist);
  }

  private async write(entity: EntityOf<C>, persist: SqlStatement): Promise<void> {
    await this.db.driver.transaction([
      upsertStatement(this.spec, entity as Record<string, unknown>),
      persist,
    ]);
  }
}

function saveClockStatement(ts: number): SqlStatement {
  return {
    sql: `INSERT INTO meta (key, value) VALUES ('lastClock', ?)
          ON CONFLICT(key) DO UPDATE SET value = MAX(CAST(value AS INTEGER), CAST(excluded.value AS INTEGER))`,
    params: [String(ts)],
  };
}

async function readMeta(driver: SqlDriver): Promise<Map<string, string>> {
  const rows = await driver.select<{ key: string; value: string }>(`SELECT key, value FROM meta`);
  return new Map(rows.map((r) => [r.key, r.value]));
}
