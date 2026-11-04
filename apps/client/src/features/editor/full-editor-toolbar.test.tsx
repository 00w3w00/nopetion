import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { currentPageEditModeAtom } from "@/features/editor/atoms/editor-atoms";
import { PageEditMode } from "@/features/user/types/user.types";
import { FullEditor } from "./full-editor";

const mode = vi.hoisted(() => ({ personal: true }));

vi.mock("@/lib/config", () => ({
  isPersonalMode: () => mode.personal,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/features/editor/title-editor", () => ({
  TitleEditor: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@/features/editor/page-editor", () => ({
  default: ({ content }: { content: string }) => <article>{content}</article>,
}));
vi.mock("@/features/editor/components/fixed-toolbar/fixed-toolbar", () => ({
  FixedToolbar: () => <div data-testid="fixed-toolbar">Fixed toolbar</div>,
}));
vi.mock("@/features/page/trash/components/deleted-page-banner.tsx", () => ({
  DeletedPageBanner: () => null,
}));
vi.mock("@/features/editor/components/empty-page/empty-page-get-started", () => ({
  EmptyPageGetStarted: () => null,
}));
vi.mock("@/features/personal/editor/page-decoration", () => ({
  default: () => null,
  PersonalCover: () => null,
}));
vi.mock("@/features/personal-classification/classification-tags", () => ({
  ClassificationTags: () => null,
}));
vi.mock("@/hooks/use-toggle-aside.tsx", () => ({
  useAsideTriggerProps: () => ({}),
}));

beforeEach(() => {
  mode.personal = true;
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

function mount() {
  const store = createStore();
  store.set(currentPageEditModeAtom, PageEditMode.Edit);
  store.set(currentUserAtom, {
    user: {
      settings: {
        preferences: {
          editorToolbar: true,
          fullPageWidth: false,
          pageEditMode: PageEditMode.Edit,
        },
      },
    },
    workspace: {},
  } as never);

  render(
    <Provider store={store}>
      <MantineProvider env="test">
        <FullEditor
          pageId="page-1"
          slugId="page-slug"
          title="Project notes"
          content="Body content"
          spaceSlug="space"
          editable
        />
      </MantineProvider>
    </Provider>,
  );
}

describe("FullEditor fixed toolbar mode boundary", () => {
  it("keeps title and body but hides the fixed toolbar in personal mode", () => {
    mount();

    expect(screen.getByRole("heading", { name: "Project notes" })).toBeTruthy();
    expect(screen.getByText("Body content")).toBeTruthy();
    expect(screen.queryByTestId("fixed-toolbar")).toBeNull();
  });

  it("preserves the configured fixed toolbar outside personal mode", () => {
    mode.personal = false;
    mount();

    expect(screen.getByTestId("fixed-toolbar")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Project notes" })).toBeTruthy();
    expect(screen.getByText("Body content")).toBeTruthy();
  });
});
