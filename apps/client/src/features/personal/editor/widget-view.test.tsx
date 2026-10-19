import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Editor } from "@tiptap/core";
import { EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  PersonalWidget,
  Embed,
  TiptapImage,
  TiptapVideo,
  TiptapAudio,
  TiptapPdf,
  Attachment,
  PersonalDate,
} from "@docmost/editor-ext";
import { MantineProvider } from "@mantine/core";
import { I18nextProvider } from "react-i18next";
import { createInstance } from "i18next";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import WidgetView from "./widget-view";
import { uploadFile } from "@/features/page/services/page-service";
import DateBlock from "./date-block";
import EmbedView from "@/features/editor/components/embed/embed-view";
import {
  applyAiBlocks,
  captureAiSnapshot,
} from "@/features/personal-ai/ai-editor";

vi.mock("@/features/page/queries/page-query", () => ({
  usePageQuery: () => ({ data: undefined }),
  usePageBreadcrumbsQuery: () => ({ data: [] }),
}));
vi.mock("@/features/page/services/page-service", () => ({
  uploadFile: vi.fn(),
}));
const editors: Editor[] = [];
const language = createInstance();
await language.init({
  lng: "en-US",
  fallbackLng: "en-US",
  resources: {},
  interpolation: { escapeValue: false },
});
beforeEach(() => {
  // jsdom has no Range layout APIs; scrolling is checked in the real browser suite.
  Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    })),
  });
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  };
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: new EventTarget(),
  });
});
afterEach(() => {
  cleanup();
  editors.splice(0).forEach((editor) => editor.destroy());
});

function mount(content: object, editable = true) {
  const editor = new Editor({
    extensions: [
      StarterKit,
      PersonalWidget.extend({
        addNodeView() {
          return ReactNodeViewRenderer(WidgetView);
        },
      }),
      Embed.configure({ view: EmbedView }),
      ...[TiptapImage, TiptapVideo, TiptapAudio, TiptapPdf, Attachment].map(
        (extension) => extension.extend({ addNodeView: () => null }),
      ),
      PersonalDate.extend({
        addNodeView() {
          return ReactNodeViewRenderer(DateBlock);
        },
      }),
    ],
    content,
    editable,
  });
  editors.push(editor);
  const result = render(
    <MantineProvider env="test">
      <I18nextProvider i18n={language}>
        <QueryClientProvider client={new QueryClient()}>
          <MemoryRouter>
            <EditorContent editor={editor} />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </MantineProvider>,
  );
  return { editor, ...result };
}
const documentWith = (attrs: object) => ({
  type: "doc",
  content: [{ type: "personalWidget", attrs }, { type: "paragraph" }],
});

