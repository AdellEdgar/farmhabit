import { fetch } from '@tauri-apps/plugin-http';
import type { ChatClient, ChatMessage, ChatReply, ToolSpec } from '@farmhabit/core';

// Cliente de OpenRouter para el asistente: una sola API key da acceso a modelos
// de muchos proveedores con el formato de "chat completions" de OpenAI. Las
// llamadas pasan por tauri-plugin-http (la CSP no deja hacer fetch desde la web).

const API = 'https://openrouter.ai/api/v1';

/** Modelo por defecto: barato, rápido y bueno usando herramientas. */
export const DEFAULT_MODEL = 'anthropic/claude-haiku-5.5';

/** Sugerencias del ajuste de modelo (cualquier modelo con herramientas sirve). */
export const SUGGESTED_MODELS = [
  'anthropic/claude-haiku-5.5',
  'anthropic/claude-sonnet-5.5',
  'openai/gpt-6-luna',
  'openai/gpt-6.1-terra',
  'google/gemini-3.8-flash',
  'deepseek/deepseek-v4.1-flash',
];

export class OpenRouterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    // Identifican la app en el panel de OpenRouter.
    'HTTP-Referer': 'https://github.com/AdellEdgar/farmhabit',
    'X-Title': 'FarmHabit',
  };
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new OpenRouterError('No se pudo conectar con OpenRouter. Revisa tu conexión a internet.');
  }
}

async function failure(res: Response): Promise<OpenRouterError> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? '';
  } catch {
    // Sin cuerpo JSON: basta con el código.
  }
  switch (res.status) {
    case 401:
      return new OpenRouterError('La API key de OpenRouter no es válida. Revísala en Ajustes.');
    case 402:
      return new OpenRouterError('No te queda crédito en OpenRouter.');
    case 429:
      return new OpenRouterError('Demasiadas peticiones seguidas. Espera un momento.');
    default:
      return new OpenRouterError(
        `OpenRouter ha respondido con un error (${res.status})${detail ? `: ${detail}` : ''}`,
      );
  }
}

/** Comprueba que la clave existe y funciona. */
export async function verifyKey(apiKey: string): Promise<void> {
  const res = await request(`${API}/key`, { headers: headers(apiKey) });
  if (!res.ok) throw await failure(res);
}

function toWire(m: ChatMessage) {
  switch (m.role) {
    case 'assistant':
      return {
        role: 'assistant',
        content: m.content,
        ...(m.toolCalls.length > 0 && {
          tool_calls: m.toolCalls.map((c) => ({
            id: c.id,
            type: 'function',
            function: { name: c.name, arguments: c.arguments },
          })),
        }),
      };
    case 'tool':
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    default:
      return m;
  }
}

interface WireReply {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id: string; function: { name: string; arguments?: string } }[];
    };
  }[];
  error?: { message?: string };
}

export class OpenRouterClient implements ChatClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatReply> {
    const res = await request(`${API}/chat/completions`, {
      method: 'POST',
      headers: headers(this.apiKey),
      body: JSON.stringify({
        model: this.model,
        messages: messages.map(toWire),
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
      }),
    });
    if (!res.ok) throw await failure(res);
    const body = (await res.json()) as WireReply;
    // OpenRouter puede devolver 200 con un error del proveedor dentro.
    if (body.error) throw new OpenRouterError(body.error.message ?? 'Error del modelo');
    const message = body.choices?.[0]?.message;
    if (!message) throw new OpenRouterError('El modelo no ha devuelto ninguna respuesta');
    return {
      content: message.content ?? null,
      toolCalls: (message.tool_calls ?? []).map((c) => ({
        id: c.id,
        name: c.function.name,
        arguments: c.function.arguments ?? '',
      })),
    };
  }
}
