import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { IUser } from "@/features/user/types/user.types";

const mode = vi.hoisted(() => ({ personal: true }));
vi.mock("@/lib/config", () => ({ isPersonalMode: () => mode.personal }));
import { collabExtensions } from "./collaboration-extensions";

const editors: Editor[] = [];
const documents: Y.Doc[] = [];
const owner = { id: "owner", name: "소유자", avatarUrl: null } as IUser;

function createEditor() {
  const document = new Y.Doc();
  documents.push(document);
  const provider = { document } as HocuspocusProvider;
  const extensions = collabExtensions(provider, owner);
  const editor = new Editor({
    extensions: [StarterKit.configure({ undoRedo: false }), ...extensions],
  });
  editors.push(editor);
  return { editor, document, extensions };
}

afterEach(() => {
  editors.splice(0).forEach(editor => editor.destroy());
  documents.splice(0).forEach(document => document.destroy());
  mode.personal = true;
});

describe("Personal editor synchronization", () => {
  it("keeps Yjs edits in sync between owner tabs without exposing people cursors", () => {
    const a = createEditor();
    const b = createEditor();
    expect(a.extensions.map(extension => extension.name)).toEqual(["collaboration"]);
    a.editor.commands.setContent("<p>저장되는 개인 문서</p>");
    Y.applyUpdate(b.document, Y.encodeStateAsUpdate(a.document));
    expect(b.editor.getJSON()).toEqual(a.editor.getJSON());
    b.editor.commands.insertContentAt(1, "다른 탭의 한글 ");
    Y.applyUpdate(a.document, Y.encodeStateAsUpdate(b.document));
    expect(a.editor.getJSON()).toEqual(b.editor.getJSON());
    expect(a.editor.getText()).toContain("다른 탭의 한글 저장되는 개인 문서");
  });

  it("retains cursor presence configuration outside personal mode", () => {
    mode.personal = false;
    const document = new Y.Doc();
    documents.push(document);
    const extensions = collabExtensions({ document } as HocuspocusProvider, owner);
    expect(extensions.map(extension => extension.name)).toEqual(["collaboration", "collaborationCaret"]);
    expect(extensions[1]).toMatchObject({ options: { user: { id: owner.id, name: owner.name } } });
  });
});
