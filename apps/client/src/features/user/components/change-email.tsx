import {
  Modal,
  TextInput,
  Button,
  Text,
  Group,
  PasswordInput,
} from "@mantine/core";
import { z } from "zod/v4";
import { useState } from "react";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { useTranslation } from "react-i18next";
import classes from "@/components/settings/settings.module.css";
import { isPersonalMode } from "@/lib/config";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { updateUser } from "@/features/user/services/user-service";
import { notifications } from "@mantine/notifications";

export default function ChangeEmail() {
  const { t } = useTranslation();
  const [currentUser] = useAtom(currentUserAtom);
  const [opened, { open, close }] = useDisclosure(false);
  const personal = isPersonalMode();
  const hasRecoveryEmail = currentUser?.user.email !== 'owner@nopetion.invalid';

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl" className={classes.preferenceRow}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text size="md">{t(personal ? "Recovery email (optional)" : "Email")}</Text>
        <Text size="sm" c="dimmed">
          {personal && !hasRecoveryEmail ? t("Not set") : currentUser?.user.email}
        </Text>
      </div>

      {personal && <Button onClick={open} variant="default" className={classes.preferenceAction}>
        {t(hasRecoveryEmail ? "Change email" : "Add recovery email")}
      </Button>}

      <Modal
        opened={opened}
        onClose={close}
        title={t("Change email")}
        centered
        closeButtonProps={{ "aria-label": t("Close") }}
      >
        <Text mb="md">
          {t(
            "To change your email, you have to enter your password and new email.",
          )}
        </Text>
        <ChangeEmailForm onClose={close} />
      </Modal>
    </Group>
  );
}

const formSchema = z.object({
  email: z.email({ error: "New email is required" }),
  password: z
    .string({ error: "your current password is required" })
    .min(1),
});

type FormValues = z.infer<typeof formSchema>;

function ChangeEmailForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [, setUser] = useAtom(userAtom);

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: {
      password: "",
      email: "",
    },
  });

  async function handleSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      const user = await updateUser({ email: data.email, confirmPassword: data.password });
      setUser(user);
      notifications.show({ message: t("Updated successfully") });
      onClose();
    } catch {
      notifications.show({ color: "red", message: t("Could not update the recovery email. Check your password and try again.") });
    } finally { setIsLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <PasswordInput
        label={t("Password")}
        placeholder={t("Enter your password")}
        variant="filled"
        mb="md"
        visibilityToggleButtonProps={{
          "aria-label": t("Toggle password visibility"),
          "aria-hidden": false,
          tabIndex: 0,
        }}
        {...form.getInputProps("password")}
      />

      <TextInput
        id="email"
        label={t("Email")}
        description={t("Enter your new preferred email")}
        placeholder={t("New email")}
        variant="filled"
        mb="md"
        {...form.getInputProps("email")}
      />

      <Button type="submit" disabled={isLoading} loading={isLoading}>
        {t("Change email")}
      </Button>
    </form>
  );
}
