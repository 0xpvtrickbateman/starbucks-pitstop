const DEVICE_ID_STORAGE_KEY = "starbucks-pitstop-device-id";

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const nextId = window.crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextId);

  return nextId;
}
