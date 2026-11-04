import { FC } from "react";
import { Button } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { showAiMenuAtom } from "@/features/editor/atoms/editor-atoms";
import type { Editor } from "@tiptap/core";
import { isPersonalMode } from "@/lib/config";
import { openPersonalAi } from "@/features/personal-ai/open-personal-ai";

export const AskAiGroup: FC<{ editor: Editor }> = ({ editor }) => {
  const { t } = useTranslation();
  const setShowAiMenu = useSetAtom(showAiMenuAtom);

  return (
    <Button
      variant="subtle"
      color="dark"
      size="xs"
      leftSection={<IconSparkles size={14} />}
      disabled={!editor.isEditable || editor.isDestroyed}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (!editor.isEditable || editor.isDestroyed) return;
        if (isPersonalMode()) openPersonalAi(editor);
        else setShowAiMenu(true);
      }}
    >
      {t("Ask AI")}
    </Button>
  );
};
