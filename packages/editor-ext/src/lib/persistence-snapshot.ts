import * as Y from "yjs";

/**
 * Normalize only a receipt copy. UndoManager retains deleted content in the
 * editor, whereas Hocuspocus garbage-collects it. Raw update bytes can differ
 * for the same state; replaying without an UndoManager removes that difference
 * while keeping deletion information, and never changes the live document.
 */
export function normalizePersistenceSnapshot(update: Uint8Array): Uint8Array {
  const copy = new Y.Doc({ gc: true });
  try {
    Y.applyUpdate(copy, update);
    return Y.encodeStateAsUpdate(copy);
  } finally {
    copy.destroy();
  }
}
