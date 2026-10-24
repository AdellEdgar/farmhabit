// Punto de entrada público del núcleo. Cada módulo (model, db, domain, crypto,
// sync, game, util) se irá exportando desde aquí a partir de la Fase 1.

export const APP_NAME = 'FarmHabit';

/** Versión del esquema de la base de datos local. Sube con cada migración. */
export const SCHEMA_VERSION = 0;

/** Versión del formato del archivo cifrado .agx. Sube con cada cambio de formato. */
export const EXPORT_FORMAT_VERSION = 1;
