export interface FileSystemInterface {
    writeFile(key: string, data: Blob): Promise<void>;
    readFile(key: string): Promise<Blob | null>;
    deleteFile(key: string): Promise<void>;
    listFiles(): Promise<string[]>;
}

const DB_NAME = 'telemetriq';
const STORE_NAME = 'files';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export class BrowserFileSystem implements FileSystemInterface {
    async writeFile(key: string, data: Blob): Promise<void> {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put({ key, data, updatedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }

    async readFile(key: string): Promise<Blob | null> {
        const db = await openDb();
        const result = await new Promise<Blob | null>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(key);
            request.onsuccess = () => {
                resolve(request.result?.data ?? null);
            };
            request.onerror = () => reject(request.error);
        });
        db.close();
        return result;
    }

    async deleteFile(key: string): Promise<void> {
        const db = await openDb();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        db.close();
    }

    async listFiles(): Promise<string[]> {
        const db = await openDb();
        const result = await new Promise<string[]>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).getAllKeys();
            request.onsuccess = () => resolve(request.result as string[]);
            request.onerror = () => reject(request.error);
        });
        db.close();
        return result;
    }
}
