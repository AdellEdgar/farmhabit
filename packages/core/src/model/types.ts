import type { z } from 'zod';
import type {
  animalSchema,
  calendarSourceSchema,
  habitConfigSchema,
  habitLogSchema,
  habitReminderSchema,
  habitSchema,
  habitScheduleSchema,
  habitTargetSchema,
  noteFolderSchema,
  noteSchema,
  prioritySchema,
  settingSchema,
  speciesSchema,
  tagSchema,
  taskCompletionSchema,
  taskReminderSchema,
  taskSchema,
  vacationSchema,
} from './schemas';

export type Tag = z.infer<typeof tagSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type TaskReminder = z.infer<typeof taskReminderSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskCompletion = z.infer<typeof taskCompletionSchema>;
export type HabitSchedule = z.infer<typeof habitScheduleSchema>;
export type HabitTarget = z.infer<typeof habitTargetSchema>;
export type HabitConfig = z.infer<typeof habitConfigSchema>;
export type HabitReminder = z.infer<typeof habitReminderSchema>;
export type Habit = z.infer<typeof habitSchema>;
export type HabitLog = z.infer<typeof habitLogSchema>;
export type NoteFolder = z.infer<typeof noteFolderSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type Animal = z.infer<typeof animalSchema>;
export type Vacation = z.infer<typeof vacationSchema>;
export type Setting = z.infer<typeof settingSchema>;
export type CalendarSource = z.infer<typeof calendarSourceSchema>;

/** Lo mínimo que necesita la fusión de cualquier elemento. */
export interface SyncEntity {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
