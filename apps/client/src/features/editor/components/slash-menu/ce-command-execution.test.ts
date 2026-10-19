import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Youtube from "@tiptap/extension-youtube";
import { createLowlight, common } from "lowlight";
vi.mock("@docmost/editor-ext", async () =>
  vi.importActual("../../../../../../../packages/editor-ext/src/index.ts"),
);
import {
  Heading,
  Details,
  DetailsContent,
  DetailsSummary,
  Callout,
  CustomTable,
  TableCell,
  TableHeader,
  TableRow,
  CustomCodeBlock,
  MathBlock,
  MathInline,
  Columns,
  Column,
  TransclusionSource,
  TransclusionReference,
  Subpages,
  TiptapImage,
  TiptapVideo,
  TiptapAudio,
  TiptapPdf,
  Attachment,
  Drawio,
  Excalidraw,
  Embed,
  SharedStorage,
  LinkExtension,
  PersonalDatabase,
  PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
  PersonalWidget,
  PersonalTabs,
  PersonalTab,
  PersonalToggle,
  Mention,
  MentionPluginKey,
  handleImageUpload,
  handleVideoUpload,
  handleAudioUpload,
  handlePdfUpload,
  handleAttachmentUpload,
} from "@docmost/editor-ext";

vi.mock("@/i18n", () => ({
  default: { language: "ko-KR", t: (key: string) => key },
}));
vi.mock("@/features/editor/components/base-embed/insert-base-embed", () => ({
  insertBaseEmbedBlock: vi.fn(),
}));
vi.mock("@/lib/config", () => ({
  isPersonalMode: () => true,
  getFileUploadSizeLimit: () => 50 * 1024 * 1024,
}));
vi.mock("@/features/page/services/page-service", () => ({
  createPage: vi.fn(),
  getPageById: vi.fn(),
  uploadFile: vi.fn(async (file: File) => ({
    id: "attachment-1",
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  })),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  invalidateOnCreatePage: vi.fn(),
}));

import { getSuggestionItems } from "./menu-items";
import { openUploadCommand } from "./upload-command";
import { uploadAttachmentAction } from "../attachment/upload-attachment-action";
import { uploadFile } from "@/features/page/services/page-service";

const editors: Editor[] = [];
// Node views depend on React app providers. This editor exercises the exact CE
// schemas, commands and transactions without mounting unrelated app services.
const plain = <T extends { extend: (...args: any[]) => any }>(extension: T) =>
  extension.extend({ addNodeView: () => null });
