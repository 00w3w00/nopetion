import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import type { IPage } from "@/features/page/types/page.types";
import StarterKit from "@tiptap/starter-kit";
import {
  Mention,
  PersonalDatabase,
  PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
} from "@docmost/editor-ext";
import { getDefaultStore } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { createPage, getPageById } from "@/features/page/services/page-service";
import { selectedPersonalWorkspace } from "@/lib/personal-workspace-scope";
import {
  createPageFromSlash,
  PERSONAL_PAGE_CREATED,
} from "./create-page-command";
vi.mock("@/i18n", () => ({ default: { t: (key: string) => key } }));
vi.mock("@/features/page/services/page-service", () => ({
  createPage: vi.fn(),
  getPageById: vi.fn(),
}));
vi.mock("@/features/page/queries/page-query", () => ({
  invalidateOnCreatePage: vi.fn(),
}));
vi.mock("@mantine/notifications", () => ({
  notifications: { show: vi.fn(() => "loading"), hide: vi.fn() },
}));
vi.mock("@/lib/personal-workspace-scope", () => ({
  selectedPersonalWorkspace: vi.fn(() => "workspace"),
}));
const editors: Editor[] = [];
const source = { id: "parent", spaceId: "space", workspaceId: "workspace" };
const created = {
  id: "child",
  parentPageId: "parent",
  slugId: "child-slug",
  spaceId: "space",
  workspaceId: "workspace",
  position: "a1",
  title: "",
  icon: null,
};
const make = () => {
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      Mention,
      PersonalDatabase,
      PersonalDatabaseRow, PersonalDatabaseProperty, PersonalDatabaseCell,
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "앞 /페이지 뒤" }],
        },
      ],
    },
  });
  editor.storage.pageId = "parent";
  editors.push(editor);
  return editor;
};
const deferred = <T>() => {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<T>((r, fail) => {
    resolve = r;
    reject = fail;
  });
  return {
    promise,
    resolve: (value: T) => resolve(value),
    reject: (error: Error) => reject(error),
  };
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(selectedPersonalWorkspace).mockReturnValue("workspace");
  vi.mocked(getPageById).mockResolvedValue(source as never);
  vi.mocked(createPage).mockResolvedValue(created as never);
  getDefaultStore().set(treeDataAtom, [
    {
      ...source,
      slugId: "parent",
      name: "Parent",
      position: "a0",
      parentPageId: null,
      hasChildren: false,
      children: [],
    },
  ]);
});
afterEach(() =>
  editors.splice(0).forEach((e) => {
    if (!e.isDestroyed) e.destroy();
  }),
);
describe("Slash page creation", () => {
  it("creates a real child, inserts an authorized page mention and updates the live tree", async () => {
    const editor = make(),
      listener = vi.fn();
    window.addEventListener(PERSONAL_PAGE_CREATED, listener);
    try {
      await createPageFromSlash({ editor, range: { from: 3, to: 7 } });
      expect(createPage).toHaveBeenCalledWith({
        spaceId: "space",
        parentPageId: "parent",
      });
      let hasChildMention = false;
      editor.state.doc.descendants((node) => {
        if (node.type.name === "mention" && node.attrs.entityId === "child")
          hasChildMention = true;
      });
      expect(hasChildMention).toBe(true);
      expect(editor.getText()).toContain("앞");
      expect(editor.getText()).toContain("뒤");
      expect(getDefaultStore().get(treeDataAtom)[0]).toMatchObject({
        hasChildren: true,
        children: [{ id: "child" }],
      });
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener(PERSONAL_PAGE_CREATED, listener);
    }
  });
  it("maps the anchor across typing while the creation request is pending", async () => {
    const editor = make(),
      wait = deferred<IPage>();
    vi.mocked(createPage).mockReturnValue(wait.promise);
    const result = createPageFromSlash({ editor, range: { from: 3, to: 7 } });
    await vi.waitFor(() => expect(createPage).toHaveBeenCalledOnce());
    editor.commands.insertContentAt(1, "대기 중 입력 ");
    wait.resolve(created as IPage);
    await result;
    expect(editor.getText()).toContain("대기 중 입력 앞");
    expect(editor.getText()).toContain("뒤");
    expect(JSON.stringify(editor.getJSON())).toContain('"entityId":"child"');
  });
  it("restores an untouched command after failure, preserving surrounding text", async () => {
    const editor = make();
    vi.mocked(createPage).mockRejectedValue(new Error("403"));
    await createPageFromSlash({ editor, range: { from: 3, to: 7 } });
    expect(editor.getText()).toBe("앞 /페이지 뒤");
  });
  it("does not restore an old range over new typing after failure", async () => {
    const editor = make(),
      wait = deferred<IPage>();
    vi.mocked(getPageById).mockReturnValue(wait.promise);
    const result = createPageFromSlash({ editor, range: { from: 3, to: 7 } });
    editor.commands.insertContentAt(3, "작성한 내용");
    wait.reject(new Error("403"));
    await result;
    expect(editor.getText()).toContain("작성한 내용");
  });
  it("does not create in a different workspace or run the same pending command twice", async () => {
    const editor = make(),
      wait = deferred<IPage>();
    vi.mocked(getPageById).mockReturnValue(wait.promise);
    const first = createPageFromSlash({ editor, range: { from: 3, to: 7 } });
    await createPageFromSlash({ editor, range: { from: 3, to: 7 } });
    vi.mocked(selectedPersonalWorkspace).mockReturnValue("other");
    wait.resolve(source as IPage);
    await first;
    expect(createPage).not.toHaveBeenCalled();
  });
  it("creates a full-page database using the same authorized child workflow", async () => {
    const editor = make();
    await createPageFromSlash({ editor, range: { from: 3, to: 7 } }, true);
    expect(createPage).toHaveBeenCalledWith(
      expect.objectContaining({
        parentPageId: "parent",
        content: {
          type: "doc",
          content: [
            expect.objectContaining({ type: "personalDatabase" }),
            { type: "paragraph" },
          ],
        },
      }),
    );
  });
});
