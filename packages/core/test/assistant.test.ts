import { describe, expect, it } from 'vitest';
import type { ChatClient, ChatMessage, ChatReply } from '../src/assistant/chat';
import { AssistantConversation } from '../src/assistant/conversation';
import { describeDay, toolSpecs } from '../src/assistant/tools';
import { createHabit } from '../src/services/habits';
import { noon, openTestDb } from './helpers/fixtures';

const TODAY = '2026-10-24';

/** Modelo falso: devuelve las respuestas del guion y guarda lo que recibe. */
class ScriptedClient implements ChatClient {
  readonly calls: ChatMessage[][] = [];
  constructor(readonly script: ChatReply[]) {}
  async complete(messages: ChatMessage[]): Promise<ChatReply> {
    this.calls.push(structuredClone(messages));
    const next = this.script.shift();
    if (!next) throw new Error('El guion se ha acabado');
    return next;
  }
}

const say = (content: string): ChatReply => ({ content, toolCalls: [] });
const call = (id: string, name: string, args: object = {}): ChatReply => ({
  content: null,
  toolCalls: [{ id, name, arguments: JSON.stringify(args) }],
});

/** Último resultado de herramienta que ha visto el modelo, ya parseado. */
function lastToolResult(client: ScriptedClient) {
  const msgs = client.calls[client.calls.length - 1]!;
  const tool = [...msgs].reverse().find((m) => m.role === 'tool');
  return tool && tool.role === 'tool'
    ? (JSON.parse(tool.content) as Record<string, unknown>)
    : null;
}

async function setup(script: ChatReply[]) {
  const { db } = await openTestDb(noon(TODAY));
  const client = new ScriptedClient(script);
  let refreshes = 0;
  const conv = new AssistantConversation({
    client,
    context: () => ({ db, today: TODAY, now: noon(TODAY) }),
    onDataChanged: () => {
      refreshes++;
    },
  });
  return { db, client, conv, refreshes: () => refreshes };
}

