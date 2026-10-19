import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { createStore, Provider } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { NotificationItem } from "./notification-item";
import { NotificationList } from "./notification-list";
import { NotificationPopover } from "./notification-popover";
import NotificationPref from "@/features/user/components/notification-pref";
import { getNotificationLink } from "../notification.utils";
import type { INotification, NotificationType } from "../types/notification.types";

const mock = vi.hoisted(() => ({
  personal: true,
  items: [] as INotification[],
  hasNextPage: false,
  isError: false,
  count: 2,
  markRead: vi.fn(),
  markAll: vi.fn(),
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
  listQuery: vi.fn(),
}));
vi.mock("@/lib/config", () => ({ isPersonalMode: () => mock.personal }));
vi.mock("@/i18n.ts", () => ({ default: { t: (key: string) => key, language: "en-US" } }));
vi.mock("../queries/notification-query", () => ({
  useMarkReadMutation: () => ({ mutate: mock.markRead }),
  useMarkAllReadMutation: () => ({ mutate: mock.markAll }),
  useUnreadCountQuery: () => ({ data: { count: mock.count } }),
  useNotificationsQuery: (type: string) => {
    mock.listQuery(type);
    return { data: { pages: [{ items: mock.items }] }, isLoading: false,
      isError: mock.isError, hasNextPage: mock.hasNextPage, fetchNextPage: mock.fetchNextPage,
      isFetchingNextPage: false, refetch: mock.refetch };
  },
}));
vi.mock("@/components/ui/custom-avatar", () => ({ CustomAvatar: () => <span>avatar</span> }));
const language = createInstance();
await language.init({ lng: "en-US", resources: {}, interpolation: { escapeValue: false } });
const jobId = "11111111-1111-4111-8111-111111111111";
function notification(type: NotificationType = "ai.completed", updates: Partial<INotification> = {}): INotification {
  return { id: "notification-1", type, userId: "owner", workspaceId: "workspace", actorId: null,
    pageId: "page-1", spaceId: "space-1", commentId: null, data: { jobId }, readAt: null,
    emailedAt: null, archivedAt: null, createdAt: new Date().toISOString(), actor: null,
    page: { id: "page-1", title: "My page", slugId: "pageSlug", icon: null },
    space: { id: "space-1", name: "General", slug: "general" }, ...updates };
}
function view(element: React.ReactNode) {
  const store = createStore();
  store.set(currentUserAtom, { user: { id: "owner", settings: { notifications: {} } }, workspace: { id: "workspace" } } as any);
  return render(<Provider store={store}><MemoryRouter><MantineProvider env="test"><I18nextProvider i18n={language}>{element}</I18nextProvider></MantineProvider></MemoryRouter></Provider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.personal = true; mock.items = []; mock.hasNextPage = false; mock.isError = false; mock.count = 2;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

describe("personal inbox", () => {
  it.each([
    ["ai.completed", "AI finished writing to your page"],
    ["ai.failed", "AI could not finish this task"],
    ["ai.conflict", "AI result is ready for review"],
  ] as const)("shows %s and opens the exact AI task without exposing provider errors", (type, message) => {
    const navigate = vi.fn();
    view(<NotificationItem notification={notification(type, { data: { jobId, errorCode: "internal-provider-detail" } })} onNavigate={navigate} />);
    const link = screen.getByRole("link", { name: new RegExp(message) });
    expect(link.getAttribute("href")).toBe(`/s/general/p/my-page-pageSlug?aiJobId=${jobId}`);
    expect(link.querySelector("button")).toBeNull();
    expect(screen.queryByText("internal-provider-detail")).toBeNull();
    fireEvent.click(link);
    expect(mock.markRead).toHaveBeenCalledWith(["notification-1"]);
    expect(navigate).toHaveBeenCalledOnce();
  });
  it("preserves page reminders", () => {
    view(<NotificationItem notification={notification("page.reminder", { data: null })} onNavigate={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Your page reminder is due/ }).getAttribute("href")).toBe("/s/general/p/my-page-pageSlug");
  });
  it("does not link unavailable pages but keeps a keyboard accessible mark-read action", () => {
    const navigate = vi.fn();
    view(<NotificationItem notification={notification("ai.failed", { page: null })} onNavigate={navigate} />);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByText("This page is no longer available"));
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(mock.markRead).toHaveBeenCalledWith(["notification-1"]);
  });
  it("marks middle clicks but leaves context-menu clicks unread", () => {
    view(<NotificationItem notification={notification()} onNavigate={vi.fn()} />);
    const link = screen.getByRole("link");
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
    expect(mock.markRead).not.toHaveBeenCalled();
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(mock.markRead).toHaveBeenCalledOnce();
  });
  it("does not turn invalid task identifiers into a job deep-link", () => {
    const link = getNotificationLink(notification("ai.failed", { data: { jobId: "../settings?token=bad" } }), true);
    expect(link).toBe("/s/general/p/my-page-pageSlug");
    expect(getNotificationLink(notification("siem_destination.failing"), true)).toBeUndefined();
  });
  it("hides legacy collaboration notifications in personal mode", () => {
    mock.items = [notification("comment.created"), notification("ai.completed", { id: "ai" })];
    view(<NotificationList tab="direct" filter="all" onNavigate={vi.fn()} />);
    expect(screen.queryByText(/commented on a page/)).toBeNull();
    expect(screen.getByText("AI finished writing to your page")).toBeTruthy();
    expect(mock.listQuery).toHaveBeenCalledWith("all");
  });
  it("continues pagination when a read first page hides unread items on later pages", async () => {
    mock.items = [notification("ai.completed", { readAt: new Date().toISOString() })]; mock.hasNextPage = true;
    view(<NotificationList tab="all" filter="unread" onNavigate={vi.fn()} />);
    await waitFor(() => expect(mock.fetchNextPage).toHaveBeenCalledOnce());
    expect(screen.queryByText("No unread notifications")).toBeNull();
  });
  it("explains the personal empty inbox and allows retry after a load failure", () => {
    const rendered = view(<NotificationList tab="all" filter="all" onNavigate={vi.fn()} />);
    expect(screen.getByText("AI tasks and page reminders appear here.")).toBeTruthy();
    rendered.unmount(); mock.isError = true;
    view(<NotificationList tab="all" filter="all" onNavigate={vi.fn()} />);
    expect(screen.queryByText("No notifications")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
  });
  it("uses all/unread filters without collaboration tabs and can mark all read", async () => {
    mock.items = [notification(), notification("ai.failed", { id: "read", readAt: new Date().toISOString() })];
    view(<NotificationPopover navigation />);
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.queryByRole("tab", { name: "Direct" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Updates" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unread only" }));
    expect(screen.queryByText("AI could not finish this task")).toBeNull();
    expect(screen.getByText("AI finished writing to your page")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Mark all as read" }));
    expect(mock.markAll).toHaveBeenCalledOnce();
  });
  it("removes collaboration notification settings without adding unsupported switches", () => {
    view(<NotificationPref />);
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
    expect(screen.getByText("Set reminders from each page.")).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByText("Page mentions")).toBeNull();
  });
  it("preserves collaboration tabs and email preferences outside personal mode", () => {
    mock.personal = false;
    const rendered = view(<NotificationPopover navigation />);
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.getByRole("tab", { name: "Direct" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Updates" })).toBeTruthy();
    expect(mock.listQuery).toHaveBeenCalledWith("direct");
    rendered.unmount();
    view(<NotificationPref />);
    expect(screen.getByRole("heading", { name: "Email notifications" })).toBeTruthy();
    expect(screen.getAllByRole("switch")).toHaveLength(5);
  });
});
