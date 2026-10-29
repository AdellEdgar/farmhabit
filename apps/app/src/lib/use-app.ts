import { createContext, useContext } from 'react';
import type {
  Animal,
  CalendarSource,
  Database,
  FarmState,
  Habit,
  HabitLog,
  LocalDate,
  Note,
  NoteFolder,
  Setting,
  Tag,
  Task,
  TaskCompletion,
  Vacation,
} from '@farmhabit/core';

export interface AppData {
  tasks: Task[];
  taskCompletions: TaskCompletion[];
  /** Ajustes sincronizados (caja de notas privadas, temas personalizados…). */
  settings: Setting[];
  tags: Tag[];
  /** Incluye borrados: el motor de la granja los necesita para el pasado. */
  allHabits: Habit[];
  habits: Habit[];
  habitLogs: HabitLog[];
  notes: Note[];
  noteFolders: NoteFolder[];
  animals: Animal[];
  calendarSources: CalendarSource[];
  vacations: Vacation[];
}

export interface AppContextValue {
  db: Database;
  data: AppData;
  farm: FarmState;
  today: LocalDate;
  now: number;
  /** Ejecuta un cambio, recarga los datos y muestra los errores. */
  mutate: <T>(fn: (db: Database) => Promise<T>) => Promise<T | undefined>;
  toast: (message: string, kind?: 'info' | 'error') => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp fuera de AppProvider');
  return ctx;
}
