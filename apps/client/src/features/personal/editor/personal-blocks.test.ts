import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import {
  PersonalDatabase,
  PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
  PersonalWidget,
  PersonalTabs,
  PersonalTab,
  personalRowValues,
  personalRowsToCsv,
} from "@docmost/editor-ext";
import { personalHtmlPreview, safePersonalUrl } from "./widget-utils";
const extensions = [
  StarterKit.configure({ undoRedo: false, trailingNode: false }),
  PersonalDatabase,
  PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
  PersonalWidget,
  PersonalTabs,
  PersonalTab,
];
describe("Personal document blocks", () => {
  it("merges concurrent edits to different fields on one record through Yjs", () => {
    const a = new Y.Doc(),
      b = new Y.Doc();
    const editorA = new Editor({
      extensions: [...extensions, Collaboration.configure({ document: a })],
    });
    editorA.commands.setContent({
      type: "doc",
      content: [
        {
          type: "personalDatabase",
          attrs: { title: "업무", view: "board" },
          content: [
            {
              type: "personalDatabaseRow",
              attrs: { id: "stable", title: "처음", status: "todo" },
            },
          ],
        },
        { type: "paragraph" },
      ],
    });
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const editorB = new Editor({
      extensions: [...extensions, Collaboration.configure({ document: b })],
    });
    editorA.commands.command(({ tr }) => {
      const row = tr.doc.nodeAt(1);
      tr.setNodeAttribute(1, "title", "한글 변경");
      expect(row.attrs.id).toBe("stable");
      return true;
    });
    editorB.commands.command(({ tr }) => {
      tr.setNodeAttribute(1, "status", "done");
      return true;
    });
    const updateA = Y.encodeStateAsUpdate(a),
      updateB = Y.encodeStateAsUpdate(b);
    Y.applyUpdate(a, updateB);
    Y.applyUpdate(b, updateA);
    expect(editorA.getJSON()).toEqual(editorB.getJSON());
    expect(editorA.state.doc.nodeAt(1).attrs).toMatchObject({
      title: "한글 변경",
      status: "done",
      id: "stable",
    });
    editorA.destroy();
    editorB.destroy();
    a.destroy();
    b.destroy();
  });
  it("retains data and tabs when serializing and restoring editor content", () => {
    const editor = new Editor({
      extensions,
      content: {
        type: "doc",
        content: [
          {
            type: "personalDatabase",
            attrs: { title: "지출", view: "donut" },
            content: [
              {
                type: "personalDatabaseRow",
                attrs: {
                  id: "record",
                  title: "커피",
                  number: 4500,
                  date: "2026-10-11",
                  deleted: false,
                },
              },
            ],
          },
          {
            type: "personalTabs",
            content: [
              {
                type: "personalTab",
                attrs: { title: "메모" },
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "저장되는 탭 내용" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const content = editor.getJSON();
    editor.commands.setContent(content);
    expect(editor.getJSON()).toEqual(content);
    expect(editor.getText()).toContain("커피");
    expect(editor.getText()).toContain("저장되는 탭 내용");
    editor.destroy();
  });
  it("keeps deleted records out of search text and CSV and neutralizes spreadsheet formulas", () => {
    const rows = [
      personalRowValues({
        id: "1",
        title: '=HYPERLINK("https://example.com")',
        number: 10,
      }),
      personalRowValues({ id: "2", title: "비공개 삭제 항목", deleted: true }),
    ];
    const csv = personalRowsToCsv(rows);
    expect(csv).toContain("'=");
    expect(csv).not.toContain("비공개 삭제 항목");
    expect(
      personalRowValues({
        number: Infinity,
        status: "malicious",
        date: "../file",
        title: { html: "x" },
      }),
    ).toMatchObject({ number: 0, status: "todo", date: "", title: "" });
  });
  it("isolates HTML previews and rejects private or executable bookmark addresses", () => {
    const html = personalHtmlPreview(
      '<script>top.localStorage.clear()</script><img src=x onerror=alert(1)><h2>본문</h2><iframe src="http://localhost:3000"></iframe>',
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("본문");
    for (const value of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "http://example.com",
      "https://localhost:3000",
      "https://127.0.0.1",
      "https://[::1]",
      "https://192.168.0.1",
      "https://172.20.1.1",
      "https://user:password@example.com",
    ])
      expect(safePersonalUrl(value)).toBeNull();
    expect(safePersonalUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });
});
