import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import OfflinePageControl from "./offline-page-control";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { titleEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { bodySaveStateAtom, titleSaveStateAtom } from "@/features/personal/save-status";
import { getPageById } from "@/features/page/services/page-service";
import { getOfflinePage, offlineEnabled, storeOfflineSnapshot, updateOfflinePage, type OfflinePage } from "./offline-store";

vi.mock("@/features/page/services/page-service", () => ({ getPageById: vi.fn() }));
vi.mock("./offline-store", async (load) => ({ ...await load<object>(),
  offlineEnabled: vi.fn(), getOfflinePage: vi.fn(), putOfflinePage: vi.fn(), storeOfflineSnapshot: vi.fn(), updateOfflinePage: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let local: OfflinePage;
beforeEach(() => {
  vi.clearAllMocks();
  local = { key: "account:workspace:page", accountId: "account", workspaceId: "workspace", userId: "profile", pageId: "page", title: "Original", baseTitle: "Original", baseUpdatedAt: "2026-10-18T00:00:00.123Z", pendingBody: false, pendingTitle: false } as OfflinePage;
  vi.mocked(offlineEnabled).mockReturnValue(true);
  vi.mocked(storeOfflineSnapshot).mockResolvedValue(undefined);
  vi.mocked(getOfflinePage).mockImplementation(async () => local);
  vi.mocked(updateOfflinePage).mockImplementation(async (_key, update) => { local = update(local); return local; });
  vi.mocked(getPageById).mockResolvedValue({ id: "page", workspaceId: "workspace", title: "Original", updatedAt: "2026-10-18T00:00:00.123Z", permissions: { canEdit: true } } as any);
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(() => cleanup());
function fixture() {
  const store = createStore();
  store.set(currentUserAtom, { accountId: "account", user: { id: "profile" }, workspace: { id: "workspace" } } as any);
  store.set(titleEditorAtom, { isDestroyed: false, getText: () => "Draft title" } as any);
  store.set(bodySaveStateAtom, { pageId: "page", state: "saving" });
  store.set(titleSaveStateAtom, { pageId: "page", state: "saving" });
  const doc = new Y.Doc(); doc.getText("body").insert(0, "existing"); local.snapshot = Y.encodeStateAsUpdate(doc);
  vi.spyOn(doc, "on");
  function Location() { const location = useLocation(); return <output>{location.pathname}</output>; }
  render(<Provider store={store}><MantineProvider><MemoryRouter initialEntries={["/s/test/p/page"]}>
    <OfflinePageControl pageId="page" provider={{ document: doc } as any} /><Location />
  </MemoryRouter></MantineProvider></Provider>);
  return doc;
}
describe("selected normal document survives connection loss", () => {
  it("durably queues CRDT changes before the server confirms a commit", async () => {
    const doc = fixture(); await screen.findByText("Available on this device");
    await waitFor(() => expect(doc.on).toHaveBeenCalledWith("update", expect.any(Function)));
    act(() => doc.getText("body").insert(0, "pending "));
    await waitFor(() => expect(storeOfflineSnapshot).toHaveBeenCalled());
    const calls = vi.mocked(storeOfflineSnapshot).mock.calls;
    const snapshot = calls[calls.length - 1][1];
    const restored = new Y.Doc(); Y.applyUpdate(restored, snapshot);
    expect(restored.getText("body").toString()).toBe("pending existing");
    restored.destroy(); doc.destroy();
  });
  it("stores current body and unsent title before opening the dedicated offline editor", async () => {
    const doc = fixture(); await screen.findByText("Available on this device");
    await waitFor(() => expect(doc.on).toHaveBeenCalledWith("update", expect.any(Function)));
    await act(async () => window.dispatchEvent(new Event("offline")));
    await screen.findByText("/offline");
    expect(local.pendingBody).toBe(true); expect(local.pendingTitle).toBe(true); expect(local.title).toBe("Draft title");
    doc.destroy();
  });
  it("keeps the current editor open when entering the offline copy cannot flush pending edits", async () => {
    const doc = fixture(); await screen.findByText("Available on this device");
    await waitFor(() => expect(doc.on).toHaveBeenCalledWith("update", expect.any(Function)));
    vi.mocked(storeOfflineSnapshot).mockRejectedValue(new Error("QuotaExceededError"));
    vi.mocked(updateOfflinePage).mockRejectedValue(new Error("QuotaExceededError"));
    act(() => doc.getText("body").insert(0, "RAM-only change "));
    await screen.findByText("Could not save on this device");
    fireEvent.click(screen.getByText("Open offline copy"));
    await screen.findByText("Could not save pending changes on this device. Keep this page open and try again before leaving.");
    expect(screen.getByText("/s/test/p/page")).toBeTruthy();
    expect(screen.queryByText("/offline")).toBeNull();
    expect(doc.isDestroyed).toBe(false);
    expect(doc.getText("body").toString()).toBe("RAM-only change existing");
    doc.destroy();
  });
  it("flushes the current body and title before a successful manual offline navigation", async () => {
    const doc = fixture(); await screen.findByText("Available on this device");
    await waitFor(() => expect(doc.on).toHaveBeenCalledWith("update", expect.any(Function)));
    fireEvent.click(screen.getByText("Open offline copy"));
    await screen.findByText("/offline");
    expect(local.pendingBody).toBe(true);
    expect(local.pendingTitle).toBe(true);
    expect(local.title).toBe("Draft title");
    doc.destroy();
  });
  it("does not persist normal editing when offline storage is disabled", async () => {
    vi.mocked(offlineEnabled).mockReturnValue(false);
    const doc = fixture(); await screen.findByText("Install and offline");
    act(() => doc.getText("body").insert(0, "not opted in "));
    expect(storeOfflineSnapshot).not.toHaveBeenCalled();
    doc.destroy();
  });
});
