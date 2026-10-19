import { Button, Group, Text, Modal, PasswordInput } from "@mantine/core";
import { z } from "zod/v4";
import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { changePassword } from "@/features/auth/services/auth-service.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import classes from "@/components/settings/settings.module.css";
import { isPersonalMode } from "@/lib/config";

export default function ChangePassword() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl" className={classes.preferenceRow}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text size="md">{t("Password")}</Text>
        <Text size="sm" c="dimmed">
          {t("You can change your password here.")}
        </Text>
      </div>

      <Button onClick={open} variant="default" className={classes.preferenceAction}>
        {t("Change password")}
      </Button>

      <Modal
        opened={opened}
        onClose={close}
        title={t("Change password")}
        centered
      >
        <Text mb="md">
          {t(isPersonalMode() ? "Use at least one character. A longer password is recommended." : "Your password must be a minimum of 8 characters.")}
        </Text>
        <ChangePasswordForm onClose={close} />
      </Modal>
    </Group>
  );
}

const passwordSchema = (personal: boolean) => z.object({
  oldPassword: z
    .string({ error: "your current password is required" })
    .min(personal ? 1 : 8),
  newPassword: z.string({ error: "New password is required" }).min(personal ? 1 : 8),
});

type FormValues = z.infer<ReturnType<typeof passwordSchema>>;

interface ChangePasswordFormProps {
  onClose?: () => void;
}
function ChangePasswordForm({ onClose }: ChangePasswordFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    validate: zod4Resolver(passwordSchema(isPersonalMode())),
    initialValues: {
      oldPassword: "",
      newPassword: "",
    },
  });

  async function handleSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      await changePassword({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
      notifications.show({
        message: t("Password changed successfully"),
      });

      onClose();
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response.data.message}`,
        color: "red",
      });
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <PasswordInput
        label={t("Current password")}
        name="oldPassword"
        placeholder={t("Enter your current password")}
        variant="filled"
        mb="md"
        data-autofocus
        visibilityToggleButtonProps={{
          "aria-label": t("Toggle password visibility"),
          "aria-hidden": false,
          tabIndex: 0,
        }}
        {...form.getInputProps("oldPassword")}
      />

      <PasswordInput
        label={t("New password")}
        placeholder={t("Enter your new password")}
        variant="filled"
        mb="md"
        visibilityToggleButtonProps={{
          "aria-label": t("Toggle password visibility"),
          "aria-hidden": false,
          tabIndex: 0,
        }}
        {...form.getInputProps("newPassword")}
      />

      <Group justify="flex-end" mt="md">
        <Button type="submit" disabled={isLoading} loading={isLoading}>
          {t("Change password")}
        </Button>
      </Group>
    </form>
  );
}
