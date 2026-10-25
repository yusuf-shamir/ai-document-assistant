import type { ModelId } from '@/lib/models';

export interface ChatInputMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatExcerpt {
  name: string;
  location: string;
  text: string;
}

export interface ChatDocumentMetadata {
  name: string;
  size: number;
}

/** Typed contract shared by the chat client and the /api/chat route. */
export interface ChatRequestPayload {
  question: string;
  recentMessages: ChatInputMessage[];
  excerpts: ChatExcerpt[];
  documentMetadata: ChatDocumentMetadata[];
  documentsSelected: boolean;
  locale: 'en' | 'es';
  model: ModelId;
}

export function getLatestUserMessage(messages: readonly ChatInputMessage[]): ChatInputMessage | undefined {
  return [...messages].reverse().find((message) => message.role === 'user');
}
