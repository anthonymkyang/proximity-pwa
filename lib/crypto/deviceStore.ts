const DB_NAME = "e2ee-store";
const DB_VERSION = 1;
const STORE_NAME = "devices";
const BUNDLE_STORE = "bundles";

type StoredDevice = {
  userId: string;
  deviceId: string;
  publicKey: string;
  privateKey: CryptoKey;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains(BUNDLE_STORE)) {
        db.createObjectStore(BUNDLE_STORE, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getDevice(userId: string): Promise<StoredDevice | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(userId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

export async function setDevice(device: StoredDevice): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(device);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearDevice(userId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(userId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

type RememberedBundle = {
  userId: string;
  backupKeyBase64: string;
  bundleJson: string;
};

export async function getRememberedBundle(
  userId: string
): Promise<RememberedBundle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BUNDLE_STORE, "readonly");
    const store = tx.objectStore(BUNDLE_STORE);
    const request = store.get(userId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

export async function setRememberedBundle(
  bundle: RememberedBundle
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BUNDLE_STORE, "readwrite");
    const store = tx.objectStore(BUNDLE_STORE);
    const request = store.put(bundle);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearRememberedBundle(userId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BUNDLE_STORE, "readwrite");
    const store = tx.objectStore(BUNDLE_STORE);
    const request = store.delete(userId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
