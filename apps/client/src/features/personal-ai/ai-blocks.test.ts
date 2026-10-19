import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { aiDraftExtensions } from "./ai-draft-extensions";
import { aiTextToBlocks } from "./ai-blocks";
import { applyAiBlocks, captureAiSnapshot } from "./ai-editor";
import { StarterKit } from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { marked } from "marked";

const editors: Editor[] = [];
afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors.length = 0;
});
function create(content: string, link = false) {
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: link
      ? [
          StarterKit.configure({ trailingNode: false }),
          TaskList,
          TaskItem,
          TableKit,
        ]
      : aiDraftExtensions(),
    content,
  });
  editor.storage.pageId = "page";
  editors.push(editor);
  return editor;
}
describe("editable AI block proposals", () => {
  it("isolates task/table parsing from the main editor's global Markdown settings", () => {
    const original = marked.defaults.gfm;
    try {
      marked.setOptions({ gfm: false });
      const editor = create("<p></p>");
      editor.commands.setContent(
        aiTextToBlocks(
          "- [ ] 일정 확정\n\n| 작업 | 상태 |\n| --- | --- |\n| 검증 | 대기 |",
        ),
      );
      expect(editor.state.doc.firstChild?.type.name).toBe("taskList");
      expect(editor.state.doc.firstChild?.textContent).toBe("일정 확정");
      expect(editor.state.doc.lastChild?.type.name).toBe("table");
    } finally {
      marked.setOptions({ gfm: original });
    }
  });
  it("converts headings, formatting, lists, tasks, code and tables to valid editable blocks", () => {
    const draft = aiTextToBlocks(
      "# 제목\n\n**강조**와 _기울임_\n\n- 항목\n\n1. 순서\n\n- [x] 완료\n- [ ] 대기\n\n```js\nconst x = 1;\n```\n\n| 작업 | 상태 |\n| --- | --- |\n| 검증 | 대기 |",
    );
    const editor = create("<p></p>");
    editor.commands.setContent(draft);
    editor.state.doc.check();
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "bulletList",
      "orderedList",
      "taskList",
      "codeBlock",
      "table",
    ]);
    expect(editor.state.doc.child(4).textContent).toBe("완료대기");
    expect(editor.state.doc.child(6).firstChild?.childCount).toBe(2);
    editor.commands.setTextSelection(1);
    editor.commands.insertContent("직접 편집 ");
    expect(editor.getText()).toContain("직접 편집 제목");
  });
  it("keeps HTML literal and generated links/images inert", () => {
    const editor = create("<p>원문</p>");
    editor.commands.setContent(
      aiTextToBlocks(
        '<img src="http://private/x" onerror="bad()">\n\n[링크](javascript:bad) ![설명](http://private/image)',
      ),
    );
    expect(editor.getText()).toContain("<img");
    expect(editor.view.dom.querySelector("img, a, script")).toBeNull();
    expect(editor.getText()).toContain("링크 설명");
  });
  it("inserts blocks after the captured block, preserving existing blocks and undo", () => {
    const editor = create(
      "<p>앞 문단</p><ul><li><p>보존 목록</p></li></ul><p>뒤 문단</p>",
    );
    editor.commands.setTextSelection(2);
    const snapshot = captureAiSnapshot(editor, "제목");
    const original = editor.getJSON().content!;
    const draft = create("<p></p>");
    draft.commands.setContent(aiTextToBlocks("## 제안\n\n새 문단"));
    draft.commands.setTextSelection(1);
    draft.commands.insertContent("검토한 ");
    expect(editor.getJSON().content).toEqual(original);
    expect(
      applyAiBlocks(editor, "제목", snapshot, draft.getJSON(), false),
    ).toBe(true);
    const after = editor.getJSON().content!;
    expect(after[0]).toEqual(original[0]);
    expect(after.slice(3)).toEqual(original.slice(1));
    expect(editor.getText()).toContain("검토한 제안");
    editor.commands.undo();
    expect(editor.getJSON().content).toEqual(original);
  });
  it("fills an empty document starter block", () => {
    const editor = create("<p></p>");
    expect(
      applyAiBlocks(
        editor,
        "제목",
        captureAiSnapshot(editor, "제목"),
        aiTextToBlocks("## 새 글\n\n한글 본문"),
        false,
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
    ]);
  });
  it("replaces uniform inline selections preserving links and surrounding text", () => {
    const editor = create(
      '<p>앞 <a href="https://example.com">원문 링크</a> 뒤</p>',
      true,
    );
    editor.commands.setTextSelection({ from: 3, to: 8 });
    const snapshot = captureAiSnapshot(editor, "제목");
    expect(
      applyAiBlocks(
        editor,
        "제목",
        snapshot,
        aiTextToBlocks("**검토한 결과**"),
        true,
      ),
    ).toBe(true);
    expect(editor.getText()).toBe("앞 검토한 결과 뒤");
    const result = editor
      .getJSON()
      .content![0].content!.find(
        (node) => "text" in node && node.text === "검토한 결과",
      );
    expect(result?.marks?.map((mark) => mark.type)).toContain("link");
    expect(result?.marks?.map((mark) => mark.type)).toContain("bold");
  });
  it("replaces a whole top-level paragraph with rich blocks but rejects rich partial/list replacement", () => {
    const editor = create("<p>원문</p><p>보존</p>");
    editor.commands.setTextSelection({ from: 1, to: 3 });
    const draft = aiTextToBlocks("## 수정\n\n새 문단");
    expect(
      applyAiBlocks(
        editor,
        "제목",
        captureAiSnapshot(editor, "제목"),
        draft,
        true,
      ),
    ).toBe(true);
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual([
      "heading",
      "paragraph",
      "paragraph",
    ]);
    expect(editor.getText()).toContain("보존");
    const partial = create("<p>부분 원문</p>");
    partial.commands.setTextSelection({ from: 2, to: 4 });
    expect(
      applyAiBlocks(
        partial,
        "제목",
        captureAiSnapshot(partial, "제목"),
        draft,
        true,
      ),
    ).toBe(false);
    const list = create("<ul><li><p>원문</p></li></ul>");
    list.commands.setTextSelection({ from: 3, to: 5 });
    expect(
      applyAiBlocks(list, "제목", captureAiSnapshot(list, "제목"), draft, true),
    ).toBe(false);
  });
  it("inserts after the enclosing table without changing cells", () => {
    const editor = create(
      "<table><tr><td><p>셀 내용</p></td></tr></table><p>뒤</p>",
    );
    editor.commands.setTextSelection(5);
    const snapshot = captureAiSnapshot(editor, "제목"),
      table = editor.getJSON().content![0];
    expect(
      applyAiBlocks(editor, "제목", snapshot, aiTextToBlocks("새 블록"), false),
    ).toBe(true);
    expect(editor.getJSON().content![0]).toEqual(table);
    expect(editor.state.doc.child(1).textContent).toBe("새 블록");
  });
  it("appends below a mixed-format selection without replacing it and anchors the next request after the new blocks", () => {
    const editor = create("<p>앞 <strong>선택</strong> 원문</p><p>뒤 문단</p>");
    editor.commands.setTextSelection({ from: 1, to: 8 });
    const snapshot = captureAiSnapshot(editor, "제목");
    expect(snapshot.canApply).toBe(false);
    const original = editor.getJSON().content!;
    expect(
      applyAiBlocks(
        editor,
        "제목",
        snapshot,
        aiTextToBlocks("## 첫 결과\n\n본문"),
        false,
      ),
    ).toBe(true);
    expect(editor.getJSON().content![0]).toEqual(original[0]);
    expect(editor.getJSON().content!.at(-1)).toEqual(original[1]);
    expect(
      applyAiBlocks(
        editor,
        "제목",
        captureAiSnapshot(editor, "제목"),
        aiTextToBlocks("다음 결과"),
        false,
      ),
    ).toBe(true);
    expect(editor.state.doc.child(3).textContent).toBe("다음 결과");
    expect(editor.state.doc.child(4).textContent).toBe("뒤 문단");
  });
  it("rejects stale body/title/page, read-only, blank and unsafe drafts without a transaction", () => {
    const editor = create("<p>원문</p>"),
      snapshot = captureAiSnapshot(editor, "제목"),
      draft = aiTextToBlocks("결과");
    expect(applyAiBlocks(editor, "새 제목", snapshot, draft, false)).toBe(
      false,
    );
    editor.storage.pageId = "other";
    expect(applyAiBlocks(editor, "제목", snapshot, draft, false)).toBe(false);
    editor.storage.pageId = "page";
    editor.setEditable(false);
    expect(applyAiBlocks(editor, "제목", snapshot, draft, false)).toBe(false);
    editor.setEditable(true);
    expect(
      applyAiBlocks(editor, "제목", snapshot, aiTextToBlocks(""), false),
    ).toBe(false);
    expect(
      applyAiBlocks(
        editor,
        "제목",
        snapshot,
        {
          type: "doc",
          content: [{ type: "image", attrs: { src: "http://private/x" } }],
        },
        false,
      ),
    ).toBe(false);
    editor.commands.insertContent("변경");
    expect(applyAiBlocks(editor, "제목", snapshot, draft, false)).toBe(false);
  });
});
