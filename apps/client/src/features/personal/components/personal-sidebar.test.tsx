import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { createInstance } from "i18next";
import PersonalSidebar from "./personal-sidebar";

const mock = vi.hoisted(() => ({
  canCreate: true,
  create: vi.fn(),
  fetchMoreFavorites: vi.fn(),
  hasMoreFavorites: false,
  toggleSidebar: vi.fn(),
  workspace: { id: "workspace-1", defaultSpaceId: "space-1" },
  space: {
    id: "space-1",
    slug: "general",
    membership: { permissions: [] },
  },
  favorites: {
    pages: [
      {
        items: [
          {
            id: "favorite-1",
            page: {
              slugId: "favorite123",
              title: "Favorite note",
              icon: "⭐",
            },
          },
        ],
      },
    ],
  },
}));

vi.mock("jotai", () => ({
  useAtomValue: (atom: { testName?: string }) => {
    if (atom.testName === "workspace") return mock.workspace;
    if (atom.testName === "mobile-sidebar") return false;
    return null;
  },
}));
vi.mock("@/features/user/atoms/current-user-atom", () => ({
  workspaceAtom: { testName: "workspace" },
}));
vi.mock("@/features/editor/atoms/editor-atoms", () => ({
  pageEditorAtom: { testName: "editor" },
}));
vi.mock("@/components/layouts/global/hooks/atoms/sidebar-atom", () => ({
  desktopSidebarAtom: { testName: "desktop-sidebar" },
  mobileSidebarAtom: { testName: "mobile-sidebar" },
}));
vi.mock("@/components/layouts/global/hooks/hooks/use-toggle-sidebar", () => ({
  useToggleSidebar: () => mock.toggleSidebar,
}));
vi.mock("@/features/space/queries/space-query", () => ({
  useGetSpacesQuery: () => ({
    data: { items: [{ id: "space-1", slug: "general", name: "General" }] },
  }),
  useSpaceQuery: () => ({
    data: mock.space,
    isPending: false,
    isError: false,
  }),
}));
vi.mock("@/features/space/permissions/use-space-ability", () => ({
  useSpaceAbility: () => ({ can: () => mock.canCreate }),
}));
vi.mock("@/features/page/tree/hooks/use-tree-mutation", () => ({
  useTreeMutation: () => ({ handleCreate: mock.create }),
}));
vi.mock("@/features/page/tree/components/space-tree", () => ({
  default: () => <div data-testid="space-tree">Pages</div>,
}));
vi.mock("@/features/favorite/queries/favorite-query", () => ({
  useFavoritesQuery: () => ({
    data: mock.favorites,
    hasNextPage: mock.hasMoreFavorites,
    fetchNextPage: mock.fetchMoreFavorites,
    isFetchingNextPage: false,
  }),
}));
vi.mock("@/features/search/constants", () => ({
  searchSpotlight: { open: vi.fn() },
}));
vi.mock("@/features/page/page.utils", () => ({
  buildPageUrl: (_space: string, slug: string, title?: string) =>
    `/p/${title?.toLowerCase().replaceAll(" ", "-")}-${slug}`,
}));
vi.mock("@/lib/config", () => ({
  getSpaceUrl: (slug: string) => `/s/${slug}`,
}));
vi.mock("./personal-account-menu", () => ({ default: () => null }));
vi.mock("../editor/create-page-command", () => ({
  PERSONAL_PAGE_CREATED: "personal-page-created",
}));
vi.mock("@/lib/utils", () => ({ platformModifierLabel: "⌘" }));
vi.mock("@/lib", () => ({
  extractPageSlugId: (slug: string) => slug.split("-").at(-1),
}));

const language = createInstance();
await language.init({
  lng: "en-US",
  resources: {},
  interpolation: { escapeValue: false },
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mock.canCreate = true;
  mock.hasMoreFavorites = false;
  mock.create.mockResolvedValue({});
  mock.fetchMoreFavorites.mockResolvedValue({});
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function mount(path = "/home") {
  return render(
    <MantineProvider env="test">
      <I18nextProvider i18n={language}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/s/:spaceSlug/p/:pageSlug"
              element={<PersonalSidebar />}
            />
            <Route path="*" element={<PersonalSidebar />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </MantineProvider>,
  );
}

describe("Personal sidebar", () => {
  it("persists collapsed sections across remounts", () => {
    const first = mount();
    const favorites = screen.getByRole("button", { name: "Favorites" });
    const pages = screen.getByRole("button", { name: "Personal pages" });

    expect(favorites.getAttribute("aria-expanded")).toBe("true");
    expect(pages.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(favorites);
    fireEvent.click(pages);
    expect(screen.queryByRole("link", { name: /Favorite note/ })).toBeNull();
    expect(screen.queryByTestId("space-tree")).toBeNull();
    expect(screen.getByRole("link", { name: "All spaces" })).toBeTruthy();
    expect(localStorage.getItem("nopetion.sidebar.favorites-expanded")).toBe(
      "false",
    );
    expect(localStorage.getItem("nopetion.sidebar.pages-expanded")).toBe(
      "false",
    );

    first.unmount();
    mount();
    expect(
      screen
        .getByRole("button", { name: "Favorites" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Personal pages" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(screen.getByRole("link", { name: /Favorite note/ })).toBeTruthy();
  });

  it("loads the next favorites page from the real query action", () => {
    mock.hasMoreFavorites = true;
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(mock.fetchMoreFavorites).toHaveBeenCalledOnce();
  });

  it("marks a favorite active by its stable slug id", () => {
    mount("/s/general/p/renamed-favorite123");
    expect(
      screen
        .getByRole("link", { name: /Favorite note/ })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("does not mark a favorite active on a non-page route with the same suffix", () => {
    mount("/labels/favorite123");
    expect(
      screen
        .getByRole("link", { name: /Favorite note/ })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("disables both page creation controls without create permission", () => {
    mock.canCreate = false;
    mount();
    expect(
      screen
        .getByRole("button", { name: "New document" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "New page" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("exposes the current Home route to assistive technology", () => {
    mount("/home");
    expect(
      screen.getByRole("link", { name: "Home" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Templates" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });
});
