import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Editor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createStore, Provider } from "jotai";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import FloatingTableOfContents from "./floating-table-of-contents";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const editors: Editor[] = [];
const scrollTo = vi.fn();
beforeEach(() => {
  scrollTo.mockClear();
  window.scrollTo = scrollTo;
  Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches: false }) });
});
afterEach(() => { cleanup(); editors.splice(0).forEach((editor) => editor.destroy()); });
function mount(content = "<h1>Title</h1><h2>Section A</h2><h2>Section B</h2><h3>Detail B</h3><h2>Section C</h2><h3>Detail C</h3>") {
  const editor = new Editor({ extensions: [StarterKit], content });
  editors.push(editor);
  const store = createStore();
  render(<Provider store={store}><EditorContent editor={editor} /><FloatingTableOfContents editor={editor} /></Provider>);
  return { editor, store };
}
describe("automatic page outline", () => {
  it("appears automatically and opens the hierarchical heading list on hover without clicking", async () => {
    mount();
    const outline = await screen.findByRole("navigation", { name: "Table of contents" });
    expect(screen.queryByRole("button", { name: "Section B" })).toBeNull();
    fireEvent.mouseEnter(outline);
    const names = screen.getAllByRole("button").slice(1).map((button) => button.textContent);
    expect(names).toEqual(["Title", "Section A", "Section B", "Detail B", "Section C", "Detail C"]);
    expect(screen.getByRole("button", { name: "Detail B" }).style.paddingInlineStart).toBe("36px");
    fireEvent.mouseLeave(outline);
    expect(screen.queryByRole("button", { name: "Section B" })).toBeNull();
  });
  it("scrolls to a heading without editing the document or selection", async () => {
    const { editor } = mount();
    const outline = await screen.findByRole("navigation");
    fireEvent.mouseEnter(outline);
    const heading = editor.view.dom.querySelectorAll("h2")[1];
    vi.spyOn(heading, "getBoundingClientRect").mockReturnValue({ top: 900 } as DOMRect);
    const original = editor.getJSON();
    const selection = editor.state.selection;
    fireEvent.click(screen.getByRole("button", { name: "Section B" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 820, behavior: "smooth" });
    expect(editor.getJSON()).toEqual(original);
    expect(editor.state.selection).toBe(selection);
  });
  it("updates after editing headings and disappears when the last heading is removed", async () => {
    const { editor } = mount();
    fireEvent.mouseEnter(await screen.findByRole("navigation"));
    act(() => { editor.commands.setContent("<h2>Renamed</h2><h3></h3>"); });
    expect(await screen.findByRole("button", { name: "Renamed" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Section B" })).toBeNull();
    act(() => { editor.commands.setContent("<p>No headings</p>"); });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeNull());
  });
  it("opens with keyboard focus, dismisses with Escape and yields to an open aside", async () => {
    const { store } = mount();
    const trigger = await screen.findByRole("button", { name: "Table of contents" });
    fireEvent.focus(trigger);
    expect(screen.getByRole("button", { name: "Section A" })).toBeTruthy();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Section A" })).toBeNull();
    act(() => { store.set(asideStateAtom, { tab: "personal-ai", isAsideOpen: true }); });
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
