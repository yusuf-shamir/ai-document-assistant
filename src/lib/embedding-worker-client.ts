export type EmbeddingKind = 'query' | 'passage';

export interface EmbeddingProgress {
  stage: 'model' | 'embedding';
  progress: number;
}

interface WorkerProgressMessage {
  id: number;
  type: 'progress';
  progress: EmbeddingProgress;
}

interface WorkerResultMessage {
  id: number;
  type: 'result';
  vectors: Float32Array[];
}

interface WorkerErrorMessage {
  id: number;
  type: 'error';
  error: string;
}

type WorkerResponse = WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage;

interface PendingRequest {
  resolve: (vectors: Float32Array[]) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: EmbeddingProgress) => void;
}

let embeddingWorker: Worker | null = null;
let embeddingFailure: Error | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, PendingRequest>();

function getEmbeddingWorker() {
  if (typeof Worker === 'undefined') throw new Error('Browser workers are unavailable.');
  if (!embeddingWorker) {
    embeddingWorker = new Worker(new URL('./embedding.worker.ts', import.meta.url), {
      type: 'module',
      name: 'extractordinaire-embeddings',
    });
    embeddingWorker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const pending = pendingRequests.get(message.id);
      if (!pending) return;
      if (message.type === 'progress') {
        pending.onProgress?.(message.progress);
      } else if (message.type === 'result') {
        pendingRequests.delete(message.id);
        pending.resolve(message.vectors);
      } else {
        pendingRequests.delete(message.id);
        embeddingFailure = new Error(message.error);
        pending.reject(embeddingFailure);
      }
    });
    embeddingWorker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'The local embedding worker failed.');
      embeddingFailure = error;
      for (const pending of pendingRequests.values()) pending.reject(error);
      pendingRequests.clear();
      embeddingWorker?.terminate();
      embeddingWorker = null;
    });
  }
  return embeddingWorker;
}

export function createTextEmbeddings(
  texts: string[],
  kind: EmbeddingKind,
  onProgress?: (progress: EmbeddingProgress) => void,
): Promise<Float32Array[]> {
  if (texts.length === 0) return Promise.resolve([]);
  if (embeddingFailure) return Promise.reject(embeddingFailure);
  const worker = getEmbeddingWorker();
  const id = ++nextRequestId;
  return new Promise<Float32Array[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, kind, texts });
  });
}