function editorForCommand() {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        link: false,
        trailingNode: false,
      }),
      Heading,
      LinkExtension,
      TaskList,
      TaskItem,
      SharedStorage,
      Details,
      DetailsContent,
      DetailsSummary,
      plain(Callout),
      CustomTable,
      TableCell,
      TableHeader,
      TableRow,
      plain(CustomCodeBlock).configure({ lowlight: createLowlight(common) }),
      plain(MathBlock),
      plain(MathInline),
      Columns,
      Column,
      plain(TransclusionSource),
      plain(TransclusionReference),
      plain(Subpages),
      plain(TiptapImage),
      plain(TiptapVideo),
      plain(TiptapAudio),
      plain(TiptapPdf),
      plain(Attachment),
      plain(Drawio),
      plain(Excalidraw),
      plain(Embed),
      Youtube,
      PersonalDatabase,
      PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
      PersonalWidget,
      PersonalTabs,
      PersonalTab,
      PersonalToggle,
      Mention.configure({ suggestion: { allowSpaces: true } }),
    ],
    content: "<p>/</p><p>기존 내용은 보존합니다.</p>",
  });
  editor.storage.pageId = "test-page";
  editor.commands.setTextSelection(2);
  editors.push(editor);
  return editor;
}
function command(title: string) {
  const item = Object.values(getSuggestionItems({ query: "" }))
    .flat()
    .find((item) => item.title === title);
  expect(item, `${title} is exposed by the actual slash menu`).toBeDefined();
  expect(item.command, `${title} has a real command`).toBeTypeOf("function");
  return item;
}
function run(title: string) {
  const editor = editorForCommand();
  command(title).command({ editor, range: { from: 1, to: 2 } });
  editor.state.doc.check();
  expect(editor.getText()).toContain("기존 내용은 보존합니다.");
  expect(editor.getText()).not.toContain("/");
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document
    .querySelectorAll('input[type="file"]')
    .forEach((input) => input.remove());
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("CE slash commands use working editor transactions", () => {
  it("has a concrete executable command and icon for every personal menu item", () => {
    const groups = getSuggestionItems({ query: "" });
    const catalog = Object.values(groups).flat();
    expect(Object.keys(groups)).toHaveLength(7);
    expect(catalog).toHaveLength(99);
    expect(catalog.some(item => item.title === "Mention a person")).toBe(false);
    for (const item of catalog) {
      expect(item.title).toBeTypeOf("string");
      expect(item.description, item.title).toBeTypeOf("string");
      expect(item.icon, item.title).toBeDefined();
      expect(item.command, item.title).toBeTypeOf("function");
      expect(item.requiresBases, item.title).toBeFalsy();
    }
  });
  it.each([
    ["Text", "paragraph"],
    ["Heading 1", "heading"],
    ["Heading 2", "heading"],
    ["Heading 3", "heading"],
    ["Heading 4", "heading"],
    ["Bullet list", "bulletList"],
    ["Numbered list", "orderedList"],
    ["To-do list", "taskList"],
    ["Toggle list", "details"],
    ["Callout", "callout"],
    ["Quote", "blockquote"],
    ["Code", "codeBlock"],
    ["Table", "table"],
    ["Divider", "horizontalRule"],
    ["Math block", "mathBlock"],
    ["Math inline", "mathInline"],
    ["Synced block", "transclusionSource"],
    ["Mermaid diagram", "codeBlock"],
  ])(
    "inserts %s and preserves adjacent document content",
    (title, nodeName) => {
      const editor = run(title);
      let found = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === nodeName) found = true;
      });
      expect(found).toBe(true);
      if (title.startsWith("Heading "))
        expect(editor.state.doc.firstChild.attrs.level).toBe(
          Number(title.charAt(title.length - 1)),
        );
      if (title === "Table") {
        const table = editor.state.doc.firstChild;
        expect(table.childCount).toBe(3);
        expect(table.child(0).childCount).toBe(3);
        expect(table.child(0).firstChild.type.name).toBe("tableHeader");
      }
      if (title === "Mermaid diagram") {
        expect(editor.state.doc.firstChild.attrs.language).toBe("mermaid");
        expect(editor.state.doc.firstChild.textContent).toContain("A --> B");
      }
    },
  );
  it.each([2, 3, 4, 5])(
    "creates %i independently editable columns",
    (count) => {
      const editor = run(`${count} Columns`);
      expect(editor.state.doc.firstChild.type.name).toBe("columns");
      expect(editor.state.doc.firstChild.childCount).toBe(count);
      editor.commands.insertContent("첫째 열 한글");
      expect(editor.state.doc.firstChild.child(0).textContent).toBe(
        "첫째 열 한글",
      );
      expect(editor.state.doc.firstChild.child(1).textContent).toBe("");
    },
  );
  it.each(["Page link", "Mention a page or data source"])(
    "opens the authorized @ selector for %s",
    (title) => {
      const editor = editorForCommand();
      command(title).command({ editor, range: { from: 1, to: 2 } });
      expect(editor.getText()).toContain("@");
      expect(MentionPluginKey.getState(editor.state).active).toBe(true);
      expect(editor.storage.mentionEntityFilter).toBe("page");
    },
  );
  it("preserves existing person and page mention nodes when opening the personal page selector", () => {
    const editor = editorForCommand();
    editor.commands.setContent({ type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "/" }] },
      { type: "paragraph", content: [
        { type: "mention", attrs: { id: "legacy-person-node", entityType: "user", entityId: "legacy-person", label: "기존 이름", creatorId: "original-creator" } },
        { type: "text", text: " 보존한 문장 " },
        { type: "mention", attrs: { id: "legacy-page-node", entityType: "page", entityId: "legacy-page", slugId: "legacy-slug", label: "기존 문서" } },
      ] },
    ] });
    const existingContent = editor.state.doc.child(1).toJSON();
    editor.commands.setTextSelection(2);
    command("Page link").command({ editor, range: { from: 1, to: 2 } });
    expect(editor.state.doc.child(1).toJSON()).toEqual(existingContent);
    const saved = editor.getJSON();
    editor.commands.setContent(saved);
    expect(editor.getJSON()).toEqual(saved);
    expect(editor.getHTML()).toContain("기존 이름");
    expect(editor.getHTML()).toContain("기존 문서");
    editor.state.doc.check();
  });
  it.each([
    ["Image", "image"],
    ["Video", "video"],
    ["Audio", "audio"],
    ["File", "attachment"],
    ["PDF", "pdf"],
  ])(
    "creates the %s upload/link placeholder without opening a native chooser",
    (title, kind) => {
      const click = vi
        .spyOn(HTMLInputElement.prototype, "click")
        .mockImplementation(() => {});
      const editor = run(title);
      expect(click).not.toHaveBeenCalled();
      expect(editor.state.doc.firstChild.attrs).toMatchObject({
        kind: "media",
        provider: kind,
      });
      expect(editor.state.doc.firstChild.attrs.id).toBeTruthy();
    },
  );
  it("uploads the selected file through the authenticated attachment action", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const editor = editorForCommand();
    openUploadCommand(
      { editor, range: { from: 1, to: 2 } },
      { accept: "", upload: uploadAttachmentAction, allowMedia: true },
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["내용"], "회귀검사.txt", { type: "text/plain" });
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() =>
      expect(
        editor.getJSON().content.some((node) => node.type === "attachment"),
      ).toBe(true),
    );
    expect(uploadFile).toHaveBeenCalledWith(file, "test-page");
    expect(editor.state.doc.firstChild.attrs.name).toBe("회귀검사.txt");
    expect(editor.getText()).toContain("기존 내용은 보존합니다.");
  });
  it("waits for every selected file and preserves their order", async () => {
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const editor = editorForCommand();
    openUploadCommand(
      { editor, range: { from: 1, to: 2 } },
      { accept: "", upload: uploadAttachmentAction, allowMedia: true },
    );
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    const files = ["첫째.txt", "둘째.txt", "셋째.txt"].map(
      (name) => new File([name], name, { type: "text/plain" }),
    );
    Object.defineProperty(input, "files", { value: files });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      const names: string[] = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === "attachment") names.push(node.attrs.name);
      });
      expect(names).toEqual(files.map((file) => file.name));
    });
    expect(editor.getText()).toContain("기존 내용은 보존합니다.");
  });
  it.each([
    ["image", handleImageUpload, "image/png"],
    ["video", handleVideoUpload, "video/mp4"],
    ["audio", handleAudioUpload, "audio/mpeg"],
    ["pdf", handlePdfUpload, "application/pdf"],
    ["attachment", handleAttachmentUpload, "text/plain"],
  ] as const)(
    "failed %s uploads remove only their placeholder and keep the next block",
    async (nodeName, factory, mime) => {
      vi.useFakeTimers();
      const createElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation(
        (tagName: string, options?: ElementCreationOptions) => {
          const element = createElement(tagName, options);
          if (tagName === "video")
            queueMicrotask(() => element.dispatchEvent(new Event("error")));
          return element;
        },
      );
      vi.stubGlobal(
        "URL",
        Object.assign(URL, {
          createObjectURL: vi.fn(() => "blob:test"),
          revokeObjectURL: vi.fn(),
        }),
      );
      const editor = editorForCommand();
      editor.commands.deleteRange({ from: 1, to: 2 });
      const followingBlock = editor.state.doc.child(1).toJSON();
      const file = new File(["valid upload fixture"], `검사.${nodeName}`, {
        type: mime,
      });
      const pngHeader = new Uint8Array([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0,
        1, 0, 0, 0, 1,
      ]);
      Object.defineProperty(file, "arrayBuffer", {
        value: async () => pngHeader.buffer,
      });
      let rejectUpload: (reason: Error) => void;
      const onUpload = vi.fn(
        () =>
          new Promise((_, reject) => {
            rejectUpload = reject;
          }),
      );
      const upload = factory({ validateFn: () => true, onUpload });
      const pending = upload(file, editor, 1, "test-page", true);
      await vi.advanceTimersByTimeAsync(260);
      expect(editor.state.doc.firstChild.type.name).toBe(nodeName);
      expect(editor.state.doc.firstChild.attrs.placeholder).toBeTruthy();
      rejectUpload(new Error("upload failure fixture"));
      await pending;
      editor.state.doc.check();
      expect(editor.state.doc.firstChild.toJSON()).toEqual(followingBlock);
      expect(editor.state.doc.childCount).toBe(1);
    },
  );
  it("maps delayed attachment insertion through intervening edits", async () => {
    vi.useFakeTimers();
    const editor = editorForCommand();
    editor.commands.deleteRange({ from: 1, to: 2 });
    let resolveUpload: (value: object) => void;
    const upload = handleAttachmentUpload({
      validateFn: () => true,
      onUpload: () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    });
    const pending = upload(
      new File(["a"], "한글.txt", { type: "text/plain" }),
      editor,
      1,
      "test-page",
      true,
    );
    editor.commands.insertContent("업로드 중 입력한 문장");
    await vi.advanceTimersByTimeAsync(260);
    resolveUpload({
      id: "mapped",
      fileName: "한글.txt",
      fileSize: 1,
      mimeType: "text/plain",
    });
    await pending;
    expect(editor.getText()).toContain("업로드 중 입력한 문장");
    expect(editor.getText()).toContain("기존 내용은 보존합니다.");
    const attachment = editor
      .getJSON()
      .content.find((node) => node.type === "attachment");
    expect(attachment?.attrs.attachmentId).toBe("mapped");
    editor.state.doc.check();
  });
  it("does not insert a completed upload into an editor now showing another page", async () => {
    const editor = editorForCommand();
    editor.commands.deleteRange({ from: 1, to: 2 });
    let resolveUpload: (value: object) => void;
    const upload = handleAttachmentUpload({
      validateFn: () => true,
      onUpload: () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    });
    const before = editor.getJSON();
    const pending = upload(
      new File(["a"], "안전.txt", { type: "text/plain" }),
      editor,
      1,
      "test-page",
      true,
    );
    editor.storage.pageId = "another-page";
    resolveUpload({
      id: "stale",
      fileName: "안전.txt",
      fileSize: 1,
      mimeType: "text/plain",
    });
    await pending;
    expect(editor.getJSON()).toEqual(before);
  });
});
