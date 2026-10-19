import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { acceptOfflineAccount, clearOfflineData, enableOffline, getOfflinePage, listOfflinePages,
  offlineAccount, offlineEnabled, offlineKey, putOfflinePage, mergeOfflineSnapshot, lockOfflineData, offlineLocked, offlineWritable, type OfflinePage } from "./offline-store";

beforeEach(() => { localStorage.clear(); });
describe("offline storage account boundary", () => {
  it("is off by default and cannot read IndexedDB before consent", async () => {
    expect(offlineEnabled()).toBe(false);
    expect(await listOfflinePages()).toEqual([]);
    expect(await getOfflinePage("unscoped-page")).toBeUndefined();
  });
  it("requires a verified account before opt in", () => {
    expect(() => enableOffline("unverified")).toThrow("offlineAccountMismatch");
  });
  it("needs explicit opt in after a verified identity", async () => {
    await acceptOfflineAccount("one");
    expect(offlineEnabled()).toBe(false);
    enableOffline("one");
    expect(offlineEnabled()).toBe(true);
  });
  it("revokes offline storage on account changes", async () => {
    await acceptOfflineAccount("one"); enableOffline("one");
    await acceptOfflineAccount("two");
    expect(offlineAccount()).toBe("two");
    expect(offlineEnabled()).toBe(false);
    expect(await listOfflinePages()).toEqual([]);
  });
  it("locks reads while preserving consent and allowing the last matching-account write", async () => {
    await acceptOfflineAccount("one"); enableOffline("one"); lockOfflineData();
    expect(offlineLocked()).toBe(true); expect(offlineEnabled()).toBe(false);
    expect(await listOfflinePages()).toEqual([]); expect(await getOfflinePage("secret")).toBeUndefined();
    expect(offlineWritable("one")).toBe(true); expect(offlineWritable("two")).toBe(false);
    await acceptOfflineAccount("one");
    expect(offlineLocked()).toBe(false); expect(offlineEnabled()).toBe(true);
  });
  it("does not restore consent when a different owner unlocks the app", async () => {
    await acceptOfflineAccount("one"); enableOffline("one"); lockOfflineData();
    await acceptOfflineAccount("two");
    expect(offlineAccount()).toBe("two"); expect(offlineLocked()).toBe(false); expect(offlineEnabled()).toBe(false);
  });
  it("revokes storage synchronously when logging out", async () => {
    await acceptOfflineAccount("one"); enableOffline("one");
    const clearing = clearOfflineData();
    expect(offlineEnabled()).toBe(false);
    expect(offlineAccount()).toBeNull();
    await clearing;
  });
  it("cannot write another account's snapshot", async () => {
    await acceptOfflineAccount("one"); enableOffline("one");
    await expect(putOfflinePage({ accountId: "two" } as OfflinePage)).rejects.toThrow("offlineAccountMismatch");
  });
  it("isolates account, workspace and page without separator collisions", () => {
    expect(offlineKey("a:b", "c", "d")).not.toEqual(offlineKey("a", "b:c", "d"));
    expect(offlineKey("a", "workspace-one", "page")).not.toEqual(offlineKey("a", "workspace-two", "page"));
  });
  it("preserves a newer deletion from another tab and keeps it pending", () => {
    const original = new Y.Doc(); original.getText("body").insert(0, "abc");
    const deleted = new Y.Doc(); Y.applyUpdate(deleted, Y.encodeStateAsUpdate(original)); deleted.getText("body").delete(0, 1);
    const merged = mergeOfflineSnapshot({ snapshot: Y.encodeStateAsUpdate(deleted), pendingBody: true } as OfflinePage, Y.encodeStateAsUpdate(original), true);
    const restored = new Y.Doc(); Y.applyUpdate(restored, merged.snapshot);
    expect(restored.getText("body").toString()).toBe("bc");
    expect(merged.pendingBody).toBe(true);
    original.destroy(); deleted.destroy(); restored.destroy();
  });
  it("clears pending only when the committed state includes all locally queued changes", () => {
    const doc = new Y.Doc(); doc.getText("body").insert(0, "committed");
    const snapshot = Y.encodeStateAsUpdate(doc);
    expect(mergeOfflineSnapshot({ snapshot, pendingBody: true } as OfflinePage, snapshot, true).pendingBody).toBe(false);
    expect(mergeOfflineSnapshot({ snapshot, pendingBody: false } as OfflinePage, snapshot, false).pendingBody).toBe(true);
    doc.destroy();
  });
});
