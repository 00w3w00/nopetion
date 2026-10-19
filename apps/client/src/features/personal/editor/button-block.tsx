import { useState } from "react";
import {
  ActionIcon,
  Button,
  Popover,
  Textarea,
  TextInput,
} from "@mantine/core";
import { IconSettings, IconBolt } from "@tabler/icons-react";
import { NodeViewProps } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import classes from "./block-input.module.css";

export default function ButtonBlock({
  node,
  editor,
  getPos,
  updateAttributes,
}: Pick<NodeViewProps, "node" | "editor" | "getPos" | "updateAttributes">) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState(node.attrs.title || "");
  const [text, setText] = useState(node.attrs.value || "");
  return (
    <div className={classes.buttonRow}>
      <Button
        variant="default"
        size="sm"
        leftSection={<IconBolt size={16} />}
        disabled={!editor.isEditable}
        onClick={() => {
          const pos = getPos();
          const live = typeof pos === "number" && editor.state.doc.nodeAt(pos);
          if (
            !editor.isEditable ||
            editor.isDestroyed ||
            !live ||
            live.type.name !== "personalWidget" ||
            live.attrs.kind !== "button"
          )
            return;
          const content = String(live.attrs.value || "")
            .split("\n")
            .map((line) => ({
              type: "paragraph",
              ...(line ? { content: [{ type: "text", text: line }] } : {}),
            }));
          editor
            .chain()
            .focus()
            .insertContentAt(pos + live.nodeSize, content)
            .run();
        }}
      >
        {node.attrs.title || t("Add a block below")}
      </Button>
      {editor.isEditable && (
        <Popover
          opened={opened}
          onChange={setOpened}
          position="bottom-start"
          width={340}
          shadow="md"
          trapFocus
        >
          <Popover.Target>
            <ActionIcon
              className={classes.buttonSettings}
              variant="subtle"
              color="gray"
              aria-label={t("Edit button")}
              onClick={() => {
                setTitle(node.attrs.title || "");
                setText(node.attrs.value || "");
                setOpened(!opened);
              }}
            >
              <IconSettings size={16} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown className={classes.popup}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editor.isEditable) {
                  updateAttributes({ title, value: text });
                  setOpened(false);
                }
              }}
            >
              <TextInput
                label={t("Button name")}
                aria-label={t("Block title")}
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.currentTarget.value)}
              />
              <Textarea
                mt="sm"
                label={t("Insert blocks below")}
                aria-label={t("Button block content")}
                autosize
                minRows={3}
                maxLength={10000}
                value={text}
                onChange={(e) => setText(e.currentTarget.value)}
              />
              <Button fullWidth mt="sm" type="submit">
                {t("Done")}
              </Button>
            </form>
          </Popover.Dropdown>
        </Popover>
      )}
    </div>
  );
}
