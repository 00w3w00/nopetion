import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Mention, MentionPluginKey } from "@docmost/editor-ext";
vi.mock("@docmost/editor-ext", async () => vi.importActual("../../../../../../../packages/editor-ext/src/index.ts"));
vi.mock("./mention-list", () => ({ default: () => null }));
vi.mock("@tiptap/react", async () => {
  const original = await vi.importActual<typeof import("@tiptap/react")>("@tiptap/react");
  return { ...original, ReactRenderer: class { element = document.createElement("div"); updateProps() {} destroy() { this.element.remove(); } } };
});
import mentionRenderItems from "./mention-suggestion";
const editors: Editor[] = [];
async function activeMention() {
  const editor = new Editor({ extensions: [StarterKit, Mention.configure({ suggestion: { render: mentionRenderItems } })], content: "<p></p>" });
  editors.push(editor);
  vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({ left: 10, right: 10, top: 10, bottom: 30 });
  editor.storage.mentionEntityFilter = "page";
  editor.commands.insertContent("@");
  await Promise.resolve(); await Promise.resolve();
  expect(MentionPluginKey.getState(editor.state).active).toBe(true);
  return editor;
}
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); vi.restoreAllMocks(); });
describe("Mention suggestion lifecycle", () => {
  it("exits the editor plugin and clears the slash-menu entity filter with Escape", async () => {
    const editor = await activeMention();
    editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(MentionPluginKey.getState(editor.state).active).toBe(false);
    expect(editor.storage.mentionEntityFilter).toBeUndefined();
    editor.commands.insertContent(" 일반 한글");
    expect(MentionPluginKey.getState(editor.state).active).toBe(false);
  });
  it("fully exits when clicking outside the mention menu", async () => {
    const editor = await activeMention();
    document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(MentionPluginKey.getState(editor.state).active).toBe(false);
    expect(editor.storage.mentionEntityFilter).toBeUndefined();
  });
});
