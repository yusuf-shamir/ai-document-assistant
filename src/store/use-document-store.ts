'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deleteOriginalPdf, saveOriginalPdf } from '@/lib/document-files';
import { indexDocumentSemantically, removeSemanticIndex } from '@/lib/document-retrieval';

export interface DocumentFile {
  id: string;
  name: string;
  size: number;
  text: string;
  uploadedAt: string;
  status: 'uploading' | 'indexing' | 'ready' | 'error';
  indexProgress?: number;
  selected?: boolean;
  error?: string;
}

export interface Citation { document: string; location: string; }
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  createdAt: string;
}
export interface Conversation { id: string; title: string; updatedAt: string; messages: Message[]; }

interface AppState {
  documents: Record<string, DocumentFile>;
  conversations: Conversation[];
  activeConversationId: string;
  isStreaming: boolean;
  uploadFile: (file: File) => Promise<void>;
  removeDocument: (id: string) => void;
  setDocumentSelected: (id: string, selected: boolean) => void;
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, content: string) => void;
  setIsStreaming: (status: boolean) => void;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  removeConversation: (id: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ');
    pages.push(`[Page ${pageNumber}]\n${text}`);
  }
  return pages.join('\n\n').trim();
}

function createConversation(): Conversation {
  return { id: makeId(), title: 'New conversation', updatedAt: new Date().toISOString(), messages: [] };
}

export const useAppStore = create<AppState>()(persist((set) => {
  const first = createConversation();
  return {
    documents: {}, conversations: [first], activeConversationId: first.id, isStreaming: false,
    uploadFile: async (file) => {
      const id = makeId();
      const candidate = { id, name: file.name, size: file.size, text: '', uploadedAt: new Date().toISOString(), status: 'uploading' as const };
      set((state) => ({ documents: { ...state.documents, [id]: candidate } }));
      try {
        if (file.size > MAX_FILE_SIZE) throw new Error('This file is larger than the 10 MB limit.');
        const ext = file.name.toLowerCase().split('.').pop();
        if (ext !== 'txt' && ext !== 'pdf') throw new Error('Only PDF and plain text files are supported.');
        const text = ext === 'pdf' ? await extractTextFromPDF(file) : await file.text();
        if (!text.trim()) throw new Error('No readable text was found in this file.');
        if (ext === 'pdf') {
          try {
            await saveOriginalPdf(id, file);
          } catch (error) {
            console.warn('The PDF could not be stored for in-app viewing.', error);
          }
          if (!useAppStore.getState().documents[id]) {
            await deleteOriginalPdf(id);
            return;
          }
        }
        set((state) => {
          const current = state.documents[id];
          // The user may remove a file while PDF/text extraction is still running.
          // Do not let that pending upload recreate a document they deleted.
          if (!current) return state;
          return { documents: { ...state.documents, [id]: { ...current, text, status: 'indexing', indexProgress: 0 } } };
        });
        if (!useAppStore.getState().documents[id]) return;
        let lastProgress = -1;
        try {
          await indexDocumentSemantically(id, { name: file.name, text }, ({ stage, progress }) => {
            // Avoid persisting every model download callback into localStorage.
            const combinedProgress = stage === 'model' ? progress * 0.7 : 70 + progress * 0.3;
            const rounded = Math.floor(combinedProgress / 5) * 5;
            if (rounded === lastProgress) return;
            lastProgress = rounded;
            set((state) => {
              const current = state.documents[id];
              if (!current || current.status !== 'indexing') return state;
              return { documents: { ...state.documents, [id]: { ...current, indexProgress: rounded } } };
            });
          });
        } catch (error) {
          // Semantic retrieval is an enhancement; retain the document and use
          // keyword retrieval if local model inference is unavailable.
          console.info('Local semantic indexing unavailable; keyword retrieval will be used.', error);
        }
        if (!useAppStore.getState().documents[id]) {
          await Promise.all([deleteOriginalPdf(id), removeSemanticIndex(id)]);
          return;
        }
        set((state) => {
          const current = state.documents[id];
          if (!current) return state;
          return { documents: { ...state.documents, [id]: { ...current, status: 'ready', indexProgress: undefined } } };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'We could not read this file.';
        set((state) => {
          const current = state.documents[id];
          if (!current) return state;
          return { documents: { ...state.documents, [id]: { ...current, status: 'error', error: message } } };
        });
      }
    },
    removeDocument: (id) => {
      void deleteOriginalPdf(id).catch((error: unknown) => console.warn('Could not remove the locally stored PDF.', error));
      void removeSemanticIndex(id).catch((error: unknown) => console.warn('Could not remove the local semantic index.', error));
      set((state) => ({ documents: Object.fromEntries(Object.entries(state.documents).filter(([documentId]) => documentId !== id)) }));
    },
    setDocumentSelected: (id, selected) => set((state) => {
      const document = state.documents[id];
      if (!document || document.status !== 'ready') return state;
      return { documents: { ...state.documents, [id]: { ...document, selected } } };
    }),
    addMessage: (message) => set((state) => ({
      conversations: state.conversations.map((conversation) => conversation.id !== state.activeConversationId ? conversation : {
        ...conversation,
        title: conversation.messages.length === 0 && message.role === 'user' ? message.content.slice(0, 48) : conversation.title,
        updatedAt: message.createdAt,
        messages: [...conversation.messages, message],
      }),
    })),
    updateMessage: (id, content) => set((state) => ({ conversations: state.conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) => message.id === id ? { ...message, content } : message),
    })) })),
    setIsStreaming: (isStreaming) => set({ isStreaming }),
    newConversation: () => {
      const conversation = createConversation();
      set((state) => ({ conversations: [conversation, ...state.conversations], activeConversationId: conversation.id }));
    },
    selectConversation: (id) => set({ activeConversationId: id }),
    removeConversation: (id) => set((state) => {
      const remaining = state.conversations.filter((conversation) => conversation.id !== id);
      const conversations = remaining.length ? remaining : [createConversation()];
      return {
        conversations,
        activeConversationId: state.activeConversationId === id ? conversations[0].id : state.activeConversationId,
      };
    }),
  };
}, {
  name: 'clarity-workspace-v1',
  storage: createJSONStorage(() => localStorage),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<AppState>;
    const documents = Object.fromEntries(Object.entries(persisted.documents ?? {}).map(([id, document]) => {
      if (document.status === 'ready' || document.status === 'error') return [id, document];
      return [id, {
        ...document,
        status: document.text ? 'ready' as const : 'error' as const,
        error: document.text ? undefined : 'We could not finish reading this file. Remove it and upload it again.',
        indexProgress: undefined,
      }];
    }));
    // Upload/indexing are transient states. Recover interrupted records after a
    // reload; query-time retrieval rebuilds any index that was not committed.
    return { ...currentState, ...persisted, documents };
  },
  partialize: (state) => ({ documents: state.documents, conversations: state.conversations, activeConversationId: state.activeConversationId }) as AppState,
}));

export const selectActiveConversation = (state: AppState) => state.conversations.find((conversation) => conversation.id === state.activeConversationId) ?? state.conversations[0];