describe('asistente', () => {
  it('responde texto sin herramientas', async () => {
    const { conv, client } = await setup([say('¡Hola!')]);
    await conv.send('hola');
    expect(conv.getState().items.map((i) => i.kind)).toEqual(['user', 'assistant']);
    expect(client.calls[0]![0]!.role).toBe('system');
    expect(conv.getState().busy).toBe(false);
  });

  it('las consultas se ejecutan sin pedir confirmación', async () => {
    const { db, conv, client } = await setup([
      call('c1', 'list_tasks', { view: 'all' }),
      say('Tienes una tarea.'),
    ]);
    await db.repo('tasks').create({
      title: 'Comprar pan',
      notes: '',
      priority: 2,
      status: 'pending',
      dueDate: TODAY,
      dueTime: null,
      rrule: null,
      reminders: [],
      tagIds: [],
      completedAt: null,
    });
    await conv.send('¿qué tareas tengo?');
    const result = lastToolResult(client) as { result: { tasks: { title: string }[] } };
    expect(result.result.tasks.map((t) => t.title)).toEqual(['Comprar pan']);
    expect(conv.getState().items.some((i) => i.kind === 'action')).toBe(false);
  });

  it('un cambio no se aplica hasta que se confirma', async () => {
    const { db, conv, refreshes } = await setup([
      call('c1', 'create_task', {
        title: 'Entregar práctica',
        dueDate: '2026-10-25',
        dueTime: '10:00',
        priority: 'alta',
      }),
      say('Hecho.'),
    ]);
    await conv.send('apunta entregar la práctica mañana a las 10');

    const action = conv.getState().items.find((i) => i.kind === 'action');
    expect(action).toMatchObject({
      status: 'pending',
      summary: 'Crear tarea «Entregar práctica» · mañana · 10:00 · prioridad alta',
    });
    expect(await db.repo('tasks').list()).toHaveLength(0);

    await conv.resolve('c1', true);
    const tasks = await db.repo('tasks').list();
    expect(tasks).toMatchObject([{ title: 'Entregar práctica', priority: 1, dueTime: '10:00' }]);
    expect(conv.getState().items.find((i) => i.kind === 'action')).toMatchObject({
      status: 'done',
    });
    expect(conv.getState().items.at(-1)).toMatchObject({ kind: 'assistant', text: 'Hecho.' });
    expect(refreshes()).toBe(1);
  });

  it('cancelar no cambia nada y se lo dice al modelo', async () => {
    const { db, conv, client } = await setup([
      call('c1', 'create_note', { title: 'Ideas', text: 'Una\nDos' }),
      say('Vale, no la creo.'),
    ]);
    await conv.send('crea una nota');
    await conv.resolve('c1', false);
    expect(await db.repo('notes').list()).toHaveLength(0);
    expect(lastToolResult(client)).toMatchObject({ ok: false });
    expect(conv.getState().items.find((i) => i.kind === 'action')).toMatchObject({
      status: 'cancelled',
    });
  });

  it('enviar otro mensaje cancela las propuestas pendientes', async () => {
    const { db, conv, client } = await setup([
      call('c1', 'create_task', { title: 'A' }),
      say('Entendido.'),
    ]);
    await conv.send('crea A');
    await conv.send('mejor no');
    expect(await db.repo('tasks').list()).toHaveLength(0);
    // Cada llamada a herramienta tiene su respuesta antes del siguiente mensaje.
    const msgs = client.calls[1]!;
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool', 'user']);
  });

  it('no deja marcar hábitos de días cerrados', async () => {
    const { db, conv, client } = await setup([]);
    const habit = await createHabit(db, {
      name: 'Leer',
      startDate: '2026-10-01',
      config: { effort: 3, schedule: { type: 'daily' }, target: null },
    });
    client.script.push(
      call('c1', 'log_habit', { habitId: 'x', status: 'done' }),
      call('c2', 'log_habit', { habitId: habit.id, date: '2026-10-20', status: 'done' }),
      say('No se puede.'),
    );

    await conv.send('marca leer');
    expect(client.calls).toHaveLength(3);
    const results = client.calls[2]!.filter((m) => m.role === 'tool');
    expect(results.map((m) => (m.role === 'tool' ? JSON.parse(m.content).error : ''))).toEqual([
      'No existe ningún hábito con id x',
      'El día 2026-10-20 ya está cerrado y no se puede modificar',
    ]);
    expect(conv.getState().items.some((i) => i.kind === 'action')).toBe(false);
  });

  it('marca un hábito de hoy tras confirmar', async () => {
    const { db, conv, client } = await setup([]);
    const habit = await createHabit(db, {
      name: 'Agua',
      icon: '💧',
      startDate: '2026-10-01',
      config: { effort: 2, schedule: { type: 'daily' }, target: { quantity: 2, unit: 'L' } },
    });
    client.script.push(
      call('c1', 'log_habit', { habitId: habit.id, status: 'done', value: 1.5 }),
      say('Apuntado.'),
    );
    await conv.send('he bebido 1,5 litros');
    expect(conv.getState().items.find((i) => i.kind === 'action')).toMatchObject({
      summary: 'Marcar «💧 Agua» como hecho con 1.5 L (hoy)',
    });
    await conv.resolve('c1', true);
    expect(await db.repo('habitLogs').list()).toMatchObject([
      { habitId: habit.id, date: TODAY, status: 'done', value: 1.5 },
    ]);
  });

  it('crea hábitos validando la frecuencia', async () => {
    const { db, conv, client } = await setup([
      call('c1', 'create_habit', { name: 'Correr', frequency: 'weekdays' }),
      call('c2', 'create_habit', {
        name: 'Correr',
        frequency: 'weekdays',
        days: [1, 3, 5],
        importance: 4,
      }),
      say('Listo.'),
    ]);
    await conv.send('quiero correr lunes, miércoles y viernes');
    expect(client.calls).toHaveLength(2);
    expect(lastToolResult(client)).toMatchObject({ ok: false });
    expect(conv.getState().items.find((i) => i.kind === 'action')).toMatchObject({
      id: 'c2',
      summary: 'Crear hábito «Correr» · L, X, V · importancia 4',
    });
    await conv.resolve('c2', true);
    const [habit] = await db.repo('habits').list();
    expect(habit).toMatchObject({ name: 'Correr', startDate: TODAY });
    expect(habit!.configHistory[0]).toMatchObject({
      effort: 4,
      schedule: { type: 'weekdays', days: [1, 3, 5] },
    });
  });

  it('las notas privadas quedan fuera', async () => {
    const { db, conv, client } = await setup([call('c1', 'search_notes', {}), say('Una nota.')]);
    const base = { folderId: null, content: '', tagIds: [], pinned: false, privateBlob: null };
    await db
      .repo('notes')
      .create({ ...base, title: 'Pública', plainText: 'hola', isPrivate: false });
    await db.repo('notes').create({ ...base, title: '', plainText: '', isPrivate: true });
    await conv.send('¿qué notas tengo?');
    const result = lastToolResult(client) as { result: { notes: { title: string }[] } };
    expect(result.result.notes.map((n) => n.title)).toEqual(['Pública']);
  });

  it('argumentos mal formados vuelven al modelo como error', async () => {
    const { conv, client } = await setup([
      { content: null, toolCalls: [{ id: 'c1', name: 'create_task', arguments: '{"title":' }] },
      call('c2', 'no_existe'),
      say('Perdona.'),
    ]);
    await conv.send('algo');
    expect(lastToolResult(client)).toMatchObject({
      ok: false,
      error: 'No existe la herramienta no_existe',
    });
  });

  it('un error del modelo se muestra y la conversación sigue', async () => {
    const { conv } = await setup([]);
    await conv.send('hola');
    expect(conv.getState().items.at(-1)).toMatchObject({
      kind: 'error',
      text: 'El guion se ha acabado',
    });
    expect(conv.getState().busy).toBe(false);
  });

  it('se detiene si el modelo encadena demasiados pasos', async () => {
    const { conv } = await setup(Array.from({ length: 10 }, (_, i) => call(`c${i}`, 'get_farm')));
    await conv.send('bucle');
    expect(conv.getState().items.at(-1)).toMatchObject({ kind: 'error' });
  });

  it('describe las herramientas con JSON Schema', () => {
    const specs = toolSpecs();
    const create = specs.find((s) => s.name === 'create_task')!;
    expect(create.parameters).toMatchObject({ type: 'object', required: ['title'] });
    expect(create.parameters).not.toHaveProperty('$schema');
    expect(new Set(specs.map((s) => s.name)).size).toBe(specs.length);
  });

  it('describeDay usa palabras para los días cercanos', () => {
    expect(describeDay(TODAY, TODAY)).toBe('hoy');
    expect(describeDay('2026-10-25', TODAY)).toBe('mañana');
    expect(describeDay('2026-10-23', TODAY)).toBe('ayer');
    expect(describeDay('2026-11-07', TODAY)).toBe('sáb, 7 nov');
  });
});
