import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useMarkAllReadMutation, useMarkReadMutation, useNotificationsQuery, useUnreadCountQuery } from "./notification-query";
const mock = vi.hoisted(() => ({ list: vi.fn(), count: vi.fn(), markRead: vi.fn(), markAll: vi.fn() }));
vi.mock("@/lib/config", () => ({ isPersonalMode: () => true }));
vi.mock("../services/notification-service", () => ({ getNotifications: mock.list, getUnreadCount: mock.count, markNotificationsRead: mock.markRead, markAllNotificationsRead: mock.markAll }));
const identity = (workspaceId: string) => ({ user: { id: "owner" }, workspace: { id: workspaceId } }) as any;
function fixture() {
  const store = createStore(); store.set(currentUserAtom, identity("first"));
  const client = new QueryClient({ defaultOptions: { queries: {
    retry: false, refetchOnMount: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000,
  }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <Provider store={store}><QueryClientProvider client={client}>{children}</QueryClientProvider></Provider>;
  return { store, client, wrapper };
}
beforeEach(() => { vi.clearAllMocks(); mock.count.mockResolvedValue({ count: 1 }); mock.markRead.mockResolvedValue(undefined); mock.markAll.mockResolvedValue(undefined); });
afterEach(() => { cleanup(); sessionStorage.clear(); focusManager.setFocused(undefined); });
describe("personal notification workspace scope", () => {
  it("recovers missed notifications on focus despite the app's disabled global focus refresh", async () => {
    let fresh = false;
    mock.list.mockImplementation(async () => ({ items: [{ id: fresh ? "new" : "old" }], meta: { hasNextPage: false } }));
    mock.count.mockImplementation(async () => ({ count: fresh ? 1 : 0 }));
    const { client, wrapper } = fixture();
    const { result, unmount } = renderHook(() => ({ list: useNotificationsQuery("all"), count: useUnreadCountQuery() }), { wrapper });
    await waitFor(() => expect(result.current.count.data?.count).toBe(0));
    await waitFor(() => expect(result.current.list.data?.pages[0].items[0].id).toBe("old"));
    act(() => focusManager.setFocused(false));
    fresh = true;
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(result.current.count.data?.count).toBe(1));
    expect(result.current.list.data?.pages[0].items[0].id).toBe("new");
    unmount(); client.clear();
  });
  it("refreshes a cached unread badge when returning without a WebSocket event", async () => {
    mock.count.mockResolvedValue({ count: 0 });
    const { client, wrapper } = fixture();
    const first = renderHook(useUnreadCountQuery, { wrapper });
    await waitFor(() => expect(first.result.current.data?.count).toBe(0));
    first.unmount();
    mock.count.mockResolvedValue({ count: 2 });
    const next = renderHook(useUnreadCountQuery, { wrapper });
    await waitFor(() => expect(next.result.current.data?.count).toBe(2));
    next.unmount(); client.clear();
  });
  it("does not show old workspace notifications while the next workspace loads", async () => {
    let release: (value: any) => void;
    mock.list.mockImplementation((_params, workspaceId) => workspaceId === "first"
      ? Promise.resolve({ items: [{ id: "first-item" }], meta: { hasNextPage: false } })
      : new Promise(resolve => { release = resolve; }));
    const { store, client, wrapper } = fixture();
    const { result, unmount } = renderHook(() => ({ list: useNotificationsQuery("all"), count: useUnreadCountQuery() }), { wrapper });
    await waitFor(() => expect(result.current.list.data?.pages[0].items[0].id).toBe("first-item"));
    expect(mock.list).toHaveBeenCalledWith({ cursor: undefined, type: "all" }, "first");
    expect(mock.count).toHaveBeenCalledWith("first");
    act(() => store.set(currentUserAtom, identity("second")));
    expect(result.current.list.data).toBeUndefined();
    await waitFor(() => expect(release).toBeTypeOf("function"));
    await act(async () => release({ items: [{ id: "second-item" }], meta: { hasNextPage: false } }));
    await waitFor(() => expect(result.current.list.data?.pages[0].items[0].id).toBe("second-item"));
    expect(mock.count).toHaveBeenCalledWith("second");
    unmount(); client.clear();
  });
  it("sends read mutations to the selected workspace without changing an earlier workspace", async () => {
    const { store, client, wrapper } = fixture();
    const { result, unmount } = renderHook(() => ({ read: useMarkReadMutation(), all: useMarkAllReadMutation() }), { wrapper });
    act(() => store.set(currentUserAtom, identity("second")));
    await act(async () => { await result.current.read.mutateAsync(["notification"]); await result.current.all.mutateAsync(); });
    expect(mock.markRead).toHaveBeenCalledWith(["notification"], "second");
    expect(mock.markAll).toHaveBeenCalledWith("second");
    unmount(); client.clear();
  });
});
