import { Button, Group } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { pageEditorAtom, yjsSyncedAtom } from "@/features/editor/atoms/editor-atoms";
export function EmptyPageGetStarted({ pageId, editable }: { pageId: string; editable: boolean }) {
  const editor = useAtomValue(pageEditorAtom), synced = useAtomValue(yjsSyncedAtom), { t } = useTranslation();
  if (!editable || !synced || !editor?.isEmpty || editor.storage.pageId !== pageId) return null;
  return <Group gap="xs" contentEditable={false}>{["table", "board"].map(view => <Button key={view} variant="default" size="xs" onClick={() => {
    if (!editor.isEditable || editor.isDestroyed || editor.storage.pageId !== pageId) return;
    editor.commands.insertContent([{ type: "personalDatabase", attrs: { id: crypto.randomUUID(), title: t("Database"), view }, content: [] }, { type: "paragraph" }]);
  }}>{t(view === "table" ? "Table view" : "Board view")}</Button>)}</Group>;
}
