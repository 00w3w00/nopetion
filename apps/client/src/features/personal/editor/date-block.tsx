import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Popover, Button, TextInput, Text, Group } from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import { notifications } from "@mantine/notifications";
import classes from "./block-input.module.css";

export default function DateBlock({
  node,
  editor,
  updateAttributes,
}: NodeViewProps) {
  const { t, i18n } = useTranslation();
  const [opened, setOpened] = useState(!!editor.storage.personalDatePending);
  useEffect(() => {
    delete editor.storage.personalDatePending;
  }, [editor]);
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduled, setScheduled] = useState<string | null>(null);
  useEffect(() => {
    if (opened && node.attrs.id && editor.storage.pageId) {
      let alive = true;
      api.post("/personal-reminders/list", { pageId: editor.storage.pageId }).then((data: any) => {
        if (alive) setScheduled(data.data.find((r: any) => r.blockId === node.attrs.id && !r.deliveredAt)?.dueAt || null);
      }).catch(() => {});
      return () => { alive = false; };
    }
  }, [opened, editor, node.attrs.id]);
  const saveReminder = async (cancel = false) => {
    if (!editor.isEditable || !editor.storage.pageId) return;
    const id = node.attrs.id || crypto.randomUUID();
    const date = new Date(due);
    if (!cancel && (!due || !Number.isFinite(date.getTime()))) return;
    setSaving(true);
    try {
      if (!node.attrs.id) updateAttributes({ id });
      const remindAt = cancel ? null : date.toISOString();
      await api.post("/personal-reminders/set", { pageId: editor.storage.pageId, blockId: id, ...(remindAt ? { dueAt: remindAt } : {}) });
      if (!editor.isDestroyed && editor.isEditable) updateAttributes({ remindAt });
      setScheduled(remindAt);
      notifications.show({ message: t(cancel ? "Reminder cancelled" : "Reminder scheduled") });
    } catch { notifications.show({ message: t("Could not save reminder"), color: "red" }); }
    finally { setSaving(false); }
  };
  const raw = /^\d{4}-\d{2}-\d{2}$/.test(node.attrs.value)
    ? node.attrs.value
    : "";
  const date = raw ? new Date(raw + "T12:00:00") : null;
  const label =
    date && Number.isFinite(date.getTime())
      ? date.toLocaleDateString(i18n.language, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : t("Date");
  return (
    <NodeViewWrapper as="span" data-type="personalDate" contentEditable={false}>
      <Popover
        opened={opened && editor.isEditable}
        onChange={setOpened}
        position="bottom-start"
        shadow="md"
        trapFocus
      >
        <Popover.Target>
          <button
            className={classes.dateMention}
            onClick={() => setOpened(!opened)}
            disabled={!editor.isEditable}
            aria-label={t("Date")}
          >
            @{label}
          </button>
        </Popover.Target>
        <Popover.Dropdown className={classes.popup}>
          <DatePicker
            value={raw || null}
            locale={i18n.language.split("-")[0]}
            onChange={(value) => {
              if (editor.isEditable) {
                updateAttributes({ value: value || "" });
                setOpened(false);
              }
            }}
          />
          <Text size="xs" mt="sm">{t("Reminder")}</Text>
          {scheduled && <Text size="xs">{new Date(scheduled).toLocaleString(i18n.language)}</Text>}
          <TextInput type="datetime-local" size="xs" aria-label={t("Reminder time")} value={due} onChange={event => setDue(event.currentTarget.value)} />
          <Group gap="xs" mt="xs">
            <Button size="xs" loading={saving} disabled={!due} onClick={() => saveReminder()}>{t("Set reminder")}</Button>
            {scheduled && <Button size="xs" variant="subtle" disabled={saving} onClick={() => saveReminder(true)}>{t("Cancel reminder")}</Button>}
          </Group>
          <Button
            variant="subtle"
            size="xs"
            fullWidth
            onClick={() => {
              if (editor.isEditable) {
                updateAttributes({ value: "" });
                setOpened(false);
              }
            }}
          >
            {t("Clear")}
          </Button>
        </Popover.Dropdown>
      </Popover>
    </NodeViewWrapper>
  );
}
