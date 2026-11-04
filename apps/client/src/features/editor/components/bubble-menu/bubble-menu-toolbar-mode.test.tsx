import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { EditorBubbleMenu } from "./bubble-menu";

const mode = vi.hoisted(() => ({ personal: true }));

vi.mock("@/lib/config", () => ({
  isPersonalMode: () => mode.personal,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tiptap/react/menus", () => ({
  BubbleMenu: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@tiptap/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tiptap/react")>()),
  isNodeSelection: () => false,
  useEditorState: () => ({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isCode: false,
    isComment: false,
  }),
}));
vi.mock("@docmost/editor-ext", () => ({
  isCellSelection: () => false,
  isEditorReady: () => true,
  isTextSelected: () => true,
}));
vi.mock("./node-selector", () => ({ NodeSelector: () => <div>Blocks</div> }));
vi.mock("./text-alignment-selector", () => ({
  TextAlignmentSelector: () => <div>Alignment</div>,
}));
vi.mock("./color-selector", () => ({
  ColorSelector: () => <div>Color</div>,
}));
vi.mock("./link-selector.tsx", () => ({ LinkSelector: () => null }));

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
  store.set(currentUserAtom, {
    user: {
      settings: {
        preferences: {
          editorToolbar: true,
          fullPageWidth: false,
          pageEditMode: "edit",
        },
      },
    },
    workspace: { settings: { ai: { generative: false } } },
  } as never);
  const editor = {
    isEditable: true,
    isDestroyed: false,
    isActive: () => false,
    chain: () => ({
      focus: () => ({
        toggleBold: vi.fn(),
        toggleItalic: vi.fn(),
        toggleUnderline: vi.fn(),
        toggleStrike: vi.fn(),
        toggleCode: vi.fn(),
        setCommentDecoration: vi.fn(),
      }),
    }),
  };

  render(
    <Provider store={store}>
      <MantineProvider env="test">
        <EditorBubbleMenu editor={editor as never} />
      </MantineProvider>
    </Provider>,
  );
}

describe("EditorBubbleMenu fixed toolbar mode boundary", () => {
  it("keeps selection formatting visible in personal mode despite the saved fixed-toolbar preference", () => {
    mount();

    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByText("Blocks")).toBeTruthy();
  });

  it("preserves the fixed-toolbar suppression outside personal mode", () => {
    mode.personal = false;
    mount();

    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
    expect(screen.queryByText("Blocks")).toBeNull();
  });
});
