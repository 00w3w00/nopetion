import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { MemoryRouter } from "react-router-dom";
import GlobalAppShell from "./global-app-shell";
import {
  asideStateAtom,
  personalSidebarWidthAtom,
  sidebarWidthAtom,
} from "./hooks/atoms/sidebar-atom";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/config", () => ({ isPersonalMode: () => true }));
vi.mock("@/components/settings/settings-sidebar.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/space/components/sidebar/space-sidebar.tsx", () => ({
  SpaceSidebar: () => null,
}));
vi.mock("@/components/layouts/global/app-header.tsx", () => ({
  AppHeader: () => null,
}));
vi.mock("@/components/layouts/global/aside.tsx", () => ({
  default: () => null,
}));
vi.mock("@/components/layouts/global/global-sidebar.tsx", () => ({
  default: () => null,
}));
vi.mock("@/features/personal/components/personal-sidebar", () => ({
  default: () => null,
}));
vi.mock("@/features/personal/components/personal-account-menu", () => ({
  default: () => null,
}));

afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  });
  localStorage.clear();
});
function mount(path = "/home", storedWidth = 240) {
  const store = createStore();
  store.set(personalSidebarWidthAtom, storedWidth);
  store.set(sidebarWidthAtom, 300);
  render(
    <Provider store={store}>
      <MantineProvider env="test">
        <MemoryRouter initialEntries={[path]}>
          <GlobalAppShell>
            <p>Document</p>
          </GlobalAppShell>
        </MemoryRouter>
      </MantineProvider>
    </Provider>,
  );
  return store;
}
describe("personal sidebar resizing", () => {
  it("resizes on the home route, persists width and preserves the team sidebar preference", () => {
    const store = mount();
    const handle = screen.getByRole("separator", { name: "Resize sidebar" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(handle.getAttribute("aria-valuenow")).toBe("250");
    expect(store.get(personalSidebarWidthAtom)).toBe(250);
    expect(localStorage.getItem("personalSidebarWidth")).toBe("250");
    expect(store.get(sidebarWidthAtom)).toBe(300);
    fireEvent.keyDown(handle, { key: "ArrowRight", shiftKey: true });
    expect(store.get(personalSidebarWidthAtom)).toBe(300);
  });
  it("clamps keyboard sizing and resets with a double click", () => {
    const store = mount("/s/personal/p/page");
    const handle = screen.getByRole("separator");
    fireEvent.keyDown(handle, { key: "Home" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(store.get(personalSidebarWidthAtom)).toBe(220);
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(store.get(personalSidebarWidthAtom)).toBe(600);
    fireEvent.doubleClick(handle);
    expect(store.get(personalSidebarWidthAtom)).toBe(240);
  });
  it("updates width by dragging and stops resizing on mouse release", () => {
    const store = mount();
    const handle = screen.getByRole("separator");
    fireEvent.mouseDown(handle, { button: 0 });
    fireEvent.mouseMove(window, { clientX: 360 });
    expect(store.get(personalSidebarWidthAtom)).toBe(360);
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { clientX: 450 });
    expect(store.get(personalSidebarWidthAtom)).toBe(360);
  });
  it("does not expose an ineffective resize handle in settings", () => {
    mount("/settings/account/preferences");
    expect(screen.queryByRole("separator")).toBeNull();
  });

  it("overrides the mobile aside transform locally when the panel opens", () => {
    const store = mount("/s/personal/p/page");
    const shell = document.querySelector<HTMLElement>("[data-personal-shell]");

    expect(shell?.style.getPropertyValue("--app-shell-aside-transform")).toBe(
      "translateX(var(--app-shell-aside-width))",
    );

    act(() => {
      store.set(asideStateAtom, {
        tab: "personal-ai",
        isAsideOpen: true,
      });
    });

    expect(shell?.style.getPropertyValue("--app-shell-aside-transform")).toBe(
      "translateX(0)",
    );
    expect(
      shell?.style.getPropertyValue("--app-shell-aside-transform-rtl"),
    ).toBe("translateX(0)");
  });
});
