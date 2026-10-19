import { useState } from "react";
import { Button, Group, Stack, Switch } from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { updateUser } from "@/features/user/services/user-service";
import type { IUser } from "@/features/user/types/user.types";
export default function DocumentAppearance() {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [pending, setPending] = useState(false);
  const update = async (change: Partial<IUser>) => {
    if (pending) return;
    setPending(true);
    try {
      setUser(await updateUser(change));
    } catch {
      notifications.show({
        color: "red",
        message: t("Failed to update preferences"),
      });
    } finally {
      setPending(false);
    }
  };
  const font = user.settings?.preferences?.documentFont || "sans";
  return (
    <Stack gap="sm" p="xs">
      <Group gap={5} grow>
        {(["sans", "serif", "mono"] as const).map((value) => (
          <Button
            key={value}
            variant={font === value ? "light" : "subtle"}
            color="gray"
            size="xs"
            disabled={pending}
            style={{
              fontFamily:
                value === "serif"
                  ? "Georgia, serif"
                  : value === "mono"
                    ? "monospace"
                    : undefined,
            }}
            onClick={() => update({ documentFont: value })}
          >
            {t(
              value === "sans"
                ? "Default font"
                : value === "serif"
                  ? "Serif"
                  : "Monospace",
            )}
          </Button>
        ))}
      </Group>
      <Switch
        label={t("Small text")}
        checked={!!user.settings?.preferences?.smallText}
        disabled={pending}
        onChange={(e) => update({ smallText: e.currentTarget.checked })}
        size="xs"
      />
    </Stack>
  );
}
