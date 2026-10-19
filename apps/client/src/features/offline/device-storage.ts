export interface DeviceStorageState {
  supported: boolean;
  persistent: boolean;
  usage?: number;
  quota?: number;
}

export async function readDeviceStorage(): Promise<DeviceStorageState> {
  const storage = navigator.storage;
  const [persistent, estimate] = await Promise.all([
    storage?.persisted ? storage.persisted() : false,
    storage?.estimate ? storage.estimate() : {},
  ]);
  return { supported: !!storage?.persist, persistent, ...estimate };
}

export async function requestDevicePersistence() {
  // A browser may deny this request. Never describe an ungranted request as protected.
  if (navigator.storage?.persist) await navigator.storage.persist();
  return readDeviceStorage();
}
