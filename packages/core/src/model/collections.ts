import { z } from 'zod';
import {
  animalSchema,
  calendarSourceSchema,
  habitLogSchema,
  habitSchema,
  noteFolderSchema,
  noteSchema,
  settingSchema,
  tagSchema,
  taskCompletionSchema,
  taskSchema,
  vacationSchema,
} from './schemas';

/**
 * Registro de colecciones sincronizables. Añadir una colección aquí (y su
 * tabla en una migración) basta para que se exporte, importe y fusione.
 * El orden importa al aplicar cambios (las referenciadas primero).
 */
export const COLLECTIONS = {
  tags: tagSchema,
  tasks: taskSchema,
  taskCompletions: taskCompletionSchema,
  habits: habitSchema,
  habitLogs: habitLogSchema,
  noteFolders: noteFolderSchema,
  notes: noteSchema,
  animals: animalSchema,
  vacations: vacationSchema,
  settings: settingSchema,
  calendarSources: calendarSourceSchema,
} as const;

export type CollectionName = keyof typeof COLLECTIONS;
export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export type EntityOf<C extends CollectionName> = z.infer<(typeof COLLECTIONS)[C]>;

/** Todos los datos de la app, colección a colección. */
export type Dataset = { [C in CollectionName]: EntityOf<C>[] };

export function emptyDataset(): Dataset {
  const out = {} as Record<CollectionName, unknown[]>;
  for (const name of COLLECTION_NAMES) out[name] = [];
  return out as Dataset;
}
