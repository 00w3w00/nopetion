import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { createStore, Provider } from "jotai";
import type { Editor } from "@tiptap/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showAiMenuAtom } from "@/features/editor/atoms/editor-atoms";
import { OPEN_PERSONAL_AI_EVENT } from "@/features/personal-ai/open-personal-ai";
import { AskAiGroup } from "./ask-ai-group";

const mode = vi.hoisted(() => ({ personal: true }));

vi.mock("@/lib/config", () => ({
  isPersonalMode: () => mode.personal,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function editor(editable = true) {
  return {
    isEditable: editable,
    isDestroyed: false,
    storage: { pageId: "page-1" },
  } as Editor;
}

function mount(value: Editor) {
  const store = createStore();
  render(
    <Provider store={store}>
      <MantineProvider env="test">
        <AskAiGroup editor={value} />
      </MantineProvider>
    </Provider>,
  );
  return store;
}

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

describe("AskAiGroup", () => {
  it("preserves the editor selection and opens personal AI with the live editor", () => {
    const current = editor();
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(OPEN_PERSONAL_AI_EVENT, listener);
    mount(current);
    const button = screen.getByRole("button", { name: "Ask AI" });

    expect(fireEvent.mouseDown(button)).toBe(false);
    fireEvent.click(button);

    window.removeEventListener(OPEN_PERSONAL_AI_EVENT, listener);
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      editor: current,
      pageId: "page-1",
    });
  });

  it("keeps the enterprise AI atom behavior outside personal mode", () => {
    mode.personal = false;
    const store = mount(editor());

    fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));

    expect(store.get(showAiMenuAtom)).toBe(true);
  });

  it("disables the entry point for a read-only editor", () => {
    mount(editor(false));
    expect(screen.getByRole("button", { name: "Ask AI" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
