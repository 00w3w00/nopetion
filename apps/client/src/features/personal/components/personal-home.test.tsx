import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { createInstance } from "i18next";
import PersonalHome from "./personal-home";

const mock = vi.hoisted(() => ({
  openSearch: vi.fn(),
  recentRefetch: vi.fn(),
  favoriteRefetch: vi.fn(),
  fetchRecent: vi.fn(),
  fetchFavorites: vi.fn(),
  user: { name: "Mina" },
  recent: {} as Record<string, unknown>,
  favorites: {} as Record<string, unknown>,
}));

vi.mock("jotai", () => ({ useAtomValue: () => mock.user }));
vi.mock("@/features/user/atoms/current-user-atom", () => ({ userAtom: {} }));
vi.mock("@/components/ui/document-title", () => ({
  DocumentTitle: () => null,
}));
vi.mock("@/features/search/constants", () => ({
  searchSpotlight: { open: mock.openSearch },
}));
vi.mock("@/hooks/use-time-ago", () => ({ useTimeAgo: () => "2 hours ago" }));
vi.mock("@/features/page/queries/page-query", () => ({
  useRecentChangesQuery: () => mock.recent,
}));
vi.mock("@/features/favorite/queries/favorite-query", () => ({
  useFavoritesQuery: () => mock.favorites,
}));

const language = createInstance();
await language.init({
  lng: "en-US",
  resources: {},
  interpolation: { escapeValue: false },
});

const page = (index: number) => ({
  id: `page-${index}`,
  slugId: `slug-${index}`,
  title: `Document ${index}`,
  icon: index === 1 ? "📝" : "",
  isBase: false,
  updatedAt: new Date("2026-11-04T01:00:00Z"),
  space: { slug: "personal", name: "Personal" },
});

const favorite = (index: number) => ({
  id: `favorite-${index}`,
  page: {
    id: `favorite-page-${index}`,
    slugId: `favorite-slug-${index}`,
    title: `Favorite ${index}`,
    icon: null,
    isBase: false,
    spaceId: "space",
  },
  space: { slug: "personal", name: "Personal" },
});

beforeEach(() => {
  vi.clearAllMocks();
  mock.recent = {
    data: {
      pages: [
        { items: Array.from({ length: 7 }, (_, index) => page(index + 1)) },
      ],
    },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: mock.fetchRecent,
    refetch: mock.recentRefetch,
  };
  mock.favorites = {
    data: { pages: [{ items: [favorite(1)] }] },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: mock.fetchFavorites,
    refetch: mock.favoriteRefetch,
  };
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

afterEach(cleanup);

const mount = () =>
  render(
    <MantineProvider env="test">
      <I18nextProvider i18n={language}>
        <MemoryRouter>
          <PersonalHome />
        </MemoryRouter>
      </I18nextProvider>
    </MantineProvider>,
  );

describe("personal home", () => {
  it("uses live page data for navigation and opens existing workspace actions", () => {
    mount();
    expect(
      screen.getByRole("heading", { name: "Welcome back, Mina" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Document 1/ }).getAttribute("href"),
    ).toContain("/s/personal/p/document-1-slug-1");
    expect(
      screen.getByRole("link", { name: /Favorite 1/ }).getAttribute("href"),
    ).toContain("/s/personal/p/favorite-1-favorite-slug-1");
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(mock.openSearch).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: /Templates/ }).getAttribute("href"),
    ).toBe("/templates");
  });

  it("reveals additional loaded documents and retries each failed query", () => {
    const view = mount();
    expect(screen.queryByRole("link", { name: /Document 7/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(screen.getByRole("link", { name: /Document 7/ })).toBeTruthy();

    mock.recent = { ...mock.recent, data: undefined, isError: true };
    mock.favorites = { ...mock.favorites, data: undefined, isError: true };
    view.rerender(
      <MantineProvider env="test">
        <I18nextProvider i18n={language}>
          <MemoryRouter>
            <PersonalHome />
          </MemoryRouter>
        </I18nextProvider>
      </MantineProvider>,
    );
    const alerts = screen.getAllByRole("alert");
    fireEvent.click(within(alerts[0]).getByRole("button", { name: "Retry" }));
    fireEvent.click(within(alerts[1]).getByRole("button", { name: "Retry" }));
    expect(mock.recentRefetch).toHaveBeenCalledTimes(1);
    expect(mock.favoriteRefetch).toHaveBeenCalledTimes(1);
  });
});
