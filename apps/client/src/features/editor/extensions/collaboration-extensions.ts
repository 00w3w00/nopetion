import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCaret } from "@tiptap/extension-collaboration-caret";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { IUser } from "@/features/user/types/user.types";
import { isPersonalMode } from "@/lib/config";
import { randomElement, userColors } from "./utils";

export function collabExtensions(provider: HocuspocusProvider, user: IUser) {
  const synchronization = Collaboration.configure({
    document: provider.document,
    provider,
  });

  // Personal documents still synchronize and persist through Yjs. Only the
  // people/cursor presence decoration is unnecessary for the single owner.
  if (isPersonalMode()) return [synchronization];

  return [
    synchronization,
    CollaborationCaret.configure({
      provider,
      user: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        color: randomElement(userColors),
      },
    }),
  ];
}
