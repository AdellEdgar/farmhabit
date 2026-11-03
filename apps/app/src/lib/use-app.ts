import { createContext, useContext } from 'react';
import type {
  CalendarSource,
  Database,
  GameState,
  Habit,
  HabitLog,
  LocalDate,
  Note,
  NoteFolder,
  Setting,
  Tag,
  Task,
  TaskCompletion,
  Purchase,
  Vacation,
} from '@farmhabit/core';

export interface AppData {
  tasks: Task[];
  /** Incluye borradas: las tareas ya completadas siguen contando pesetas. */
  allTasks: Task[];
  taskCompletions: TaskCompletion[];
  /** Ajustes sincronizados (caja de notas privadas, temas personalizados…). */
  settings: Setting[];
  tags: Tag[];
  /** Incluye borrados: el motor de las criaturas los necesita para el pasado. */
  allHabits: Habit[];
  habits: Habit[];
  habitLogs: HabitLog[];
  notes: Note[];
  noteFolders: NoteFolder[];
  purchases: Purchase[];
  calendarSources: CalendarSource[];
  vacations: Vacation[];
}

export interface AppContextValue {
  db: Database;
  data: AppData;
  game: GameState;
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
