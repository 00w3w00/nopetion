import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";
import {
  applyAiResult,
  canReplaceSelection,
  canonical,
  snapshotMatchesSaved,
  type AiSnapshot,
} from "./ai-editor";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+", attrs: { dir: { default: "auto" } } },
    paragraph: {
      content: "inline*",
      group: "block",
      attrs: { indent: { default: 0 }, textAlign: { default: null } },
    },
    text: { group: "inline" },
    image: { inline: true, group: "inline" },
  },
  marks: { link: { attrs: { href: {} } }, bold: {} },
});
const paragraph = (text: string) =>
  schema.node("paragraph", null, schema.text(text));
describe("AI editor transactions", () => {
  it("hashes reordered jsonb keys consistently", () => {
    expect(canonical({ z: 1, a: { b: 2, a: 3 } })).toBe(
      canonical({ a: { a: 3, b: 2 }, z: 1 }),
    );
  });
  it("permits one uniformly marked paragraph but rejects mixed marks, blocks and inline images", () => {
    const plain = schema.node("doc", null, [
      paragraph("한국어 원문"),
      paragraph("둘째 문단"),
    ]);
    expect(canReplaceSelection(plain, 1, 5)).toBe(true);
    expect(canReplaceSelection(plain, 1, plain.content.size - 1)).toBe(false);
    const mixed = schema.node(
      "doc",
      null,
      schema.node("paragraph", null, [
        schema.text("앞"),
        schema.text("뒤", [schema.mark("bold")]),
      ]),
    );
    expect(canReplaceSelection(mixed, 1, 3)).toBe(false);
    const image = schema.node(
      "doc",
      null,
      schema.node("paragraph", null, [
        schema.text("앞"),
        schema.node("image"),
        schema.text("뒤"),
      ]),
    );
    expect(canReplaceSelection(image, 1, 4)).toBe(false);
  });
  function fixture() {
    const link = schema.mark("link", { href: "https://example.com" });
    const doc = schema.node(
      "doc",
      null,
      schema.node("paragraph", null, schema.text("원문 링크", [link])),
    );
    let state = EditorState.create({ schema, doc });
    const editor = {
      isDestroyed: false,
      isEditable: true,
      storage: { pageId: "page" },
      get state() {
        return state;
      },
      schema,
      view: {
        dispatch(tr: any) {
          state = state.apply(tr);
        },
      },
      commands: { focus() {} },
    } as unknown as Editor;
    const snapshot: AiSnapshot = {
      pageId: "page",
      doc,
      title: "제목",
      from: 1,
      to: 6,
      text: "원문 링크",
      canApply: true,
    };
    return { editor, snapshot };
  }
  it("applies plain text through a transaction while retaining the link mark", () => {
    const { editor, snapshot } = fixture();
    expect(
      applyAiResult(editor, "제목", snapshot, "<img src=x onerror=bad>"),
    ).toBe(true);
    expect(editor.state.doc.textContent).toBe("<img src=x onerror=bad>");
    expect(editor.state.doc.firstChild?.firstChild?.marks[0].attrs.href).toBe(
      "https://example.com",
    );
    expect(editor.state.doc.firstChild?.firstChild?.isText).toBe(true);
  });
  it("matches committed Yjs JSON with omitted defaults, but rejects changed formatting/title", () => {
    const { editor, snapshot } = fixture();
    const stored = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "원문 링크",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
      ],
    };
    expect(canonical(snapshot.doc.toJSON())).not.toBe(canonical(stored));
    expect(
      snapshotMatchesSaved(editor, "제목", snapshot, {
        title: "제목",
        content: stored,
      }),
    ).toBe(true);
    const changed = {
      ...stored,
      content: [{ ...stored.content[0], attrs: { indent: 4 } }],
    };
    expect(
      snapshotMatchesSaved(editor, "제목", snapshot, {
        title: "제목",
        content: changed,
      }),
    ).toBe(false);
    expect(
      snapshotMatchesSaved(editor, "제목", snapshot, {
        title: "새 제목",
        content: stored,
      }),
    ).toBe(false);
  });
  it("rejects a changed body, title, page or read-only editor", () => {
    const { editor, snapshot } = fixture();
    expect(applyAiResult(editor, "새 제목", snapshot, "결과")).toBe(false);
    editor.storage.pageId = "other";
    expect(applyAiResult(editor, "제목", snapshot, "결과")).toBe(false);
    editor.storage.pageId = "page";
    editor.view.dispatch(editor.state.tr.insertText("변경", 1));
    expect(applyAiResult(editor, "제목", snapshot, "결과")).toBe(false);
    const readonly = fixture();
    Object.assign(readonly.editor, { isEditable: false });
    expect(
      applyAiResult(readonly.editor, "제목", readonly.snapshot, "결과"),
    ).toBe(false);
  });
});
