import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { createRef } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Mention } from "@docmost/editor-ext";
vi.mock("@docmost/editor-ext", async () => vi.importActual("../../../../../../../packages/editor-ext/src/index.ts"));
const fixture = vi.hoisted(() => ({
  suggestion: { users: [], pages: [] } as { users: any[]; pages: any[] },
  search: vi.fn(), create: vi.fn(), tree: vi.fn(), emit: vi.fn(),
  personalMode: true,
  t: (key: string) => key,
}));
vi.mock("@/features/search/queries/search-query", () => ({ useSearchSuggestionsQuery: (params: object) => { fixture.search(params); return { data: fixture.suggestion, isLoading: false }; } }));
vi.mock("@/features/space/queries/space-query", () => ({ useSpaceQuery: () => ({ data: { id: "space", slug: "general" } }) }));
vi.mock("@/features/page/queries/page-query", () => ({ usePageQuery: () => ({ data: { id: "source-page" } }), useCreatePageMutation: () => ({ mutateAsync: fixture.create }) }));
vi.mock("@/features/personal/editor/create-page-command", () => ({ addCreatedPageToTree: fixture.tree }));
vi.mock("@/features/websocket/use-query-emit", () => ({ useQueryEmit: () => fixture.emit }));
vi.mock("react-router-dom", () => ({ useParams: () => ({ pageSlug: "source-page", spaceSlug: "general" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: fixture.t }) }));
vi.mock("jotai", async () => ({ ...(await vi.importActual<any>("jotai")), useAtom: () => [Object.assign([], { user: { id: "owner" } }), vi.fn()] }));
vi.mock("@/lib/config", () => ({ isPersonalMode: () => fixture.personalMode }));
vi.mock("@/lib", () => ({ extractPageSlugId: (id: string) => id }));
vi.mock("@/components/ui/custom-avatar", () => ({ CustomAvatar: () => null }));
vi.mock("@/components/ui/auto-tooltip-text", () => ({ AutoTooltipText: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@mantine/core", () => {
  const Container = ({ children, role, id, ...props }: any) => <div id={id} role={role} aria-selected={props["aria-selected"]}>{children}</div>;
  return {
    Paper: Container, Text: Container, Group: Container, Divider: () => <hr />, ActionIcon: Container, VisuallyHidden: Container,
    UnstyledButton: ({ children, onClick, ...props }: any) => <button onClick={onClick} role={props.role} aria-selected={props["aria-selected"]}>{children}</button>,
    ScrollArea: { Autosize: ({ children, viewportRef }: any) => <div ref={viewportRef}>{children}</div> },
  };
});
import MentionList from "./mention-list";

const editors: Editor[] = [];
function mount(query: string, filter?: "user" | "page", isInCommentContext = false) {
  const editor = new Editor({ extensions: [StarterKit, Mention], content: `<p>@${query}</p><p>앞서 쓴 내용 보존</p>` });
  editor.storage.pageId = "source-page";
  editor.storage.mentionEntityFilter = filter;
  editors.push(editor);
  const ref = createRef<{ onKeyDown: (props: { event: KeyboardEvent }) => boolean }>();
  const command = vi.fn();
  const range = { from: 1, to: query.length + 2 };
  render(<MentionList ref={ref} editor={editor} query={query} command={command} items={[]} range={range} text={`@${query}`} isInCommentContext={isInCommentContext} />);
  return { editor, ref, command };
}
function enter(ref: ReturnType<typeof createRef<any>>, options: KeyboardEventInit = {}) {
  let consumed = false;
  act(() => { consumed = ref.current.onKeyDown({ event: new KeyboardEvent("keydown", { key: "Enter", ...options }) }); });
  return consumed;
}
beforeEach(() => {
  fixture.personalMode = true;
  fixture.suggestion = { users: [], pages: [] };
  fixture.search.mockClear(); fixture.create.mockReset(); fixture.tree.mockClear();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); editors.splice(0).forEach(editor => editor.destroy()); });

