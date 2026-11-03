import { describe, expect, it } from 'vitest';
import { Database } from '../src/db/database';
import { getSchemaVersion, LATEST_SCHEMA_VERSION, migrate, MIGRATIONS } from '../src/db/migrations';
import { subtaskProgress, subtasksOf } from '../src/domain/tasks';
import {
  addSubtask,
  completeTask,
  deleteSubtask,
  deleteTask,
  EmptySubtaskError,
  renameSubtask,
  setSubtaskDone,
} from '../src/services/tasks';
import { noon, openTestDb } from './helpers/fixtures';
import { NodeSqliteDriver } from './helpers/node-sqlite-driver';

const TODAY = '2026-10-24';

async function newTask(db: Database, over: { rrule?: string; dueDate?: string } = {}) {
  return db.repo('tasks').create({
    title: 'Práctica de Redes',
    notes: '',
    priority: 2,
    status: 'pending',
    dueDate: over.dueDate ?? null,
    dueTime: null,
    rrule: over.rrule ?? null,
    reminders: [],
    tagIds: [],
    completedAt: null,
  });
}

async function subtasks(db: Database, taskId: string) {
  return subtasksOf(await db.repo('subtasks').list({ includeDeleted: true }), taskId);
}

describe('subtareas', () => {
  it('se añaden al final, en orden, y sin título no valen', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db);
    await addSubtask(db, task.id, '  Leer el enunciado ');
    await addSubtask(db, task.id, 'Programar');
    await addSubtask(db, task.id, 'Entregar');
    expect((await subtasks(db, task.id)).map((s) => s.title)).toEqual([
      'Leer el enunciado',
      'Programar',
      'Entregar',
    ]);
    await expect(addSubtask(db, task.id, '   ')).rejects.toBeInstanceOf(EmptySubtaskError);
  });

  it('completar la última completa la tarea', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db);
    const a = await addSubtask(db, task.id, 'A');
    const b = await addSubtask(db, task.id, 'B');

    const first = await setSubtaskDone(db, a.id, true, TODAY);
    expect(first).toMatchObject({ autoCompleted: false, task: { status: 'pending' } });

    const last = await setSubtaskDone(db, b.id, true, TODAY);
    expect(last).toMatchObject({ autoCompleted: true, task: { status: 'done' } });
    expect(subtaskProgress(await subtasks(db, task.id))).toEqual({ done: 2, total: 2 });
  });

  it('desmarcar una subtarea devuelve la tarea a pendientes', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db);
    const a = await addSubtask(db, task.id, 'A');
    await setSubtaskDone(db, a.id, true, TODAY);
    expect((await db.repo('tasks').get(task.id))!.status).toBe('done');

    const res = await setSubtaskDone(db, a.id, false, TODAY);
    expect(res.task).toMatchObject({ status: 'pending', completedAt: null });
  });

  it('en una tarea que se repite, pasa a la siguiente fecha con las subtareas por hacer', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db, { rrule: 'FREQ=WEEKLY', dueDate: TODAY });
    const a = await addSubtask(db, task.id, 'A');
    const b = await addSubtask(db, task.id, 'B');
    await setSubtaskDone(db, a.id, true, TODAY);
    const res = await setSubtaskDone(db, b.id, true, TODAY);

    expect(res).toMatchObject({
      autoCompleted: true,
      task: { status: 'pending', dueDate: '2026-10-31' },
    });
    expect((await subtasks(db, task.id)).map((s) => s.done)).toEqual([false, false]);
  });

  it('completar la tarea a mano no toca las subtareas', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db);
    await addSubtask(db, task.id, 'A');
    await completeTask(db, task.id, TODAY);
    expect((await subtasks(db, task.id)).map((s) => s.done)).toEqual([false]);
  });

  it('borrar la única pendiente completa la tarea; renombrar no la toca', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db);
    const a = await addSubtask(db, task.id, 'A');
    const b = await addSubtask(db, task.id, 'B');
    await renameSubtask(db, a.id, 'A bien escrita');
    await setSubtaskDone(db, a.id, true, TODAY);

    const res = await deleteSubtask(db, b.id, TODAY);
    expect(res).toMatchObject({ autoCompleted: true, task: { status: 'done' } });
    expect((await subtasks(db, task.id)).map((s) => s.title)).toEqual(['A bien escrita']);
  });

  it('borrar la tarea borra sus subtareas y vacía su título', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db);
    const a = await addSubtask(db, task.id, 'Secreto');
    await deleteTask(db, task.id);
    expect(await db.repo('tasks').get(task.id)).toBeNull();
    expect(await db.repo('subtasks').get(a.id, { includeDeleted: true })).toMatchObject({
      title: '',
      deletedAt: expect.any(Number),
    });
  });

  it('viajan en la exportación como una colección más', async () => {
    const { db } = await openTestDb(noon(TODAY));
    const task = await newTask(db);
    await addSubtask(db, task.id, 'A');
    const dataset = await db.exportDataset();
    expect(dataset.subtasks).toMatchObject([{ taskId: task.id, title: 'A', done: false }]);
  });

  it('una base de datos de la versión 2 se actualiza sin perder tareas', async () => {
    const driver = new NodeSqliteDriver();
    await migrate(driver, MIGRATIONS.slice(0, 2));
    const id = '0b5c4a3e-1d2f-4a6b-8c9d-0e1f2a3b4c5d';
    await driver.execute(
      `INSERT INTO tasks (id, created_at, updated_at, deleted_at, title, notes, priority, status,
        due_date, due_time, rrule, reminders, tag_ids, completed_at)
       VALUES (?, 1, 1, NULL, 'Antigua', '', 2, 'pending', NULL, NULL, NULL, '[]', '[]', NULL)`,
      [id],
    );
    expect(await getSchemaVersion(driver)).toBe(2);
    const db = await Database.open(driver);
    expect(await getSchemaVersion(driver)).toBe(LATEST_SCHEMA_VERSION);
    expect((await db.repo('tasks').list()).map((t) => t.title)).toEqual(['Antigua']);
    await addSubtask(db, id, 'A');
    expect(await subtasks(db, id)).toHaveLength(1);
  });
});
