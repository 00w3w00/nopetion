import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
vi.mock("./emoji-list", () => ({ default: () => null }));
vi.mock("@tiptap/react", async () => {
  const original = await vi.importActual<typeof import("@tiptap/react")>("@tiptap/react");
  return { ...original, ReactRenderer: class { element = document.createElement("div"); updateProps() {} destroy() { this.element.remove(); } } };
});
import EmojiCommand, { emojiMenuPluginKey } from "../../extensions/emoji-command";
import renderEmojiItems from "./render-emoji-items";
const editors: Editor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); vi.restoreAllMocks(); });
describe("Emoji suggestion keyboard handling", () => {
  it("fully exits the emoji plugin with Escape", async () => {
    const editor = new Editor({ extensions: [StarterKit, EmojiCommand.configure({ suggestion: { items: () => [] } })], content: "<p></p>" });
    editors.push(editor);
    vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({ left: 10, right: 10, top: 10, bottom: 30 });
    editor.commands.insertContent(":");
    await Promise.resolve(); await Promise.resolve();
    expect(emojiMenuPluginKey.getState(editor.state).active).toBe(true);
    editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(emojiMenuPluginKey.getState(editor.state).active).toBe(false);
  });
  it("does not select an emoji while an IME composition is active", () => {
    const renderer = renderEmojiItems();
    expect(renderer.onKeyDown({ event: new KeyboardEvent("keydown", { key: "Enter", isComposing: true }) })).toBe(false);
    expect(renderer.onKeyDown({ event: new KeyboardEvent("keydown", { key: "Enter", keyCode: 229 }) })).toBe(false);
  });
});
