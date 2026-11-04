// Punto de entrada público del núcleo de ¡Chambea!

export const APP_NAME = '¡Chambea!';

export { LATEST_SCHEMA_VERSION as SCHEMA_VERSION } from './db/migrations';
export { CURRENT_FORMAT_VERSION as EXPORT_FORMAT_VERSION } from './sync/format';

// Modelo
export * from './model/schemas';
export type * from './model/types';
export * from './model/collections';

// Utilidades
export * from './util/dates';
export * from './util/clock';
export * from './util/ids';
export * from './util/fractional-index';
export * from './util/hash';
export * from './util/version';

// Persistencia
export type { SqlDriver, SqlStatement, SqlValue } from './db/driver';
export { migrate, MIGRATIONS } from './db/migrations';
export { Database, Repository, NotFoundError } from './db/database';
export type { NewEntity, EntityPatch } from './db/database';

// Dominio
export * from './domain/tasks';
export * from './domain/recurrence';
export * from './domain/habits';
export * from './domain/events';
export * from './domain/reminders';
export * from './domain/stats';
export * from './domain/ics';
export * from './domain/calendar';

// Servicios
export * from './services/tasks';
export * from './services/habits';
export * from './services/shop';
export * from './services/events';
export * from './services/private-notes';
export * from './services/calendar';

// Criaturas
export * from './game/species';
export * from './game/creature-rules';
export * from './game/creatures';
export * from './game/vacations';
export * from './game/creature-achievements';
export * from './game/celebrations';
export * from './game/missions';
export * from './game/phrases';
export * from './game/week-summary';

// Cifrado, formato y sincronización
export { DecryptionError, PRODUCTION_KDF } from './crypto/sodium';
export * from './crypto/private-notes';
export type { KdfParams } from './crypto/sodium';
export {
  InvalidFileError,
  UnsupportedVersionError,
  PayloadValidationError,
  PasswordTooShortError,
  MIN_PASSWORD_LENGTH,
  readHeader,
} from './sync/format';
export type { ExportHeader, ExportPayload, FileSecret, VaultKey } from './sync/format';
export * from './sync/merge';
export * from './sync/service';
export * from './sync/vault';
