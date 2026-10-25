import { env, pipeline, type FeatureExtractionPipeline, type ProgressInfo } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/multilingual-e5-small';
const BATCH_SIZE = 16;

interface EmbeddingRequest {
  id: number;
  kind: 'query' | 'passage';
  texts: string[];
}

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<EmbeddingRequest>) => void): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

const workerScope = self as unknown as WorkerScope;
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let activeRequestId = 0;
let jobQueue = Promise.resolve();

function getExtractor() {
  if (!extractorPromise) {
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      progress_callback: (progress: ProgressInfo) => {
        if (progress.status === 'progress_total') {
          workerScope.postMessage({ id: activeRequestId, type: 'progress', progress: { stage: 'model', progress: progress.progress } });
        } else if (progress.status === 'ready') {
          workerScope.postMessage({ id: activeRequestId, type: 'progress', progress: { stage: 'model', progress: 100 } });
        }
      },
    });
  }
  return extractorPromise;
}

async function createEmbeddings(request: EmbeddingRequest) {
  activeRequestId = request.id;
  try {
    const extractor = await getExtractor();
    const vectors: Float32Array[] = [];
    for (let start = 0; start < request.texts.length; start += BATCH_SIZE) {
      const batch = request.texts.slice(start, start + BATCH_SIZE);
      const input = batch.map((text) => `${request.kind}: ${text}`);
      const output = await extractor(input, { pooling: 'mean', normalize: true });
      const values = output.tolist();
      if (!Array.isArray(values) || values.some((value) => !Array.isArray(value))) {
        throw new Error('The embedding model returned an invalid vector.');
      }
      vectors.push(...(values as number[][]).map((value) => Float32Array.from(value)));
      workerScope.postMessage({
        id: request.id,
        type: 'progress',
        progress: { stage: 'embedding', progress: Math.round(Math.min(100, ((start + batch.length) / request.texts.length) * 100)) },
      });
    }
    workerScope.postMessage({ id: request.id, type: 'result', vectors }, vectors.map((vector) => vector.buffer));
  } catch (error) {
    if (extractorPromise && !(await extractorPromise.then(() => true, () => false))) extractorPromise = null;
    workerScope.postMessage({ id: request.id, type: 'error', error: error instanceof Error ? error.message : 'Local embeddings could not be generated.' });
  }
}

workerScope.addEventListener('message', (event) => {
  const request = event.data;
  jobQueue = jobQueue.then(() => createEmbeddings(request));
});