describe("Mention menu selection", () => {
  it("selects the only create-page result with Enter and preserves typing during its request", async () => {
    let resolveCreate: (page: object) => void;
    fixture.create.mockImplementation(() => new Promise(resolve => { resolveCreate = resolve; }));
    const { editor, ref } = mount("새 하위 문서", "page");
    await screen.findByRole("option", { name: "Create page: 새 하위 문서" });
    expect(enter(ref)).toBe(true);
    expect(fixture.create).toHaveBeenCalledWith({ spaceId: "space", parentPageId: "source-page", title: "새 하위 문서" });
    enter(ref);
    expect(fixture.create).toHaveBeenCalledOnce();
    editor.commands.insertContentAt(1, "생성하는 동안 쓴 문장");
    await act(async () => resolveCreate({ id: "child", slugId: "child-slug", title: "새 하위 문서", parentPageId: "source-page", spaceId: "space", position: "a0" }));
    await waitFor(() => expect(editor.getJSON().content[0].content.some(node => node.type === "mention")).toBe(true));
    expect(editor.getText()).toContain("생성하는 동안 쓴 문장");
    expect(editor.getText()).toContain("앞서 쓴 내용 보존");
    expect(fixture.tree).toHaveBeenCalledOnce();
    editor.state.doc.check();
  });
  it("keeps user-only results available outside personal mode", async () => {
    fixture.personalMode = false;
    fixture.suggestion = { users: [{ id: "person", name: "검사 사용자" }], pages: [{ id: "document", title: "검사 페이지", slugId: "document-slug" }] };
    const { ref, command } = mount("검사", "user");
    await screen.findByRole("option", { name: "검사 사용자" });
    expect(screen.queryByRole("option", { name: "검사 페이지" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Create page: 검사" })).toBeNull();
    expect(fixture.search).toHaveBeenLastCalledWith(expect.objectContaining({ includeUsers: true, includePages: false }));
    enter(ref);
    expect(command).toHaveBeenCalledOnce();
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ entityType: "user", entityId: "person" }));
  });
  it.each([undefined, "user", "page"] as const)("only offers pages in personal mode even with the %s entity filter", async (filter) => {
    fixture.suggestion = { users: [{ id: "person", name: "검사 사용자" }], pages: [{ id: "document", title: "검사 페이지", slugId: "document-slug" }] };
    const { ref, command } = mount("검사", filter);
    await screen.findByRole("option", { name: "검사 페이지" });
    expect(screen.queryByRole("option", { name: "검사 사용자" })).toBeNull();
    expect(screen.queryByText("People")).toBeNull();
    expect(screen.getByRole("option", { name: "Create page: 검사" })).toBeTruthy();
    expect(fixture.search).toHaveBeenLastCalledWith(expect.objectContaining({ includeUsers: false, includePages: true }));
    expect(enter(ref)).toBe(true);
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ entityType: "page", entityId: "document" }));
  });
  it("keeps page links available in personal comments without suggesting people or creating child pages", async () => {
    fixture.suggestion = { users: [{ id: "person", name: "검사 사용자" }], pages: [{ id: "document", title: "검사 페이지", slugId: "document-slug" }] };
    const { ref, command } = mount("검사", undefined, true);
    await screen.findByRole("option", { name: "검사 페이지" });
    expect(screen.queryByRole("option", { name: "검사 사용자" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Create page: 검사" })).toBeNull();
    expect(enter(ref)).toBe(true);
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ entityType: "page", entityId: "document" }));
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("ignores Enter while the Korean IME is composing", async () => {
    const { ref } = mount("한글", "page");
    await screen.findByRole("option", { name: "Create page: 한글" });
    expect(enter(ref, { isComposing: true })).toBe(false);
    expect(enter(ref, { keyCode: 229 })).toBe(false);
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("does not insert a late result after navigating away from the source document", async () => {
    let resolveCreate: (page: object) => void;
    fixture.create.mockImplementation(() => new Promise(resolve => { resolveCreate = resolve; }));
    const { editor, ref } = mount("이전 페이지", "page");
    await screen.findByRole("option", { name: "Create page: 이전 페이지" });
    enter(ref);
    editor.storage.pageId = "another-page";
    const before = editor.getJSON();
    await act(async () => resolveCreate({ id: "child", title: "이전 페이지" }));
    expect(editor.getJSON()).toEqual(before);
    expect(fixture.tree).not.toHaveBeenCalled();
  });
});
