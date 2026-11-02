import { z } from 'zod';
import type { ChatClient, ChatMessage, ToolCall, ToolSpec } from './chat';
import type { AssistantTool, ToolContext } from './tools';
import { ASSISTANT_TOOLS, toolSpecs } from './tools';

// Bucle de conversación del asistente. Envía la conversación al modelo,
// ejecuta las consultas que pide y convierte cada cambio en una propuesta que
// el usuario confirma o cancela. Mientras haya propuestas sin responder, el
// modelo espera. La conversación vive solo en memoria.

export type AssistantItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; text: string }
  | {
      kind: 'action';
      id: string;
      summary: string;
      status: 'pending' | 'done' | 'cancelled' | 'failed';
      error?: string;
    }
  | { kind: 'error'; id: string; text: string };

export interface AssistantState {
  items: AssistantItem[];
  /** Esperando al modelo o aplicando un cambio. */
  busy: boolean;
}

export interface ConversationOptions {
  client: ChatClient;
  /** Fecha y hora actuales y base de datos (se piden en cada paso). */
  context: () => ToolContext;
  /** Tras aplicar un cambio confirmado, para refrescar la interfaz. */
  onDataChanged?: () => Promise<void> | void;
  tools?: AssistantTool[];
  /** Llamadas seguidas al modelo en un mismo turno, como mucho. */
  maxSteps?: number;
}

const MAX_RESULT_CHARS = 20_000;
const CANCELLED = 'El usuario ha cancelado esta acción. No la repitas salvo que te lo pida.';

function errorText(e: unknown): string {
  if (e instanceof z.ZodError) return z.prettifyError(e);
  if (e instanceof Error) return e.message;
  return 'Error inesperado';
}

function systemPrompt(ctx: ToolContext): string {
  const date = new Date(ctx.now);
  const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date);
  const time = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(
    date,
  );
  return [
    'Eres el asistente de FarmHabit, una app personal de tareas, hábitos, notas y calendario con una granja de animales que depende de cumplir los hábitos.',
    `Hoy es ${weekday} ${ctx.today} y son las ${time}.`,
    'Responde siempre en español, de forma breve y cercana.',
    'Usa las herramientas para consultar los datos en vez de suponerlos, y para hacer los cambios que te pidan.',
    'Cada cambio se le muestra al usuario como propuesta y solo se aplica si la confirma: llama a la herramienta directamente, sin pedir permiso antes en el texto.',
    'Si la petición es ambigua (por ejemplo, varias tareas encajan), pregunta antes de proponer nada.',
    'Los ids son internos: obtenlos con una consulta, no los inventes y no se los enseñes al usuario.',
    'Los hábitos solo se pueden marcar hoy o ayer. No tienes acceso a las notas privadas.',
  ].join('\n');
}

export class AssistantConversation {
  private readonly client: ChatClient;
  private readonly context: () => ToolContext;
  private readonly onDataChanged?: () => Promise<void> | void;
  private readonly tools: AssistantTool[];
  private readonly specs: ToolSpec[];
  private readonly maxSteps: number;

  private messages: ChatMessage[] = [];
  private readonly pending = new Map<string, { tool: AssistantTool; args: unknown }>();
  private readonly listeners = new Set<() => void>();
  private state: AssistantState = { items: [], busy: false };
  private seq = 0;

  constructor(opts: ConversationOptions) {
    this.client = opts.client;
    this.context = opts.context;
    this.onDataChanged = opts.onDataChanged;
    this.tools = opts.tools ?? ASSISTANT_TOOLS;
    this.specs = toolSpecs(this.tools);
    this.maxSteps = opts.maxSteps ?? 8;
  }

  getState(): AssistantState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Envía un mensaje. Las propuestas sin responder se dan por canceladas. */
  async send(text: string): Promise<void> {
    const content = text.trim();
    if (!content || this.state.busy) return;
    for (const id of [...this.pending.keys()]) this.reject(id);
    this.messages.push({ role: 'user', content });
    this.addItem({ kind: 'user', id: this.nextId(), text: content });
    await this.run();
  }

