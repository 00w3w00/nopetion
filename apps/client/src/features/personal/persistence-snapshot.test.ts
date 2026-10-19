import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { normalizePersistenceSnapshot } from "@docmost/editor-ext";

const snapshot = (doc: Y.Doc) => normalizePersistenceSnapshot(Y.encodeStateAsUpdate(doc));

describe("database receipt snapshots", () => {
  it("matches server GC while preserving the editor's Korean undo history", () => {
    const editor = new Y.Doc();
    const server = new Y.Doc();
    const text = editor.getText("default");
    text.insert(0, "한글 문서 원문");
    Y.applyUpdate(server, Y.encodeStateAsUpdate(editor));
    const undo = new Y.UndoManager(text, { captureTimeout: 0 });
    try {
      text.delete(0, 3);
      Y.applyUpdate(server, Y.encodeStateAsUpdate(editor));
      expect(Y.encodeStateAsUpdate(editor)).not.toEqual(Y.encodeStateAsUpdate(server));
      expect(snapshot(editor)).toEqual(snapshot(server));
      undo.undo();
      expect(text.toString()).toBe("한글 문서 원문");
    } finally {
      undo.destroy();
      editor.destroy();
      server.destroy();
    }
  });

  it("distinguishes a newer deletion even when the state vector is unchanged", () => {
    const editor = new Y.Doc();
    try {
      const text = editor.getText("default");
      text.insert(0, "저장된 문서");
      const persisted = snapshot(editor);
      const vector = Y.encodeStateVector(editor);
      text.delete(0, 2);
      expect(Y.encodeStateVector(editor)).toEqual(vector);
      expect(snapshot(editor)).not.toEqual(persisted);
    } finally {
      editor.destroy();
    }
  });

  it("stays stable through server replay, undo, and redo", () => {
    const editor = new Y.Doc();
    const server = new Y.Doc();
    const text = editor.getText("default");
    text.insert(0, "이전 문서");
    const undo = new Y.UndoManager(text, { captureTimeout: 0 });
    const check = () => {
      Y.applyUpdate(server, Y.encodeStateAsUpdate(editor));
      const current = snapshot(editor);
      expect(current).toEqual(snapshot(server));
      expect(normalizePersistenceSnapshot(current)).toEqual(current);
    };
    try {
      check();
      text.delete(0, 2);
      check();
      undo.undo();
      check();
      undo.redo();
      check();
    } finally {
      undo.destroy();
      editor.destroy();
      server.destroy();
    }
  });
});
