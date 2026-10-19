import { afterEach, describe, expect, it, vi } from "vitest";
import { readDeviceStorage, requestDevicePersistence } from "./device-storage";

const original = Object.getOwnPropertyDescriptor(navigator, "storage");
afterEach(() => { if (original) Object.defineProperty(navigator, "storage", original); else Reflect.deleteProperty(navigator, "storage"); });
describe("device storage protection", () => {
  it("handles browsers without the storage API", async () => {
    Object.defineProperty(navigator, "storage", { configurable: true, value: undefined });
    expect(await requestDevicePersistence()).toEqual({ supported: false, persistent: false });
  });
  it("reports a denied request as best effort and keeps the measured quota", async () => {
    const persist = vi.fn(async () => false);
    Object.defineProperty(navigator, "storage", { configurable: true, value: {
      persist, persisted: async () => false, estimate: async () => ({ usage: 42, quota: 100 }),
    } });
    expect(await readDeviceStorage()).toEqual({ supported: true, persistent: false, usage: 42, quota: 100 });
    expect(persist).not.toHaveBeenCalled();
    expect((await requestDevicePersistence()).persistent).toBe(false);
    expect(persist).toHaveBeenCalledTimes(1);
  });
  it("rechecks the granted state instead of assuming protection", async () => {
    let granted = false;
    Object.defineProperty(navigator, "storage", { configurable: true, value: {
      persist: async () => { granted = true; return true; }, persisted: async () => granted,
    } });
    expect((await requestDevicePersistence()).persistent).toBe(true);
  });
});