  /** Confirma (aplica) o cancela una propuesta. */
  async resolve(actionId: string, approve: boolean): Promise<void> {
    const p = this.pending.get(actionId);
    if (!p || this.state.busy) return;
    if (!approve) {
      this.reject(actionId);
    } else {
      this.pending.delete(actionId);
      this.setBusy(true);
      try {
        const result = await p.tool.run(p.args, this.context());
        this.pushToolResult(actionId, { ok: true, result });
        this.updateAction(actionId, { status: 'done' });
        await this.onDataChanged?.();
      } catch (e) {
        this.pushToolResult(actionId, { ok: false, error: errorText(e) });
        this.updateAction(actionId, { status: 'failed', error: errorText(e) });
      } finally {
        this.setBusy(false);
      }
    }
    if (this.pending.size === 0) await this.run();
  }

  private async run(): Promise<void> {
    this.setBusy(true);
    try {
      for (let step = 0; step < this.maxSteps; step++) {
        const ctx = this.context();
        const reply = await this.client.complete(
          [{ role: 'system', content: systemPrompt(ctx) }, ...this.messages],
          this.specs,
        );
        this.messages.push({
          role: 'assistant',
          content: reply.content,
          toolCalls: reply.toolCalls,
        });
        const text = reply.content?.trim();
        if (text) this.addItem({ kind: 'assistant', id: this.nextId(), text });
        if (reply.toolCalls.length === 0) return;
        for (const call of reply.toolCalls) await this.handleCall(call, ctx);
        if (this.pending.size > 0) return;
      }
      this.addItem({
        kind: 'error',
        id: this.nextId(),
        text: 'El asistente ha dado demasiados pasos seguidos y se ha detenido.',
      });
    } catch (e) {
      this.addItem({ kind: 'error', id: this.nextId(), text: errorText(e) });
    } finally {
      this.setBusy(false);
    }
  }

  private async handleCall(call: ToolCall, ctx: ToolContext): Promise<void> {
    const tool = this.tools.find((t) => t.name === call.name);
    if (!tool) {
      this.pushToolResult(call.id, { ok: false, error: `No existe la herramienta ${call.name}` });
      return;
    }
    let args: unknown;
    try {
      args = tool.args.parse(call.arguments.trim() ? JSON.parse(call.arguments) : {});
    } catch (e) {
      this.pushToolResult(call.id, { ok: false, error: `Argumentos no válidos: ${errorText(e)}` });
      return;
    }
    try {
      if (tool.kind === 'read') {
        this.pushToolResult(call.id, { ok: true, result: await tool.run(args, ctx) });
        return;
      }
      const summary = await tool.describe!(args, ctx);
      this.pending.set(call.id, { tool, args });
      this.addItem({ kind: 'action', id: call.id, summary, status: 'pending' });
    } catch (e) {
      this.pushToolResult(call.id, { ok: false, error: errorText(e) });
    }
  }

  private reject(actionId: string): void {
    if (!this.pending.delete(actionId)) return;
    this.pushToolResult(actionId, { ok: false, error: CANCELLED });
    this.updateAction(actionId, { status: 'cancelled' });
  }

  private pushToolResult(toolCallId: string, value: unknown): void {
    let content = JSON.stringify(value);
    if (content.length > MAX_RESULT_CHARS) content = `${content.slice(0, MAX_RESULT_CHARS)}…`;
    this.messages.push({ role: 'tool', toolCallId, content });
  }

  private nextId(): string {
    return `m${++this.seq}`;
  }

  private addItem(item: AssistantItem): void {
    this.emit({ items: [...this.state.items, item] });
  }

  private updateAction(
    id: string,
    patch: Partial<Extract<AssistantItem, { kind: 'action' }>>,
  ): void {
    this.emit({
      items: this.state.items.map((it) =>
        it.kind === 'action' && it.id === id ? { ...it, ...patch } : it,
      ),
    });
  }

  private setBusy(busy: boolean): void {
    if (this.state.busy !== busy) this.emit({ busy });
  }

  private emit(patch: Partial<AssistantState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
}
