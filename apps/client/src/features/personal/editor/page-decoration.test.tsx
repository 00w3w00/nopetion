import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import PageDecoration from "./page-decoration";

const mock = vi.hoisted(() => ({
  page: {
    id: "page",
    workspaceId: "workspace",
    spaceId: "space",
    icon: "",
    coverPhoto: "",
  },
  update: vi.fn(),
  create: vi.fn(),
  editor: { isEditable: true },
}));

vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: () => ({ data: mock.page }),
  useUpdatePageMutation: () => ({ isPending: false, mutate: mock.update }),
}));
vi.mock("@/features/page/tree/hooks/use-tree-mutation", () => ({
  useTreeMutation: () => ({ handleCreate: mock.create }),
}));
vi.mock("jotai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("jotai")>()),
  useAtomValue: () => mock.editor,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn() },
}));
vi.mock("./page-cover", () => ({
  CoverPicker: () => <button>Cover picker</button>,
  PersonalCover: () => null,
}));
vi.mock("./page-emoji-palette", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.page.icon = "";
  mock.page.coverPhoto = "";
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

afterEach(cleanup);

function mount(editable: boolean) {
  return render(
    <MantineProvider env="test">
      <PageDecoration pageId="page" editable={editable} />
    </MantineProvider>,
  );
}

describe("PageDecoration", () => {
  it("offers compact page actions without inventing a fallback page icon", () => {
    const { container } = mount(true);

    expect(screen.getByRole("button", { name: "Add icon" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cover picker" })).toBeTruthy();
    expect(
      container
        .querySelector("[data-personal-decoration]")
        ?.hasAttribute("data-has-icon"),
    ).toBe(false);
  });

  it("does not expose decoration controls on an undecorated read-only page", () => {
    const { container } = mount(false);

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("[data-personal-decoration]")).toBeTruthy();
  });

  it("keeps an existing icon visible for readers and hides the redundant cover picker", () => {
    mock.page.icon = "🌿";
    mock.page.coverPhoto = "nopetion:sage";
    const { container } = mount(false);

    expect(
      screen.getByRole("button", { name: "Change page icon" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cover picker" })).toBeNull();
    expect(
      container
        .querySelector("[data-personal-decoration]")
        ?.getAttribute("data-has-cover"),
    ).toBe("true");
  });
});
