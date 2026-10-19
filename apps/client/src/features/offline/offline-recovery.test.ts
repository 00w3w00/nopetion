import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createOfflineRecovery } from "./offline-recovery";
import { acceptOfflineAccount, enableOffline, lockOfflineData, offlineKey, registerOfflineFlusher,
  registerOfflineRecoverySource, type OfflinePage } from "./offline-store";

const cleanup: Array<() => void> = [];
beforeEach(async () => { localStorage.clear(); await acceptOfflineAccount("owner"); enableOffline("owner"); });
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); });
function fixture(accountId = "owner") {
  const doc = new Y.Doc(), paragraph = new Y.XmlElement("paragraph"), text = new Y.XmlText();
  text.insert(0, "기기에만 남은 생각"); paragraph.insert(0, [text]); doc.getXmlFragment("default").insert(0, [paragraph]);
  cleanup.push(() => doc.destroy());
  const page: OfflinePage = {
    key: offlineKey(accountId, "workspace", "page"), accountId, workspaceId: "workspace", userId: "profile", pageId: "page",
    title: "내 기록", baseTitle: "원래 제목", baseUpdatedAt: "2026-10-19T00:00:00Z", savedAt: 0,
    snapshot: Y.encodeStateAsUpdate(doc), pendingBody: true, pendingTitle: true,
  };
  cleanup.push(registerOfflineRecoverySource(() => ({ ...page, snapshot: Y.encodeStateAsUpdate(doc) }), accountId));
  return { doc, text, page };
}
describe("private offline recovery downloads", () => {
  it("captures the latest RAM edit even when IndexedDB is unavailable and flushing fails", async () => {
    const { text } = fixture(); text.insert(text.length, " — 추가 편집");
    const flush = vi.fn(async () => { throw Error("QuotaExceededError"); });
    cleanup.push(registerOfflineFlusher(flush));
    const result = await createOfflineRecovery();
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].text).toContain("추가 편집");
    expect(flush).not.toHaveBeenCalled();
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Uint8Array.from(atob(result.documents[0].yjsUpdateBase64), c => c.charCodeAt(0)));
    expect(copy.getXmlFragment("default").toString()).toContain("추가 편집"); copy.destroy();
    expect(result.attachmentsIncluded).toBe(false);
  });
  it("never exports a different account or a locked session", async () => {
    fixture(); fixture("different-owner");
    expect((await createOfflineRecovery()).documents.map(p => p.accountId)).toEqual(["owner"]);
    lockOfflineData();
    await expect(createOfflineRecovery()).rejects.toThrow("offlineAccountMismatch");
  });
  it("excludes committed pages unless that exact copy is requested", async () => {
    const { page } = fixture(); page.pendingBody = false; page.pendingTitle = false;
    expect((await createOfflineRecovery()).documents).toHaveLength(0);
    expect((await createOfflineRecovery(page.key)).documents).toHaveLength(1);
  });
  it("checks the account again before releasing content", async () => {
    const { page } = fixture();
    cleanup.push(registerOfflineRecoverySource(() => { lockOfflineData(); return page; }, "owner"));
    await expect(createOfflineRecovery()).rejects.toThrow("offlineAccountMismatch");
  });
});
