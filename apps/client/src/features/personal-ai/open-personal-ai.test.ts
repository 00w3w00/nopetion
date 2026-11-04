import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  OPEN_PERSONAL_AI_EVENT,
  openPersonalAi,
  type OpenPersonalAiDetail,
} from "./open-personal-ai";

const editors: Editor[] = [];

function makeEditor(pageId?: string) {
  const editor = new Editor({ extensions: [StarterKit] });
  editor.storage.pageId = pageId;
  editors.push(editor);
  return editor;
}

afterEach(() => {
  editors.splice(0).forEach((editor) => {
    if (!editor.isDestroyed) editor.destroy();
  });
});

describe("openPersonalAi", () => {
  it("dispatches the live editor, page identity, and optional intent", () => {
    const editor = makeEditor("page-1");
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(OPEN_PERSONAL_AI_EVENT, listener);

    expect(
      openPersonalAi(editor, {
        action: "polish",
        instruction: "Make this concise",
      }),
    ).toBe(true);

    window.removeEventListener(OPEN_PERSONAL_AI_EVENT, listener);
    const detail = (listener.mock.calls[0][0] as CustomEvent<OpenPersonalAiDetail>)
      .detail;
    expect(detail).toEqual({
      editor,
      pageId: "page-1",
      action: "polish",
      instruction: "Make this concise",
    });
  });

  it("does not open for a read-only, unidentified, or destroyed editor", () => {
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(OPEN_PERSONAL_AI_EVENT, listener);

    const readOnly = makeEditor("read-only");
    readOnly.setEditable(false);
    expect(openPersonalAi(readOnly)).toBe(false);
    expect(openPersonalAi(makeEditor())).toBe(false);
    const destroyed = makeEditor("destroyed");
    destroyed.destroy();
    expect(openPersonalAi(destroyed)).toBe(false);

    window.removeEventListener(OPEN_PERSONAL_AI_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
