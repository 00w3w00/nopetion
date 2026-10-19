import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { useMantineTheme } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { currentUserAtom } from "../atoms/current-user-atom";
import AppThemeProvider from "../app-theme-provider";
import AccountFont from "./account-font";
import { appFonts, resolveAppFont } from "../app-fonts";
import type { ICurrentUser } from "../types/user.types";

const mocks = vi.hoisted(() => ({ update: vi.fn(), notify: vi.fn() }));
vi.mock("../services/user-service", () => ({ updateUser: mocks.update }));
vi.mock("@mantine/notifications", () => ({ notifications: { show: mocks.notify } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
  global.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); sessionStorage.clear(); localStorage.clear(); });

function ThemeProbe() { return <output data-testid="active-font">{useMantineTheme().fontFamily}</output>; }

function setup() {
  const account = { user: { id: "owner", settings: { preferences: { documentFont: "serif", smallText: true } } }, workspace: { id: "workspace" } } as ICurrentUser;
  const store = createStore();
  store.set(currentUserAtom, account);
  const queryClient = new QueryClient();
  queryClient.setQueryData(["currentUser"], account);
  const tree = () => <Provider store={store}><QueryClientProvider client={queryClient}><AppThemeProvider><AccountFont /><ThemeProbe /></AppThemeProvider></QueryClientProvider></Provider>;
  const view = render(tree());
  return { account, store, queryClient, tree, view };
}

function selectInter() {
  fireEvent.click(screen.getByRole("combobox", { name: "Select font" }));
  fireEvent.click(screen.getByRole("option", { name: "Inter" }));
}

describe("account font", () => {
  it("uses Pretendard for missing/unknown preferences without writing account data", () => {
    setup();
    expect(resolveAppFont("__proto__")).toBe("pretendard");
    expect(resolveAppFont("unknown")).toBe("pretendard");
    expect(screen.getByRole("combobox", { name: "Select font" })).toHaveProperty("value", "Pretendard (default)");
    expect(screen.getByTestId("active-font").textContent).toBe(appFonts.pretendard);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("applies only the confirmed preference, keeps document overrides, and survives a remount through the query cache", async () => {
    const { account, store, queryClient, view, tree } = setup();
    let complete!: (value: typeof account.user) => void;
    mocks.update.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    selectInter();
    expect(mocks.update).toHaveBeenCalledWith({ appFont: "inter" });
    expect(screen.getByRole("combobox", { name: "Select font" })).toHaveProperty("disabled", true);
    expect(store.get(currentUserAtom).user.settings.preferences.appFont).toBeUndefined();
    await act(async () => { complete({ ...account.user, settings: { preferences: { ...account.user.settings.preferences, appFont: "inter" } } }); });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Select font" })).toHaveProperty("value", "Inter"));
    expect(store.get(currentUserAtom).user.settings.preferences).toEqual({ appFont: "inter", documentFont: "serif", smallText: true });
    expect(queryClient.getQueryData<ICurrentUser>(["currentUser"]).user.settings.preferences.appFont).toBe("inter");
    expect(screen.getByTestId("active-font").textContent).toBe(appFonts.inter);
    view.unmount();
    render(tree());
    expect(screen.getByRole("combobox", { name: "Select font" })).toHaveProperty("value", "Inter");
  });

  it("keeps the previous font when saving fails", async () => {
    const { store } = setup();
    mocks.update.mockRejectedValue(new Error("offline"));
    selectInter();
    await waitFor(() => expect(mocks.notify).toHaveBeenCalledWith({ color: "red", message: "Failed to update preferences" }));
    expect(screen.getByRole("combobox", { name: "Select font" })).toHaveProperty("value", "Pretendard (default)");
    expect(store.get(currentUserAtom).user.settings.preferences.appFont).toBeUndefined();
  });

  it("does not replace another workspace with a late save response", async () => {
    const { account, store, queryClient } = setup();
    let complete!: (value: typeof account.user) => void;
    mocks.update.mockReturnValue(new Promise(resolve => { complete = resolve; }));
    selectInter();
    const other = { ...account, user: { ...account.user, id: "other" }, workspace: { id: "other-workspace" } } as ICurrentUser;
    act(() => { store.set(currentUserAtom, other); queryClient.setQueryData(["currentUser"], other); });
    await act(async () => { complete({ ...account.user, settings: { preferences: { ...account.user.settings.preferences, appFont: "inter" } } }); });
    expect(store.get(currentUserAtom).workspace.id).toBe("other-workspace");
    expect(queryClient.getQueryData<ICurrentUser>(["currentUser"]).user.id).toBe("other");
  });
});
