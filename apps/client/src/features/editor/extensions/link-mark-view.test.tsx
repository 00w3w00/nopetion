import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { Editor, type Attributes } from "@tiptap/core";
import { EditorContent, MarkViewContent, ReactMarkViewRenderer, type MarkViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { LinkExtension } from "../../../../../../packages/editor-ext/src/lib/link";
import { extendEditableLinkSchema, linkMarkViewOptions, parseEditableLinkHref } from "./link-mark-view";

const editors: Editor[] = [];
afterEach(() => { cleanup(); editors.splice(0).forEach(editor => editor.destroy()); vi.unstubAllEnvs(); });

function LinkFixture({ mark }: MarkViewProps) {
  return <span data-link-wrapper><a href={mark.attrs.href} data-internal={mark.attrs.internal ? "true" : undefined}><MarkViewContent /></a></span>;
}

async function fixture(href = "https://example.test/vault", internal = false) {
  const editor = new Editor({
    extensions: [StarterKit.configure({ link: false }), LinkExtension.extend({
      extendMarkSchema: extendEditableLinkSchema,
      addAttributes() { const attrs: Attributes = this.parent?.() || {}; return { ...attrs, href: { ...attrs.href, parseHTML: parseEditableLinkHref } }; },
      addMarkView() { return ReactMarkViewRenderer(LinkFixture, linkMarkViewOptions); },
    })],
    content: { type: "doc", content: [{ type: "paragraph", content: [
      { type: "text", text: "문서 " }, { type: "text", text: "링크", marks: [{ type: "link", attrs: { href, internal } }] },
    ] }] },
  });
  editors.push(editor); render(<EditorContent editor={editor} />);
  await waitFor(() => expect(editor.view.dom.querySelector("[data-link-wrapper] a")?.textContent).toBe("링크"));
  return editor;
}

describe("native typing around a React link mark", () => {
  it.each(["text", "composition span"])("imports native %s outside the nested content span as unlinked document text", async kind => {
    const editor = await fixture();
    const inserted = kind === "text" ? document.createTextNode(" 한국어와 next text") : document.createElement("span");
    inserted.textContent = " 한국어와 next text";
    editor.view.dom.querySelector("[data-link-wrapper]")!.append(inserted);
    await waitFor(() => expect(editor.getText()).toBe("문서 링크 한국어와 next text"));
    const content = editor.getJSON().content![0].content!;
    expect(content.at(-1)?.marks).toBeUndefined();
    expect(content[1].marks![0].attrs!.href).toBe("https://example.test/vault");
  });

  it("preserves internal-link identity and logical paths when reparsing browser-facing URLs", async () => {
    vi.stubEnv("BASE_URL", "/nopetion/");
    const editor = await fixture(window.location.origin + "/nopetion/s/general/p/page-abc", true);
    editor.view.dom.querySelector("[data-link-wrapper]")!.append(document.createTextNode(" 뒤 입력"));
    await waitFor(() => expect(editor.getText()).toBe("문서 링크 뒤 입력"));
    const link = editor.getJSON().content![0].content![1].marks![0];
    expect(link.attrs!.internal).toBe(true); expect(link.attrs!.href).toBe("/s/general/p/page-abc");
  });
});
