import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { JSONContent } from "@tiptap/core";
import { Editor } from "@tiptap/core";
import { aiTextToBlocks } from "./ai-blocks";
import AiDraftPreview from "./ai-draft-preview";

afterEach(() => cleanup());

describe("AI draft preview", () => {
  it("renders safe headings, lists, tables and code as read-only blocks", async () => {
    const draft = aiTextToBlocks(
      "## 검토 결과\n\n- 첫 항목\n- 둘째 항목\n\n| 작업 | 상태 |\n| --- | --- |\n| 검증 | 완료 |\n\n```ts\nconst ready = true;\n```",
    );
    const { container } = render(<AiDraftPreview draft={draft} />);

    expect(
      await screen.findByRole("heading", { name: "검토 결과" }),
    ).toBeTruthy();
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("const ready = true;")).toBeTruthy();
    expect(
      container.querySelector(".tiptap")?.getAttribute("contenteditable"),
    ).toBe("false");
    expect(container.textContent).not.toContain("## 검토 결과");
    expect(container.textContent).not.toContain("| --- | --- |");
  });

  it("rejects links and images instead of mounting active content", () => {
    const unsafe: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "unsafe",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
        { type: "image", attrs: { src: "https://example.com/image.png" } },
      ],
    };
    const { container } = render(<AiDraftPreview draft={unsafe} />);

    expect(container.querySelector("[data-ai-draft-preview]")).toBeNull();
    expect(container.querySelector("a, img")).toBeNull();
  });

  it("updates the existing read-only editor when the draft changes", async () => {
    const { container, rerender } = render(
      <AiDraftPreview draft={aiTextToBlocks("첫 초안")} />,
    );
    await screen.findByText("첫 초안");
    const editorElement = container.querySelector(".tiptap");

    rerender(<AiDraftPreview draft={aiTextToBlocks("## 바뀐 초안")} />);

    expect(
      await screen.findByRole("heading", { name: "바뀐 초안" }),
    ).toBeTruthy();
    expect(screen.queryByText("첫 초안")).toBeNull();
    expect(container.querySelector(".tiptap")).toBe(editorElement);
    expect(editorElement?.getAttribute("contenteditable")).toBe("false");
  });

  it("destroys its editor when the preview unmounts", async () => {
    const destroy = vi.spyOn(Editor.prototype, "destroy");
    const view = render(<AiDraftPreview draft={aiTextToBlocks("정리")} />);
    await screen.findByText("정리");

    view.unmount();

    await waitFor(() => expect(destroy).toHaveBeenCalled());
    destroy.mockRestore();
  });
});
