// Tipos de la conversación con el modelo, en el formato de "chat completions"
// (el de OpenAI, que también usa OpenRouter). El núcleo no sabe con qué
// servicio habla: la app le pasa un ChatClient.

export interface ToolCall {
  id: string;
  name: string;
  /** Argumentos en JSON, tal como los genera el modelo. */
  arguments: string;
}

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema de los argumentos. */
  parameters: Record<string, unknown>;
}

export interface ChatReply {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface ChatClient {
  complete(messages: ChatMessage[], tools: ToolSpec[]): Promise<ChatReply>;
}
