const DB_NAME = "e2ee-store";
const DB_VERSION = 1;
const STORE_NAME = "devices";
const BUNDLE_STORE = "bundles";
const DEVICE_UUID_PREFIX = "e2ee:device-uuid:";

type StoredDevice = {
  userId: string;
  deviceId: string;
  deviceUuid: string;
  publicKey: string;
  privateKey: CryptoKey;
};

function generateDeviceUuid(): string {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function getStoredDeviceUuid(userId: string): string | null {
  try {
    return localStorage.getItem(`${DEVICE_UUID_PREFIX}${userId}`);
  } catch {
    return null;
  }
}

function setStoredDeviceUuid(userId: string, deviceUuid: string): void {
  try {
    localStorage.setItem(`${DEVICE_UUID_PREFIX}${userId}`, deviceUuid);
  } catch {
    // ignore storage failures
  }
}

export function getDeviceUuid(userId: string): string {
  const existing = getStoredDeviceUuid(userId);
  if (existing) return existing;
  const next = generateDeviceUuid();
  setStoredDeviceUuid(userId, next);
  return next;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      console.error("[e2ee] IndexedDB open failed", request.error);
      reject(request.error);
    };
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
    request.onsuccess = () => {
      const result = request.result ?? null;
      if (result && !result.deviceUuid) {
        const withUuid = { ...result, deviceUuid: getDeviceUuid(userId) };
        void setDevice(withUuid);
        resolve(withUuid);
        return;
      }
      resolve(result);
    };
  });
}

export async function setDevice(device: StoredDevice): Promise<void> {
  const next = device.deviceUuid
    ? device
    : { ...device, deviceUuid: getDeviceUuid(device.userId) };
  setStoredDeviceUuid(next.userId, next.deviceUuid);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(next);
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
    request.onerror = () => {
      console.error("[e2ee] bundle read failed", request.error);
      reject(request.error);
    };
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
    request.onerror = () => {
      console.error("[e2ee] bundle write failed", request.error);
      reject(request.error);
    };
    request.onsuccess = () => resolve();
  });
}

export async function clearRememberedBundle(userId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BUNDLE_STORE, "readwrite");
    const store = tx.objectStore(BUNDLE_STORE);
    const request = store.delete(userId);
    request.onerror = () => {
      console.error("[e2ee] bundle delete failed", request.error);
      reject(request.error);
    };
    request.onsuccess = () => resolve();
  });
}
