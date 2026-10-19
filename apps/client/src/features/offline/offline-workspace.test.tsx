import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import OfflineWorkspace from "./offline-workspace";
import { authorizeOfflinePage, syncOfflineTitle } from "./offline-access";
import { flushOfflineWrites, getOfflinePage, listOfflinePages, lockOfflineData, offlineEnabled, offlineLocked, putOfflinePage, removeOfflinePage, type OfflinePage } from "./offline-store";
import { bodySaveStateAtom } from "@/features/personal/save-status";

const transport = vi.hoisted(() => ({ sockets: [] as any[], rooms: [] as any[] }));
vi.mock("@hocuspocus/provider", () => ({
  HocuspocusProviderWebsocket: class {
    status = "disconnected";
    shouldConnect = false;
    connect = vi.fn(async () => {
      this.status = "connected";
      for (const room of transport.rooms) if (room.configuration.websocketProvider === this) {
        room.isSynced = true; room.configuration.onStatus({ status: "connected" });
      }
    });
    disconnect = vi.fn(() => { this.status = "disconnected"; });
    destroy = vi.fn();
    constructor() { transport.sockets.push(this); }
  },
  HocuspocusProvider: class {
    isSynced = false;
    configuration: any;
    document: Y.Doc;
    attach = vi.fn();
    destroy = vi.fn();
    constructor(options: any) { this.configuration = options; this.document = options.document; transport.rooms.push(this); }
  },
}));
vi.mock("@/features/editor/page-editor", async () => {
  const React = await import("react");
  const { HocuspocusRoomContext } = await import("@hocuspocus/provider-react");
  return { CollabPageEditor: () => {
    const { provider } = React.useContext(HocuspocusRoomContext);
    return <button onClick={() => provider.document.getText("test").insert(0, "local edit ")}>Edit restored body</button>;
  } };
});
vi.mock("@/features/editor/components/transclusion/transclusion-lookup-context", () => ({ TransclusionLookupProvider: ({ children }) => children }));
vi.mock("./offline-settings", () => ({ default: () => <div>Settings</div> }));
vi.mock("./offline-access", () => ({ authorizeOfflinePage: vi.fn(), syncOfflineTitle: vi.fn(), readOfflineCommittedPage: vi.fn() }));
vi.mock("./offline-store", () => ({ OFFLINE_CHANGED: "offline-changed", getOfflinePage: vi.fn(), listOfflinePages: vi.fn(), offlineEnabled: vi.fn(), offlineLocked: vi.fn(), lockOfflineData: vi.fn(), flushOfflineWrites: vi.fn(), registerOfflineFlusher: () => () => {}, registerOfflineRecoverySource: () => () => {}, offlineAccount: () => "account", putOfflinePage: vi.fn(), removeOfflinePage: vi.fn() }));
vi.mock("@/lib/config", () => ({ getCollaborationUrl: () => "wss://docs.example/collab", isPersonalMode: () => true }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let local: OfflinePage;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function access() { return { identity: {} as any, page: { title: "Original", updatedAt: "2026-10-18T00:00:00.123Z" } as any, token: "memory-only" }; }
beforeEach(() => {
  vi.clearAllMocks(); transport.sockets.length = 0; transport.rooms.length = 0;
  const doc = new Y.Doc(); doc.getText("test").insert(0, "existing body");
  local = { key: "account:workspace:page", accountId: "account", workspaceId: "workspace", userId: "profile", pageId: "page",
    title: "Original", baseTitle: "Original", baseUpdatedAt: "2026-10-18T00:00:00.123Z", snapshot: Y.encodeStateAsUpdate(doc), pendingBody: true, pendingTitle: false, savedAt: Date.now() };
  doc.destroy();
  vi.mocked(getOfflinePage).mockImplementation(async () => local);
  vi.mocked(listOfflinePages).mockImplementation(async () => [local]);
  vi.mocked(offlineEnabled).mockReturnValue(true);
  vi.mocked(offlineLocked).mockReturnValue(false);
  vi.mocked(flushOfflineWrites).mockResolvedValue(undefined);
  vi.mocked(lockOfflineData).mockImplementation(() => {
    vi.mocked(offlineEnabled).mockReturnValue(false); vi.mocked(offlineLocked).mockReturnValue(true);
    window.dispatchEvent(new Event("offline-changed"));
  });
  vi.mocked(putOfflinePage).mockImplementation(async (next) => { local = next; return next; });
  vi.mocked(authorizeOfflinePage).mockResolvedValue(access());
  vi.mocked(syncOfflineTitle).mockResolvedValue({ pageId: "page", title: "Original", updatedAt: "2026-10-18T00:00:01.000Z", saved: true });
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request: vi.fn(async (_name, _options, callback) => callback({ name: "lease" })) } });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(() => cleanup());
function fixture() {
  const store = createStore(); store.set(bodySaveStateAtom, { pageId: "page", state: "saving" });
  function Location() { return <output data-testid="location">{useLocation().pathname}</output>; }
  render(<Provider store={store}><MantineProvider><MemoryRouter initialEntries={["/offline?page=account%3Aworkspace%3Apage"]}><OfflineWorkspace /><Location /></MemoryRouter></MantineProvider></Provider>);
  return store;
}

describe("real offline document session", () => {
  it.each(["Sign in again", "Back to workspace", "Install and offline"])("keeps RAM edits and blocks %s navigation if the last local flush fails", async (button) => {
    vi.mocked(authorizeOfflinePage).mockReturnValue(new Promise(() => {}));
    fixture(); fireEvent.click(await screen.findByRole("button", { name: "Edit restored body" }));
    await waitFor(() => expect(local.pendingBody).toBe(true));
    act(() => lockOfflineData());
    vi.mocked(flushOfflineWrites).mockRejectedValue(new Error("QuotaExceededError"));
    fireEvent.click(screen.getByRole("button", { name: button }));
    await screen.findByText("Could not save pending changes on this device. Keep this page open and try again before leaving.");
    expect(screen.getByTestId("location").textContent).toBe("/offline");
    expect(transport.rooms[0].destroy).not.toHaveBeenCalled();
    expect(transport.rooms[0].document.getText("test").toString()).toBe("local edit existing body");
  });
  it("restores Yjs edits and stores new changes without connecting before authorization", async () => {
    const gate = deferred<ReturnType<typeof access>>(); vi.mocked(authorizeOfflinePage).mockReturnValue(gate.promise);
    fixture();
    fireEvent.click(await screen.findByRole("button", { name: "Edit restored body" }));
    await waitFor(() => expect(putOfflinePage).toHaveBeenCalled());
    const restored = new Y.Doc(); Y.applyUpdate(restored, local.snapshot);
    expect(restored.getText("test").toString()).toBe("local edit existing body"); restored.destroy();
    expect(local.pendingBody).toBe(true);
    expect(transport.sockets[0].connect).not.toHaveBeenCalled();
    await act(async () => { gate.resolve(access()); });
    await waitFor(() => expect(transport.sockets[0].connect).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Saved")).toBeNull();
    expect(local.pendingBody).toBe(true); // WS sync cannot clear durable pending edits.
  });
  it("clears pending body only after the database save hook confirms the current document", async () => {
    const store = fixture();
    await screen.findByRole("button", { name: "Edit restored body" });
    await waitFor(() => expect(transport.sockets[0].connect).toHaveBeenCalled());
    expect(local.pendingBody).toBe(true);
    act(() => store.set(bodySaveStateAtom, { pageId: "page", state: "saved" }));
    await waitFor(() => expect(local.pendingBody).toBe(false));
    await screen.findByText("Saved");
  });
  it("purges a removed document and never connects its Yjs state", async () => {
    vi.mocked(authorizeOfflinePage).mockRejectedValue({ response: { status: 404 } });
    fixture();
    await screen.findByText("This document is no longer available offline. Sign in and check access again.");
    expect(removeOfflinePage).toHaveBeenCalledWith(local.key);
    expect(transport.sockets[0].connect).not.toHaveBeenCalled();
  });
  it("locks and preserves pending changes on 401, sends nothing, and restores them after same-owner reauthentication", async () => {
    vi.mocked(authorizeOfflinePage).mockRejectedValue({ response: { status: 401 } });
    fixture();
    await screen.findByText("Offline documents are locked. Sign in again with the same account to recover your pending changes.");
    expect(removeOfflinePage).not.toHaveBeenCalled();
    expect(local.pendingBody).toBe(true);
    expect(transport.sockets[0].connect).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Edit restored body" })).toBeNull();
    vi.mocked(authorizeOfflinePage).mockReturnValue(new Promise(() => {}));
    vi.mocked(offlineLocked).mockReturnValue(false); vi.mocked(offlineEnabled).mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("offline-changed")));
    await screen.findByRole("button", { name: "Edit restored body" });
    expect(transport.rooms[0].document.getText("test").toString()).toBe("existing body");
    expect(local.pendingBody).toBe(true);
  });
  it("keeps edits typed while an older title request is in flight", async () => {
    local = { ...local, title: "Draft one", pendingTitle: true };
    const titleRequest = deferred<Awaited<ReturnType<typeof syncOfflineTitle>>>();
    vi.mocked(syncOfflineTitle).mockReturnValue(titleRequest.promise);
    fixture();
    await waitFor(() => expect(syncOfflineTitle).toHaveBeenCalled());
    fireEvent.change(screen.getByRole("textbox", { name: "Page title" }), { target: { value: "Draft two" } });
    await act(async () => { titleRequest.resolve({ pageId: "page", title: "Draft one", updatedAt: "2026-10-18T00:00:01.000Z", saved: true }); });
    await waitFor(() => expect(transport.sockets[0].connect).toHaveBeenCalled());
    expect(local.title).toBe("Draft two"); expect(local.pendingTitle).toBe(true); expect(local.baseTitle).toBe("Draft one");
  });
  it("retains local title on conflict and requires an explicit conflict choice", async () => {
    local = { ...local, title: "Local draft", pendingTitle: true };
    vi.mocked(syncOfflineTitle).mockRejectedValue({ response: { status: 409, data: { title: "Remote draft", updatedAt: "2026-10-18T00:00:01.000Z" } } });
    fixture();
    await screen.findByText("The title changed on another device. Your local title has been kept.");
    expect(local.title).toBe("Local draft"); expect(local.pendingTitle).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Use server title" }));
    await waitFor(() => expect(local.title).toBe("Remote draft"));
    expect(local.pendingTitle).toBe(false);
  });
  it("blocks the editor immediately when another tab revokes the account's local storage", async () => {
    fixture(); await screen.findByRole("button", { name: "Edit restored body" });
    vi.mocked(offlineEnabled).mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("storage")));
    await screen.findByText("This document is no longer available offline. Sign in and check access again.");
    expect(transport.sockets[0].disconnect).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Edit restored body" })).toBeNull();
  });
  it("merges a normal tab's queued CRDT into the open offline editor without reconnecting", async () => {
    fixture(); await screen.findByRole("button", { name: "Edit restored body" });
    await waitFor(() => expect(transport.sockets[0].connect).toHaveBeenCalledTimes(1));
    const otherTab = new Y.Doc(); Y.applyUpdate(otherTab, local.snapshot);
    otherTab.getText("test").insert(0, "other-tab edit ");
    local = { ...local, snapshot: Y.encodeStateAsUpdate(otherTab), pendingBody: true };
    act(() => window.dispatchEvent(new Event("offline-changed")));
    await waitFor(() => expect(transport.rooms[0].document.getText("test").toString()).toBe("other-tab edit existing body"));
    expect(transport.sockets[0].connect).toHaveBeenCalledTimes(1);
    expect(local.pendingBody).toBe(true);
    otherTab.destroy();
  });
});
