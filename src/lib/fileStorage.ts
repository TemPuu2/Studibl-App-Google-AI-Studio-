/**
 * Client-Side Binary File Storage Engine using IndexedDB.
 * This guarantees that uploaded materials (PDFs, DOCs, Text, Audio, Images)
 * are stored as raw Blobs in the browser's persistent storage, solving the
 * limitation where standard object URLs (blob:) expire upon screen unmount or reload.
 */

const DB_NAME = 'studibl_file_db';
const STORE_NAME = 'files';
const DB_VERSION = 1;

/**
 * Initializes the IndexedDB database.
 */
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Saves a File or Blob into IndexedDB with a specific ID.
 */
export async function saveFile(id: string, file: File | Blob): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file, id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves a File or Blob from IndexedDB by its ID.
 */
export async function getFile(id: string): Promise<Blob | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error retrieving file ${id} from IndexedDB:`, error);
    return null;
  }
}

/**
 * Deletes a file from IndexedDB by its ID.
 */
export async function deleteFile(id: string): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error(`Error deleting file ${id} from IndexedDB:`, error);
  }
}
