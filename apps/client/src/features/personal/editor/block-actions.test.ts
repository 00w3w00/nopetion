import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {
  Callout,
  Details,
  DetailsSummary,
  DetailsContent,
  PersonalDatabase,
  PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
  PersonalWidget,
} from "@docmost/editor-ext";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { convertBlock, duplicateBlock, moveBlock } from "./block-actions";
import {
  replaceMediaPlaceholder,
  validateMediaFile,
} from "./media-block-utils";
const editors: Editor[] = [];
const make = (content: object) => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      TaskList,
      TaskItem,
      Callout.extend({ addNodeView: () => null }),
      Details,
      DetailsSummary,
      DetailsContent,
      PersonalWidget,
      PersonalDatabase,
      PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
    ],
    content,
  });
  editors.push(editor);
  return editor;
};
const p = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text, marks: [{ type: "bold" }] }],
});
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));
describe("Block controls preserve editor content", () => {
  it.each([
    "paragraph",
    "heading1",
    "heading2",
    "heading3",
    "heading4",
    "bulletList",
    "orderedList",
    "taskList",
    "callout",
    "blockquote",
    "details",
  ])(
    "converts a block into %s without losing rich text or adjacent content",
    (kind) => {
      const editor = make({
        type: "doc",
        content: [p("원문 한글"), p("다음 블록")],
      });
      const content = convertBlock(editor.state.doc.firstChild.toJSON(), kind);
      expect(content).toBeTruthy();
      editor.commands.insertContentAt(
        { from: 0, to: editor.state.doc.firstChild.nodeSize },
        content,
      );
      editor.state.doc.check();
      expect(editor.getText()).toContain("원문 한글");
      expect(editor.getText()).toContain("다음 블록");
      let bold = false;
      editor.state.doc.descendants((n) => {
        if (n.text === "원문 한글")
          bold = n.marks.some((m) => m.type.name === "bold");
      });
      expect(bold).toBe(true);
      expect(editor.commands.undo()).toBe(true);
      expect(editor.state.doc.firstChild.type.name).toBe("paragraph");
    },
  );
  it("refuses conversion which would discard a database or media child", () => {
    expect(
      convertBlock(
        { type: "callout", content: [p("保持"), { type: "personalDatabase" }] },
        "paragraph",
      ),
    ).toBeNull();
  });
  it("duplicates a database with independent identities and unchanged cells", () => {
    const editor = make({
      type: "doc",
      content: [
        {
          type: "personalDatabase",
          attrs: { id: "database", title: "지출" },
          content: [
            {
              type: "personalDatabaseRow",
              attrs: { id: "row", title: "커피", number: 4500 },
            },
          ],
        },
        p("다음"),
      ],
    });
    expect(duplicateBlock(editor, 0)).toBe(true);
    expect(editor.state.doc.child(1).attrs.id).not.toBe("database");
    expect(editor.state.doc.child(1).firstChild.attrs.id).not.toBe("row");
    expect(editor.state.doc.child(1).firstChild.attrs.number).toBe(4500);
    editor.commands.undo();
    expect(editor.state.doc.childCount).toBe(2);
  });
  it("moves whole blocks in either direction and denies read-only changes", () => {
    const editor = make({
      type: "doc",
      content: [p("첫째"), p("둘째"), p("셋째")],
    });
    expect(moveBlock(editor, 0, 1)).toBe(true);
    expect(editor.state.doc.child(1).textContent).toBe("첫째");
    expect(moveBlock(editor, editor.state.doc.firstChild.nodeSize, -1)).toBe(
      true,
    );
    expect(editor.state.doc.firstChild.textContent).toBe("첫째");
    expect(moveBlock(editor, 0, -1)).toBe(false);
    const before = editor.getJSON();
    editor.setEditable(false);
    expect(moveBlock(editor, 0, 1)).toBe(false);
    expect(duplicateBlock(editor, 0)).toBe(false);
    expect(editor.getJSON()).toEqual(before);
  });
});
describe("Media placeholder upload safety", () => {
  it.each([
    ["image", "image/png"],
    ["video", "video/mp4"],
    ["audio", "audio/wav"],
    ["pdf", "application/pdf"],
    ["attachment", "text/plain"],
  ])("validates %s MIME and size", (kind, mime) => {
    expect(validateMediaFile(kind, { type: mime, size: 20 }, 20)).toBe(true);
    expect(validateMediaFile(kind, { type: mime, size: 21 }, 20)).toBe(false);
    if (kind !== "attachment")
      expect(validateMediaFile(kind, { type: "text/plain", size: 1 }, 20)).toBe(
        false,
      );
  });
  it("rejects completed uploads after navigation, deletion, replacement or permission loss", () => {
    const editor = make({
      type: "doc",
      content: [
        {
          type: "personalWidget",
          attrs: { id: "upload", kind: "media", provider: "attachment" },
        },
        p("기존"),
      ],
    });
    editor.storage.pageId = "page";
    const file = { id: "file", fileName: "한국어.txt", fileSize: 4 };
    const before = editor.getJSON();
    for (const [page, id] of [
      ["other", "upload"],
      ["page", "changed"],
    ])
      expect(
        replaceMediaPlaceholder(editor, () => 0, page, id, "attachment", file),
      ).toBe(false);
    editor.setEditable(false);
    expect(
      replaceMediaPlaceholder(
        editor,
        () => 0,
        "page",
        "upload",
        "attachment",
        file,
      ),
    ).toBe(false);
    expect(editor.getJSON()).toEqual(before);
    editor.setEditable(true);
    editor.commands.deleteRange({ from: 0, to: 1 });
    expect(
      replaceMediaPlaceholder(
        editor,
        () => 0,
        "page",
        "upload",
        "attachment",
        file,
      ),
    ).toBe(false);
  });
});
