import type { StoredMedia } from "@/lib/types";

const DB_NAME = "genesisai-library";
const STORE_NAME = "media";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadMedia(): Promise<StoredMedia[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      const media = (request.result as StoredMedia[]).sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      resolve(media);
      db.close();
    };
    request.onerror = () => {
      reject(request.error);
      db.close();
    };
  });
}

export async function saveMedia(item: StoredMedia): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(item);
    transaction.oncomplete = () => {
      resolve();
      db.close();
    };
    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}

export async function removeMedia(id: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      resolve();
      db.close();
    };
    transaction.onerror = () => {
      reject(transaction.error);
      db.close();
    };
  });
}
