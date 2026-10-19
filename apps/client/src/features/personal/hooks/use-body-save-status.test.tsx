import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { Schema } from "@tiptap/pm/model";
import { Editor } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Paragraph } from "@tiptap/extension-paragraph";
import { Text } from "@tiptap/extension-text";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { getPageById } from "@/features/page/services/page-service";
import { bodySaveStateAtom } from "../save-status";
import { useBodySaveStatus } from "./use-body-save-status";

vi.mock("@/lib/config", () => ({ isPersonalMode: () => true }));
vi.mock("@/features/page/services/page-service", () => ({ getPageById: vi.fn() }));

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*", attrs: { id: { default: null }, dir: { default: "auto" }, indent: { default: 0 } } },
    text: {},
  },
});
const doc = schema.node("doc", null, [schema.node("paragraph", { id: "korean" }, [schema.text("한글 저장 본문")])]);
// jsonb preserves values but may reorder all object keys, including text nodes.
const persisted = JSON.parse(JSON.stringify(doc.toJSON(), (_key, value) =>
  value && !Array.isArray(value) && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value));

function mount(currentEditor?: Editor) {
  const store = createStore();
  const document = new Y.Doc();
  const provider = { document } as HocuspocusProvider;
  const editor = currentEditor || { schema, state: { doc }, isEmpty: false, isDestroyed: false } as Editor;
  const hook = renderHook(() => useBodySaveStatus("page-1", provider, editor, true, null), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
  return { store, document, hook, unmount: () => { hook.unmount(); document.destroy(); } };
}

beforeEach(() => { vi.mocked(getPageById).mockReset(); });

describe("initial database save confirmation", () => {
  it("keeps a committed document Saved on editable-state updates and marks actual text edits pending", async () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text], content: "<p>한글 저장 본문</p>" });
    vi.mocked(getPageById).mockResolvedValue({ content: editor.getJSON() } as never);
    const mounted = mount(editor);
    try {
      await waitFor(() => expect(mounted.store.get(bodySaveStateAtom).state).toBe("saved"));
      editor.on("update", mounted.hook.result.current);
      act(() => { editor.setEditable(false); editor.setEditable(true); });
      expect(mounted.store.get(bodySaveStateAtom).state).toBe("saved");
      act(() => { editor.commands.insertContent("새 편집"); });
      expect(mounted.store.get(bodySaveStateAtom).state).toBe("saving");
    } finally { mounted.unmount(); editor.destroy(); }
  });

  it("confirms a jsonb document despite reordered object keys after reload", async () => {
    expect(JSON.stringify(persisted)).not.toBe(JSON.stringify(doc.toJSON()));
    vi.mocked(getPageById).mockResolvedValue({ content: persisted } as never);
    const mounted = mount();
    try {
      await waitFor(() => expect(mounted.store.get(bodySaveStateAtom).state).toBe("saved"));
    } finally { mounted.unmount(); }
  });

  it("keeps newer edits pending when an older database read arrives", async () => {
    let resolve: (page: never) => void;
    vi.mocked(getPageById).mockReturnValue(new Promise(done => { resolve = done; }));
    const mounted = mount();
    try {
      act(() => mounted.document.getText("test").insert(0, "저장 대기 중 새 편집"));
      await act(async () => resolve({ content: persisted } as never));
      expect(mounted.store.get(bodySaveStateAtom).state).toBe("saving");
    } finally { mounted.unmount(); }
  });

  it("reports a failed database read without claiming Saved", async () => {
    let reject: (error: Error) => void;
    const pending = new Promise<never>((_resolve, fail) => { reject = fail; });
    vi.mocked(getPageById).mockReturnValue(pending);
    const mounted = mount();
    try {
      await act(async () => {
        reject(new Error("database unavailable"));
        await pending.catch(() => {});
      });
      await waitFor(() => expect(mounted.store.get(bodySaveStateAtom).state).toBe("error"));
    } finally { mounted.unmount(); }
  });
});
