export const EMBEDDING_MODEL_ID = 'Xenova/multilingual-e5-small';

export interface SemanticPassage {
  name: string;
  location: string;
  text: string;
  vector: Float32Array;
}

interface StoredSemanticDocument {
  model: string;
  passages: SemanticPassage[];
}

const DATABASE_NAME = 'extractordinaire-semantic-index';
const STORE_NAME = 'documents';
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local semantic index.'));
  });
}

export async function saveSemanticDocument(documentId: string, passages: SemanticPassage[]): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const record: StoredSemanticDocument = { model: EMBEDDING_MODEL_ID, passages };
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record, documentId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not save the local semantic index.'));
    });
  } finally {
    database.close();
  }
}

export async function getSemanticDocument(documentId: string): Promise<SemanticPassage[] | null> {
  const database = await openDatabase();
  try {
    return await new Promise<SemanticPassage[] | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(documentId) as IDBRequest<StoredSemanticDocument | undefined>;
      request.onsuccess = () => {
        const record = request.result;
        resolve(record?.model === EMBEDDING_MODEL_ID ? record.passages : null);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not read the local semantic index.'));
    });
  } finally {
    database.close();
  }
}

export async function deleteSemanticDocument(documentId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(documentId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not remove the local semantic index.'));
    });
  } finally {
    database.close();
  }
}