describe("Service blocks in the real editor", () => {
  it("anchors an AI result below its block while retaining surrounding paragraphs", async () => {
    const { editor } = mount({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "위 원문" }] },
        { type: "personalWidget", attrs: { kind: "ai" } },
        { type: "paragraph", content: [{ type: "text", text: "아래 원문" }] },
      ],
    });
    editor.storage.pageId = "ai-test-page";
    const originalFirst = editor.state.doc.firstChild!.toJSON();
    const originalLast = editor.state.doc.lastChild!.toJSON();
    fireEvent.click(
      await screen.findByRole("button", { name: "Open AI assistant" }),
    );
    expect(editor.state.selection.from).toBe(
      editor.state.doc.firstChild!.nodeSize,
    );
    const snapshot = captureAiSnapshot(editor, "검증");
    await act(async () => {
      expect(
        applyAiBlocks(
          editor,
          "검증",
          snapshot,
          {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "테스트 응답" }],
              },
            ],
          },
          false,
        ),
      ).toBe(true);
    });
    expect(editor.state.doc.firstChild!.toJSON()).toEqual(originalFirst);
    expect(editor.state.doc.child(1).attrs.kind).toBe("ai");
    expect(editor.state.doc.child(2).textContent).toBe("테스트 응답");
    expect(editor.state.doc.lastChild!.toJSON()).toEqual(originalLast);
  });
  it("edits a CodePen block, creates a real iframe, and restores its persisted content", async () => {
    const { editor, container, unmount } = mount(
      documentWith({ kind: "embed", provider: "CodePen" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Add CodePen" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Embed URL or iframe code" }),
      {
        target: { value: "https://codepen.io/chriscoyier/pen/gfdDu" },
      },
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Block title" }), {
      target: { value: "실제 코드 예제" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Embed link" }));
    await waitFor(() =>
      expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
        "https://codepen.io/chriscoyier/embed/gfdDu?default-tab=html%2Cresult",
      ),
    );
    expect(editor.state.doc.firstChild?.attrs).toMatchObject({
      value: "https://codepen.io/chriscoyier/pen/gfdDu",
      title: "실제 코드 예제",
    });
    const saved = editor.getJSON();
    unmount();
    const restored = mount(saved);
    await waitFor(() =>
      expect(
        restored.container.querySelector("iframe")?.getAttribute("src"),
      ).toContain("/embed/gfdDu"),
    );
    expect(restored.editor.state.doc.firstChild.attrs.title).toBe(
      "실제 코드 예제",
    );
  });

  it("retains the old embed while editing, rejects private links, and allows cancelling", async () => {
    const { editor, container } = mount(
      documentWith({
        kind: "embed",
        provider: "Google Maps",
        value: "https://www.google.com/maps/embed?pb=!1m2",
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Change link" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Embed URL or iframe code" }),
      { target: { value: '<iframe src="https://127.0.0.1:3000"></iframe>' } },
    );
    expect(
      screen
        .getByRole("button", { name: "Embed link" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(editor.state.doc.firstChild?.attrs.value).toBe(
      "https://www.google.com/maps/embed?pb=!1m2",
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() =>
      expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
        "https://www.google.com/maps/embed?pb=!1m2",
      ),
    );
  });

  it("keeps read-only embeds functional without exposing editing controls or altering content", async () => {
    const { editor, container } = mount(
      documentWith({
        kind: "embed",
        provider: "GitHub Gist",
        value: "https://gist.github.com/user/abcdef123",
      }),
      false,
    );
    await waitFor(() =>
      expect(
        container.querySelector("iframe")?.getAttribute("srcdoc"),
      ).toContain("abcdef123.js"),
    );
    const before = editor.getJSON();
    expect(
      screen
        .getByRole("button", { name: "Change link" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(container.querySelector("input,textarea")).toBeNull();
    expect(
      container.querySelector("iframe")?.getAttribute("sandbox"),
    ).not.toContain("allow-same-origin");
    expect(editor.getJSON()).toEqual(before);
  });

  it("labels the button and adds an editable paragraph below it", async () => {
    const { editor } = mount(documentWith({ kind: "button" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit button" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Block title" }),
      { target: { value: "메모 작성" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(await screen.findByRole("button", { name: "메모 작성" }));
    await waitFor(() => expect(editor.state.doc.childCount).toBe(3));
    expect(editor.state.doc.child(1).type.name).toBe("paragraph");
    await act(async () => {
      editor.commands.insertContent("버튼 아래 저장");
    });
    expect(editor.state.doc.child(1).textContent).toBe("버튼 아래 저장");
  });

  it("opens and saves a CE provider block instead of failing on an empty provider", async () => {
    const { editor, container } = mount({
      type: "doc",
      content: [
        { type: "embed", attrs: { provider: "" } },
        { type: "paragraph" },
      ],
    });
    fireEvent.click(await screen.findByRole("button", { name: "Edit embed" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Embed URL or iframe code" }),
      { target: { value: "https://example.com/embed/demo" } },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Embed link" }));
    await waitFor(() =>
      expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
        "https://example.com/embed/demo",
      ),
    );
    expect(editor.state.doc.firstChild?.attrs.src).toBe(
      "https://example.com/embed/demo",
    );
  });
});

describe("Upload/link inputs in the real editor", () => {
  it.each([
    ["image", "Image", "image/png"],
    ["video", "Video", "video/webm"],
    ["audio", "Audio", "audio/wav"],
    ["pdf", "PDF", "application/pdf"],
    ["attachment", "File", "text/plain"],
  ])(
    "uploads %s through its popup and replaces only that placeholder",
    async (kind, label, mime) => {
      vi.mocked(uploadFile).mockImplementation(
        async (file) =>
          ({
            id: "file",
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          }) as never,
      );
      const { editor } = mount(
        documentWith({ id: "placeholder", kind: "media", provider: kind }),
      );
      editor.storage.pageId = "page";
      fireEvent.click(
        await screen.findByRole("button", { name: `Add ${label}` }),
      );
      const file = new File(["fixture"], "검증 파일", { type: mime });
      fireEvent.change(await screen.findByLabelText(`Upload ${label}`), {
        target: { files: [file] },
      });
      await waitFor(() =>
        expect(editor.state.doc.firstChild.type.name).toBe(kind),
      );
      expect(uploadFile).toHaveBeenLastCalledWith(file, "page");
      expect(editor.state.doc.firstChild.attrs.attachmentId).toBe("file");
      expect(editor.state.doc.lastChild.type.name).toBe("paragraph");
      editor.state.doc.check();
    },
  );
  it("keeps the placeholder and an actionable error after failed upload", async () => {
    vi.mocked(uploadFile).mockRejectedValue(new Error("failure fixture"));
    const { editor } = mount(
      documentWith({ id: "placeholder", kind: "media", provider: "image" }),
    );
    editor.storage.pageId = "page";
    fireEvent.click(await screen.findByRole("button", { name: "Add Image" }));
    fireEvent.change(await screen.findByLabelText("Upload Image"), {
      target: { files: [new File(["png"], "a.png", { type: "image/png" })] },
    });
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Upload failed. Try again.",
    );
    expect(editor.state.doc.firstChild.attrs.kind).toBe("media");
  });
  it("does not write a finished upload after the placeholder was removed", async () => {
    let finish: (value: object) => void;
    vi.mocked(uploadFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve as never;
        }),
    );
    const { editor } = mount(
      documentWith({
        id: "placeholder",
        kind: "media",
        provider: "attachment",
      }),
    );
    editor.storage.pageId = "page";
    fireEvent.click(await screen.findByRole("button", { name: "Add File" }));
    fireEvent.change(await screen.findByLabelText("Upload File"), {
      target: { files: [new File(["txt"], "a.txt", { type: "text/plain" })] },
    });
    await act(async () => {
      editor.commands.deleteRange({ from: 0, to: 1 });
    });
    const before = editor.getJSON();
    await act(async () => {
      finish({ id: "late", fileName: "a.txt", fileSize: 3 });
    });
    expect(editor.getJSON()).toEqual(before);
  });
  it("restores an inline date as a locale-aware mention without a block card", async () => {
    const { editor } = mount({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "일정 " },
            { type: "personalDate", attrs: { value: "2026-10-12" } },
          ],
        },
      ],
    });
    expect(
      (await screen.findByRole("button", { name: "Date" })).textContent,
    ).toContain("October 12, 2026");
    const json = editor.getJSON();
    editor.commands.setContent(json);
    expect(editor.getJSON()).toEqual(json);
    expect(editor.state.doc.childCount).toBe(1);
  });
});
