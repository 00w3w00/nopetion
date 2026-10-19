import { atom, type PrimitiveAtom } from "jotai";
import { Editor } from "@tiptap/core";
import { PageEditMode } from "@/features/user/types/user.types.ts";

// With strictNullChecks disabled, Jotai selects its read-only overload for null.
// These editor holders are writable primitive atoms.
export const pageEditorAtom = atom<Editor | null>(
  null,
) as PrimitiveAtom<Editor | null>;

export const titleEditorAtom = atom<Editor | null>(
  null,
) as PrimitiveAtom<Editor | null>;

export const readOnlyEditorAtom = atom<Editor | null>(null);

export const yjsConnectionStatusAtom = atom<string>("");

export const yjsSyncedAtom = atom<boolean>(false);

export const showAiMenuAtom = atom(false);

export const showLinkMenuAtom = atom(false);

export type LightboxRequest = {
  src: string;
  type: "image" | "video";
} | null;

const initialLightboxRequest: LightboxRequest = null;
export const lightboxRequestAtom = atom(initialLightboxRequest);

// Current page's edit mode — initialized from the user's saved preference on
// first load, can be toggled locally without persisting to the server.
export const currentPageEditModeAtom = atom<PageEditMode>(PageEditMode.Edit);
