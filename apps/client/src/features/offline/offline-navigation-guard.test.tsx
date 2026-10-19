import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OfflineNavigationGuard from "./offline-navigation-guard";
import { flushOfflineWrites } from "./offline-store";

vi.mock("./offline-store", async load => ({ ...await load<object>(), hasOfflineWriters: () => true, flushOfflineWrites: vi.fn() }));
vi.mock("./offline-recovery-button", () => ({ default: () => <button>Export pending changes</button> }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(cleanup);
function mount() {
  const router = createMemoryRouter([{ path: "*", element: <MantineProvider><OfflineNavigationGuard /><span>RAM editor remains mounted</span></MantineProvider> }],
    { initialEntries: ["/home", "/offline?page=one"], initialIndex: 1 });
  render(<RouterProvider router={router} />); return router;
}
describe("offline route persistence barrier", () => {
  it("blocks browser Back when a durable flush fails", async () => {
    vi.mocked(flushOfflineWrites).mockRejectedValue(new Error("QuotaExceededError"));
    const router = mount();
    await act(async () => { await router.navigate(-1); });
    await screen.findByRole("alert");
    expect(router.state.location.pathname).toBe("/offline");
    expect(screen.getByText("RAM editor remains mounted")).toBeTruthy();
    expect(screen.getByText("Export pending changes")).toBeTruthy();
    router.dispose();
  });
  it("waits for a durable flush before programmatic navigation", async () => {
    let finish!: () => void;
    vi.mocked(flushOfflineWrites).mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const router = mount();
    await act(async () => { await router.navigate("/home"); });
    await waitFor(() => expect(flushOfflineWrites).toHaveBeenCalled());
    expect(router.state.location.pathname).toBe("/offline");
    await act(async () => { finish(); });
    await waitFor(() => expect(router.state.location.pathname).toBe("/home"));
    router.dispose();
  });
});
