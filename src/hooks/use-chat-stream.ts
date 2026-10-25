'use client';

import { useAppStore, selectActiveConversation, type Message } from '@/store/use-document-store';
import { useI18n } from '@/lib/i18n';
import { useRef } from 'react';
import { retrieveRelevantExcerpts } from '@/lib/document-retrieval';
import { useModelSelection } from '@/hooks/use-model-selection';
import type { ChatRequestPayload } from '@/lib/chat-request';

function waitWithAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }
    const onAbort = () => reject(new DOMException('The operation was aborted.', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener('abort', onAbort); resolve(value); },
      (error: unknown) => { signal.removeEventListener('abort', onAbort); reject(error); },
    );
  });
}

export function useChatStream() {
  const { locale, strings } = useI18n();
  const { model } = useModelSelection();
  const activeController = useRef<AbortController | null>(null);
  const askQuestion = async (userText: string) => {
    const state = useAppStore.getState();
    if (!userText.trim() || state.isStreaming) return;
    const active = selectActiveConversation(state);
    if (!active) return;
    const recentMessages = active.messages.slice(-4).filter((message): message is Message & { role: 'user' | 'assistant' } => message.role !== 'system').map(({ role, content }) => ({
      role,
      content: content.slice(0, 500),
    }));
    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', content: userText.trim(), createdAt: new Date().toISOString() };
    useAppStore.getState().addMessage(userMessage);
    const assistantId = crypto.randomUUID();
    useAppStore.getState().addMessage({ id: assistantId, role: 'assistant', content: '', createdAt: new Date().toISOString() });
    if (/^(?:hi|hello|hey|hey there|hi there|good morning|good afternoon|good evening|hola|buenas|buenos d[ií]as|buenas tardes|buenas noches)[.!?]*$/iu.test(userMessage.content)) {
      useAppStore.getState().updateMessage(assistantId, strings.greetingReply);
      return;
    }
    useAppStore.getState().setIsStreaming(true);
    const controller = new AbortController();
    activeController.current = controller;
    try {
      const documents = Object.values(useAppStore.getState().documents).filter((doc) => doc.status === 'ready');
      const selectedDocuments = documents.filter((document) => document.selected);
      const excerpts = await waitWithAbort(retrieveRelevantExcerpts(userText.trim(), selectedDocuments), controller.signal);
      const metadataDocuments = selectedDocuments.length ? (excerpts.length ? [] : selectedDocuments) : documents;
      const documentMetadata = metadataDocuments.map(({ name, size }) => ({ name, size }));
      const payload: ChatRequestPayload = {
        question: userMessage.content,
        recentMessages,
        excerpts,
        documentMetadata,
        documentsSelected: selectedDocuments.length > 0,
        locale,
        model,
      };
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string; providerMessage?: string; providerStatus?: number; providerCode?: string } | null;
        const details = body?.providerMessage ? ` Gemini said: ${body.providerMessage}${body.providerStatus ? ` (HTTP ${body.providerStatus})` : ''}${body.providerCode ? ` [${body.providerCode}]` : ''}` : '';
        throw new Error(`${body?.error ?? (response.status === 429 ? strings.busy : strings.failedAnswer)}${details}`);
      }
      if (!response.body) throw new Error(strings.responseUnavailable);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        useAppStore.getState().updateMessage(assistantId, answer);
      }
      answer += decoder.decode();
      useAppStore.getState().updateMessage(assistantId, answer);
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : strings.connectionInterrupted;
      useAppStore.getState().updateMessage(assistantId, `${strings.couldntFinish} ${message}`);
    } finally {
      if (activeController.current === controller) activeController.current = null;
      useAppStore.getState().setIsStreaming(false);
    }
  };
  const stopGeneration = () => activeController.current?.abort();
  return { askQuestion, stopGeneration };
}
