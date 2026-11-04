import { useRef, useState } from "react";
import { Group, Stack, Switch, Text, UnstyledButton } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { updateUser } from "@/features/user/services/user-service";
import type { IUser } from "@/features/user/types/user.types";
import classes from "./document-appearance.module.css";

export default function DocumentAppearance({
  fullWidth = true,
}: {
  fullWidth?: boolean;
}) {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const update = async (change: Partial<IUser>) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      setUser(await updateUser(change));
    } catch {
      notifications.show({
        color: "red",
        message: t("Failed to update preferences"),
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const preferences = user?.settings?.preferences;
  const font = preferences?.documentFont || "sans";
  return (
    <Stack gap={12} p={8}>
      <Group gap={4} grow wrap="nowrap">
        {(["sans", "serif", "mono"] as const).map((value) => (
          <UnstyledButton
            key={value}
            className={classes.font}
            data-font={value}
            aria-pressed={font === value}
            disabled={pending}
            onClick={() => update({ documentFont: value })}
          >
            <span className={classes.specimen} aria-hidden="true">
              Aa
            </span>
            <Text className={classes.label}>
              {t(
                value === "sans"
                  ? "Default font"
                  : value === "serif"
                    ? "Serif"
                    : "Monospace",
              )}
            </Text>
          </UnstyledButton>
        ))}
      </Group>
      <Switch
        className={classes.toggle}
        label={t("Small text")}
        labelPosition="left"
        checked={!!preferences?.smallText}
        disabled={pending}
        onChange={(e) => update({ smallText: e.currentTarget.checked })}
        size="xs"
      />
      {fullWidth && (
        <Switch
          className={classes.toggle}
          label={t("Full width")}
          labelPosition="left"
          checked={!!preferences?.fullPageWidth}
          disabled={pending}
          onChange={(e) => update({ fullPageWidth: e.currentTarget.checked })}
          size="xs"
        />
      )}
    </Stack>
  );
}
