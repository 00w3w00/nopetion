import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Plugin } from "@tiptap/pm/state";
import { Extension } from "@tiptap/core";
import * as Y from "yjs";
import {
  PersonalDatabase,
  PersonalDatabaseReference,
  PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
  UniqueID,
} from "@docmost/editor-ext";
import {
  databaseEditIsScoped,
  personalDatabases,
} from "./linked-database-utils";

const extensions = [
  StarterKit.configure({ undoRedo: false, trailingNode: false }),
  PersonalDatabase,
  PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
  PersonalDatabaseReference,
  UniqueID.configure({ types: ["heading", "paragraph", "transclusionSource"], updateDocument: false }),
];
const content = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      attrs: { id: "before-paragraph-id" },
      content: [{ type: "text", text: "보존할 원본 문단" }],
    },
    {
      type: "personalDatabase",
      attrs: { id: "source", title: "원본 업무", view: "table" },
      content: [
        {
          type: "personalDatabaseRow",
          attrs: { id: "record", title: "기록", status: "todo" },
        },
      ],
    },
    {
      type: "personalDatabaseReference",
      attrs: { sourcePageId: "page", databaseId: "source", view: "board" },
    },
    { type: "paragraph", attrs: { id: "after-paragraph-id" }, content: [{ type: "text", text: "뒤쪽 원본 문단" }] },
  ],
};
const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});
function make(options = {}) {
  const editor = new Editor({ extensions, content, ...options });
  editors.push(editor);
  return editor;
}
describe("Authenticated linked database schema and source edits", () => {
  it("keeps reference identity and local view through JSON and HTML reloads without copying rows", () => {
    const editor = make();
    const reference = (editor.getJSON() as JSONContent).content.find(
      (node) => node.type === "personalDatabaseReference",
    );
    expect(reference.attrs).toEqual({
      sourcePageId: "page",
      databaseId: "source",
      view: "board",
    });
    expect(reference.content).toBeUndefined();
    const html = editor.getHTML();
    editor.commands.setContent(html);
    expect(
      (editor.getJSON() as JSONContent).content.find(
        (node) => node.type === "personalDatabaseReference",
      ),
    ).toEqual(reference);
    expect(personalDatabases(editor.getJSON() as JSONContent)).toEqual([
      { id: "source", title: "원본 업무", ordinal: 0 },
    ]);
  });
  it("allows a selected database cell edit and rejects surrounding text, source removal, and other database edits", () => {
    const editor = make();
    const before = editor.getJSON() as JSONContent;
    const after = structuredClone(before);
    after.content[1].content[0].attrs.title = "변경";
    expect(databaseEditIsScoped(before, after, "source")).toBe(true);
    const outside = structuredClone(after);
    outside.content[0].content[0].text = "허용하지 않는 변경";
    expect(databaseEditIsScoped(before, outside, "source")).toBe(false);
    const removed = structuredClone(after);
    removed.content.splice(1, 1);
    expect(databaseEditIsScoped(before, removed, "source")).toBe(false);
    const unidentified = structuredClone(after);
    unidentified.content[1].attrs.id = "other";
    expect(databaseEditIsScoped(before, unidentified, "source")).toBe(false);
  });
  it("uses actual ProseMirror transactions to protect source content while permitting row changes", () => {
    const scope = Extension.create({
      name: "testDatabaseScope",
      addProseMirrorPlugins: () => [
        new Plugin({
          filterTransaction: (tr, previous) =>
            !tr.docChanged ||
            databaseEditIsScoped(
              previous.doc.toJSON(),
              tr.doc.toJSON(),
              "source",
            ),
        }),
      ],
    });
    const editor = make({ extensions: [...extensions, scope] });
    let rowPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "personalDatabaseRow") rowPos = pos;
    });
    editor.commands.command(({ tr }) => {
      tr.setNodeAttribute(rowPos, "title", "실제 변경");
      return true;
    });
    expect(editor.state.doc.nodeAt(rowPos).attrs.title).toBe("실제 변경");
    editor.commands.insertContentAt(1, "실수");
    expect((editor.getJSON() as JSONContent).content[0].content[0].text).toBe(
      "보존할 원본 문단",
    );
    expect((editor.getJSON() as JSONContent).content[3].content[0].text).toBe(
      "뒤쪽 원본 문단",
    );
  });
  it("source Yjs row changes converge while reference view and surrounding text remain independent", () => {
    const a = new Y.Doc(),
      b = new Y.Doc();
    const source = make({
      content: undefined,
      extensions: [...extensions, Collaboration.configure({ document: a })],
    });
    source.commands.setContent(content);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const linked = make({
      content: undefined,
      extensions: [...extensions, Collaboration.configure({ document: b })],
    });
    let rowPos = -1;
    source.state.doc.descendants((node, pos) => {
      if (node.type.name === "personalDatabaseRow") rowPos = pos;
    });
    linked.commands.command(({ tr }) => {
      tr.setNodeAttribute(rowPos, "status", "done");
      return true;
    });
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    expect(source.state.doc.nodeAt(rowPos).attrs.status).toBe("done");
    expect((source.getJSON() as JSONContent).content[1].attrs.view).toBe(
      "table",
    );
    expect((source.getJSON() as JSONContent).content[2].attrs.view).toBe(
      "board",
    );
    expect((source.getJSON() as JSONContent).content[0].attrs.id).toBe("before-paragraph-id");
    expect((source.getJSON() as JSONContent).content[3].attrs.id).toBe("after-paragraph-id");
    expect((source.getJSON() as JSONContent).content[0].content[0].text).toBe(
      "보존할 원본 문단",
    );
    source.destroy();
    linked.destroy();
    a.destroy();
    b.destroy();
  });
  it("lists nested source databases without treating linked references as recursive sources", () => {
    expect(
      personalDatabases({
        type: "doc",
        content: [
          {
            type: "personalTabs",
            content: [{ type: "personalTab", content: content.content }],
          },
        ],
      }),
    ).toEqual([{ id: "source", title: "원본 업무", ordinal: 0 }]);
  });
});
