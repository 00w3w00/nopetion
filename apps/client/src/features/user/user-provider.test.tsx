// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createStore, Provider, useAtomValue } from "jotai";
import { currentUserAtom, userAtom, workspaceAtom } from "./atoms/current-user-atom";
import { UserProvider } from "./user-provider";
import { acceptOfflineAccount, enableOffline, lockOfflineData, registerOfflineFlusher } from "@/features/offline/offline-store";

const fixture = vi.hoisted(() => ({ data: null as any, refetch: vi.fn() }));
vi.mock("./hooks/use-current-user", () => ({ default: () => ({ data: fixture.data, isLoading: false, refetch: fixture.refetch }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "ko-KR", changeLanguage: vi.fn() } }) }));
vi.mock("socket.io-client", () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
vi.mock("@/features/websocket/use-query-subscription", () => ({ useQuerySubscription: vi.fn() }));
vi.mock("@/features/websocket/use-tree-socket", () => ({ useTreeSocket: vi.fn() }));
vi.mock("@/features/notification/hooks/use-notification-socket", () => ({ useNotificationSocket: vi.fn() }));
vi.mock("@/features/auth/queries/auth-query", () => ({ useCollabToken: () => ({}) }));
vi.mock("@/lib/config", () => ({ isPersonalMode: () => true }));

afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); });

describe("authenticated account readiness", () => {
  it("keeps an already mounted RAM editor hidden on auth lock and blocks manual navigation when flushing fails", async () => {
    await acceptOfflineAccount("owner"); enableOffline("owner");
    fixture.data = { accountId: "owner", user: { id: "owner", locale: "ko-KR" }, workspace: { id: "workspace" } };
    const store = createStore(); store.set(currentUserAtom, fixture.data);
    let mounts = 0, unmounts = 0;
    function Sentinel() { useEffect(() => { mounts++; return () => { unmounts++; }; }, []); return <input aria-label="RAM editor" defaultValue="unsaved RAM text" />; }
    function Location() { return <output data-testid="provider-location">{useLocation().pathname}</output>; }
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
    const unregister = registerOfflineFlusher(async () => { throw new Error("QuotaExceededError"); });
    try {
      render(<MantineProvider><MemoryRouter initialEntries={["/home"]}><Provider store={store}><UserProvider><Sentinel /></UserProvider><Location /></Provider></MemoryRouter></MantineProvider>);
      const original = screen.getByRole("textbox", { name: "RAM editor" });
      act(() => lockOfflineData());
      expect(original.isConnected).toBe(true); expect(mounts).toBe(1); expect(unmounts).toBe(0);
      expect(screen.queryByRole("textbox", { name: "RAM editor" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
      await screen.findByText("Could not save pending changes on this device. Keep this page open and try again before leaving.");
      expect(screen.getByTestId("provider-location").textContent).toBe("/home");
      expect(original.isConnected).toBe(true); expect(unmounts).toBe(0);
    } finally { unregister(); }
  });
  it("keeps cached consumers hidden until a new canonical authentication check completes", async () => {
    await acceptOfflineAccount("owner"); enableOffline("owner"); lockOfflineData();
    fixture.data = { accountId: "owner", user: { id: "owner", locale: "ko-KR" }, workspace: { id: "workspace" } };
    const store = createStore(); store.set(currentUserAtom, fixture.data);
    let complete!: () => void;
    fixture.refetch.mockReturnValue(new Promise<void>((resolve) => { complete = resolve; }));
    Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
    render(<MantineProvider><MemoryRouter><Provider store={store}><UserProvider><span>cached document</span></UserProvider></Provider></MemoryRouter></MantineProvider>);
    expect(screen.queryByText("cached document")).toBeNull(); expect(fixture.refetch).toHaveBeenCalled();
    await act(async () => { await acceptOfflineAccount("owner"); });
    expect(screen.queryByText("cached document")).toBeNull();
    await act(async () => { complete(); });
    await waitFor(() => expect(screen.getByText("cached document")).toBeTruthy());
  });
  it.each([null, { user: { id: "old-user" }, workspace: { id: "old-workspace" } }])(
    "renders document consumers only after the verified identity replaces %p",
    initial => {
      sessionStorage.clear();
      const store = createStore();
      store.set(currentUserAtom, initial as any);
      fixture.data = { user: { id: "owner", locale: "ko-KR", settings: { preferences: { fullPageWidth: true } } }, workspace: { id: "selected-workspace" } };
      const observed: string[] = [];
      function DocumentConsumer() {
        const user = useAtomValue(userAtom);
        const workspace = useAtomValue(workspaceAtom);
        // Match the editor's assumption: its parent has authenticated both.
        observed.push(`${user.id}:${workspace.id}`);
        return <span>{user.settings.preferences.fullPageWidth ? "wide document" : "document"}</span>;
      }
      render(<Provider store={store}><UserProvider><DocumentConsumer /></UserProvider></Provider>);
      expect(screen.getByText("wide document")).toBeTruthy();
      expect(observed.length).toBeGreaterThan(0);
      expect(observed.every(identity => identity === "owner:selected-workspace")).toBe(true);
    },
  );
});
