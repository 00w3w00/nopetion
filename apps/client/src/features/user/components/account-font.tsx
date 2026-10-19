import { useState } from "react";
import { Group, Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { currentUserAtom } from "../atoms/current-user-atom";
import { appFonts, resolveAppFont, type AppFont } from "../app-fonts";
import { updateUser } from "../services/user-service";
import type { ICurrentUser } from "../types/user.types";
import classes from "@/components/settings/settings.module.css";

export default function AccountFont() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const font = resolveAppFont(currentUser?.user?.settings?.preferences?.appFont);

  const changeFont = async (value: string | null) => {
    if (!value || pending || value === font || !currentUser) return;
    const { user, workspace } = currentUser;
    setPending(true);
    try {
      const updated = await updateUser({ appFont: value as AppFont });
      const apply = (current: ICurrentUser | null | undefined) =>
        current?.user?.id === user.id && current?.workspace?.id === workspace.id
          ? { ...current, user: updated }
          : current;
      // A delayed response must never replace a newly selected workspace/account.
      setCurrentUser(apply);
      queryClient.setQueryData<ICurrentUser>(["currentUser"], apply);
    } catch {
      notifications.show({ color: "red", message: t("Failed to update preferences") });
    } finally {
      setPending(false);
    }
  };

  return <Group justify="space-between" wrap="nowrap" gap="xl" className={classes.preferenceRow}>
    <Stack gap={4}>
      <Text size="md">{t("Font")}</Text>
      <Text size="sm" c="dimmed">{t("Choose the font for the app and default document text.")}</Text>
      <Text size="sm" style={{ fontFamily: appFonts[font] }}>{t("Your docs, your rules.")}</Text>
    </Stack>
    <Select
      className={classes.preferenceControl}
      label={t("Select font")}
      value={font}
      onChange={changeFont}
      disabled={pending}
      allowDeselect={false}
      checkIconPosition="right"
      data={[
        { value: "pretendard", label: t("Pretendard (default)") },
        { value: "inter", label: "Inter" },
        { value: "system", label: t("System font") },
        { value: "serif", label: t("Serif") },
        { value: "mono", label: t("Monospace") },
      ]}
      renderOption={({ option }) => <span style={{ fontFamily: appFonts[option.value as AppFont] }}>{option.label}</span>}
    />
  </Group>;
}
