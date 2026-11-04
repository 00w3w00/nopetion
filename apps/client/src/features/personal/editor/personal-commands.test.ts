import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  PersonalDatabase,
  PersonalDatabaseCell,
  PersonalDatabaseProperty,
  PersonalDatabaseRow,
  PersonalWidget,
} from "@docmost/editor-ext";
import { personalCommandGroups } from "./personal-commands";
import type { CommandProps } from "@/features/editor/components/slash-menu/types";
import {
  OPEN_PERSONAL_AI_EVENT,
  type OpenPersonalAiDetail,
} from "@/features/personal-ai/open-personal-ai";

vi.mock("@/i18n", () => ({
  default: { language: "en-US", t: (key: string) => key },
}));
vi.mock("@/features/page/queries/page-query", () => ({
  invalidateOnCreatePage: vi.fn(),
}));

const editors: Editor[] = [];

const makeEditor = () => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      PersonalWidget,
      PersonalDatabase,
      PersonalDatabaseRow,
      PersonalDatabaseProperty,
      PersonalDatabaseCell,
    ],
    content: { type: "doc", content: [{ type: "paragraph" }] },
  });
  editors.push(editor);
  return editor;
};

const run = (
  editor: Editor,
  title: string,
  group: "Recommended" | "Databases",
) => {
  const item = personalCommandGroups({})[group].find(
    (candidate) => candidate.title === title,
  );
  expect(item).toBeDefined();
  item?.command({ editor, range: { from: 0, to: 0 } } as CommandProps);
};

afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("personal slash commands", () => {
  it("creates fresh widget identities on every AI notes insertion", () => {
    const first = makeEditor();
    const second = makeEditor();
    run(first, "AI notes", "Recommended");
    run(second, "AI notes", "Recommended");

    const ids: string[] = [];
    for (const editor of [first, second])
      editor.state.doc.descendants((node) => {
        if (node.type.name === "personalWidget") ids.push(node.attrs.id);
      });
    expect(ids).toHaveLength(4);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(4);
  });

  it("creates a fresh database identity for each inline database", () => {
    const first = makeEditor();
    const second = makeEditor();
    run(first, "Database - inline", "Databases");
    run(second, "Database - inline", "Databases");

    const ids: string[] = [];
    for (const editor of [first, second])
      editor.state.doc.descendants((node) => {
        if (node.type.name === "personalDatabase") ids.push(node.attrs.id);
      });
    expect(ids).toHaveLength(2);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });

  it("removes the slash query before opening the page-scoped AI panel", () => {
    const editor = makeEditor();
    editor.storage.pageId = "page-1";
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "/ask" }],
        },
      ],
    });
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(OPEN_PERSONAL_AI_EVENT, listener);
    const command = personalCommandGroups({}).Recommended.find(
      (candidate) => candidate.title === "Ask AI",
    );

    command?.command({ editor, range: { from: 1, to: 5 } } as CommandProps);

    window.removeEventListener(OPEN_PERSONAL_AI_EVENT, listener);
    expect(editor.getText()).toBe("");
    expect(listener).toHaveBeenCalledOnce();
    expect(
      (listener.mock.calls[0][0] as CustomEvent<OpenPersonalAiDetail>).detail,
    ).toEqual({ editor, pageId: "page-1", action: "ask" });
  });
});
