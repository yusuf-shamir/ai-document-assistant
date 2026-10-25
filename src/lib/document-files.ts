const DATABASE_NAME = 'extractordinaire-original-files';
const STORE_NAME = 'pdfs';
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local document storage.'));
  });
}

export async function saveOriginalPdf(id: string, file: File): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(file, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not store the PDF locally.'));
    });
  } finally {
    database.close();
  }
}

export async function getOriginalPdf(id: string): Promise<Blob | null> {
  const database = await openDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id) as IDBRequest<Blob | undefined>;
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error('Could not load the PDF.'));
    });
  } finally {
    database.close();
  }
}

export async function deleteOriginalPdf(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Could not remove the PDF.'));
    });
  } finally {
    database.close();
  }
}
