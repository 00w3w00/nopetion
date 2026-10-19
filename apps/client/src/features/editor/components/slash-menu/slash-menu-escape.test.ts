import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
vi.mock("./command-list", () => ({ default: () => null }));
vi.mock("./menu-items", () => ({ default: () => [] }));
vi.mock("@tiptap/react", async () => {
  const original = await vi.importActual<typeof import("@tiptap/react")>("@tiptap/react");
  return { ...original, ReactRenderer: class { element = document.createElement("div"); updateProps() {} destroy() { this.element.remove(); } } };
});
import SlashCommand, { AngleCommand, angleMenuPluginKey, slashMenuPluginKey } from "../../extensions/slash-command";
const editors: Editor[] = [];
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); });
describe("Block menu Escape", () => {
  for (const [char, key] of [["/", slashMenuPluginKey], ["<", angleMenuPluginKey]] as const) {
    it(`fully exits ${char} instead of leaving an invisible keyboard menu`, async () => {
      const editor = new Editor({ extensions: [StarterKit, SlashCommand, AngleCommand], content: "<p></p>" });
      editors.push(editor);
      vi.spyOn(editor.view, "coordsAtPos").mockReturnValue({ left: 10, right: 10, top: 10, bottom: 30 });
      editor.commands.insertContent(char);
      await Promise.resolve(); await Promise.resolve();
      expect(key.getState(editor.state).active).toBe(true);
      editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(key.getState(editor.state).active).toBe(false);
      editor.commands.insertContent(" 일반 텍스트");
      expect(editor.getText()).toContain(`${char} 일반 텍스트`);
      expect(key.getState(editor.state).active).toBe(false);
    });
  }
});
