import { atom } from "jotai";

export type SaveState = "connecting" | "saving" | "saved" | "error";
export type PageSaveState = { pageId: string; state: SaveState };
export type PersistenceReceipt = {
  type: "page.persisted" | "page.persist-failed";
  pageId: string;
  contentHash: string;
};

// A concrete initial value selects Jotai's writable overload even with the
// upstream tsconfig's strictNullChecks=false.
export const bodySaveStateAtom = atom<PageSaveState>({
  pageId: "",
  state: "connecting",
});
export const titleSaveStateAtom = atom<PageSaveState>({
  pageId: "",
  state: "connecting",
});
export const linkedSourceSaveStatesAtom = atom<
  Record<
    string,
    {
      hostPageId: string;
      sourcePageId: string;
      state: SaveState;
      dirty: boolean;
    }
  >
>({});
