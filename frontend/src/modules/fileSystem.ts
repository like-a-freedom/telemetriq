export interface FileSystemInterface {
    writeFile(key: string, data: Blob): Promise<void>;
    readFile(key: string): Promise<Blob | null>;
    deleteFile(key: string): Promise<void>;
    listFiles(): Promise<string[]>;
}

const DB_NAME = 'telemetriq';
const STORE_NAME = 'files';
const DB_VERSION = 1;
const OPFS_FILE_PREFIX = 'tmq-fs-';

function hasIndexedDb(): boolean {
    return typeof indexedDB !== 'undefined';
}

function hasOpfsSupport(): boolean {
    return typeof navigator !== 'undefined'
        && typeof navigator.storage?.getDirectory === 'function';
}

function toOpfsFileName(key: string): string {
    return `${OPFS_FILE_PREFIX}${encodeURIComponent(key)}`;
}

function fromOpfsFileName(name: string): string | null {
    if (!name.startsWith(OPFS_FILE_PREFIX)) return null;

    try {
        return decodeURIComponent(name.slice(OPFS_FILE_PREFIX.length));
    } catch {
        return null;
    }
}

function isNotFoundError(error: unknown): boolean {
    return (error instanceof DOMException && error.name === 'NotFoundError')
        || (error instanceof Error && error.name === 'NotFoundError');
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle | null> {
    if (!hasOpfsSupport()) return null;

    try {
        return await navigator.storage.getDirectory();
    } catch {
        return null;
    }
}

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

async function writeFileToIndexedDb(key: string, data: Blob): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ key, data, updatedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function readFileFromIndexedDb(key: string): Promise<Blob | null> {
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

async function deleteFileFromIndexedDb(key: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function listFilesFromIndexedDb(): Promise<string[]> {
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

async function writeFileToOpfs(root: FileSystemDirectoryHandle, key: string, data: Blob): Promise<void> {
    const fileHandle = await root.getFileHandle(toOpfsFileName(key), { create: true });
    const writable = await fileHandle.createWritable({ keepExistingData: false });

    try {
        await writable.write(data);
    } finally {
        await writable.close();
    }
}

async function readFileFromOpfs(root: FileSystemDirectoryHandle, key: string): Promise<Blob | null> {
    try {
        const fileHandle = await root.getFileHandle(toOpfsFileName(key));
        return await fileHandle.getFile();
    } catch (error) {
        if (isNotFoundError(error)) {
            return null;
        }

        throw error;
    }
}

async function deleteFileFromOpfs(root: FileSystemDirectoryHandle, key: string): Promise<void> {
    try {
        await root.removeEntry(toOpfsFileName(key));
    } catch (error) {
        if (!isNotFoundError(error)) {
            throw error;
        }
    }
}

async function listFilesFromOpfs(root: FileSystemDirectoryHandle): Promise<string[]> {
    const names: string[] = [];
    const entries = root as FileSystemDirectoryHandle & {
        entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    };

    for await (const [name] of entries.entries()) {
        const decoded = fromOpfsFileName(name);
        if (decoded) {
            names.push(decoded);
        }
    }

    return names;
}

export class BrowserFileSystem implements FileSystemInterface {
    async writeFile(key: string, data: Blob): Promise<void> {
        const opfsRoot = await getOpfsRoot();
        if (opfsRoot) {
            await writeFileToOpfs(opfsRoot, key, data);

            if (hasIndexedDb()) {
                await deleteFileFromIndexedDb(key).catch(() => {
                    // best-effort legacy cleanup
                });
            }

            return;
        }

        if (!hasIndexedDb()) {
            throw new Error('No persistent browser file storage backend is available');
        }

        await writeFileToIndexedDb(key, data);
    }

    async readFile(key: string): Promise<Blob | null> {
        const opfsRoot = await getOpfsRoot();
        if (opfsRoot) {
            const opfsFile = await readFileFromOpfs(opfsRoot, key);
            if (opfsFile) {
                return opfsFile;
            }
        }

        if (!hasIndexedDb()) {
            return null;
        }

        return readFileFromIndexedDb(key);
    }

    async deleteFile(key: string): Promise<void> {
        const opfsRoot = await getOpfsRoot();
        if (opfsRoot) {
            await deleteFileFromOpfs(opfsRoot, key);
        }

        if (!hasIndexedDb()) {
            return;
        }

        await deleteFileFromIndexedDb(key);
    }

    async listFiles(): Promise<string[]> {
        const names = new Set<string>();
        const opfsRoot = await getOpfsRoot();

        if (opfsRoot) {
            for (const name of await listFilesFromOpfs(opfsRoot)) {
                names.add(name);
            }
        }

        if (hasIndexedDb()) {
            for (const name of await listFilesFromIndexedDb()) {
                names.add(name);
            }
        }

        return [...names];
    }
}
