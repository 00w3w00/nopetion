import * as React from "react";
import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import {
  Container,
  Title,
  TextInput,
  Button,
  PasswordInput,
  Box,
  Anchor,
  Text,
} from "@mantine/core";
import useAuth from "@/features/auth/hooks/use-auth";
import classes from "@/features/auth/components/auth.module.css";
import { useTranslation } from "react-i18next";
import { isCloud, isPersonalMode } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { AuthLayout } from "./auth-layout.tsx";

const setupSchema = (personal: boolean, passwordMismatch: string) => z.object({
  workspaceName: z.string().trim().max(50).optional(),
  name: z.string().min(personal ? 0 : 1, { message: "Name is required" }).max(50),
  email: personal ? z.string() : z
    .email({ message: "Invalid email address" })
    .min(1, { message: "Email is required" }),
  password: z.string().min(personal ? 1 : 8, { message: personal ? "Password is required" : "Password must be at least 8 characters" }),
  confirmPassword: z.string(),
}).refine(data => !personal || data.password === data.confirmPassword, {
  message: passwordMismatch,
  path: ["confirmPassword"],
});
type FormValues = z.infer<ReturnType<typeof setupSchema>>;

export function SetupWorkspaceForm() {
  const { t } = useTranslation();
  const personal = isPersonalMode();
  const { setupWorkspace, isLoading } = useAuth();
  // useRedirectIfAuthenticated();

  const form = useForm<FormValues>({
    validate: zod4Resolver(setupSchema(personal, t("Password does not match"))),
    validateInputOnBlur: ["confirmPassword"],
    initialValues: {
      workspaceName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: FormValues) {
    await setupWorkspace(personal ? { password: data.password } : {
      workspaceName: data.workspaceName,
      name: data.name,
      email: data.email,
      password: data.password,
    });
  }

  return (
    <AuthLayout>
      <Container size={420} className={classes.container}>
        <Box p="xl" className={classes.containerBox}>
          <Title order={2} ta="center" fw={500} mb="md">
            {t(personal ? "Start Nopetion" : "Create workspace")}
          </Title>

          {personal && <Text size="sm" c="dimmed">{t("Choose a password to create your personal account. You can change your name later in settings.")}</Text>}

          {isCloud() && null}

          <form onSubmit={form.onSubmit(onSubmit)}>
            {!personal && !isCloud() && (
              <TextInput
                id="workspaceName"
                type="text"
                label={t("Workspace Name")}
                placeholder={t("e.g ACME Inc")}
                variant="filled"
                mt="md"
                {...form.getInputProps("workspaceName")}
              />
            )}

            {!personal && <TextInput
              id="name"
              type="text"
              label={t("Your Name")}
              placeholder={t("enter your full name")}
              variant="filled"
              mt="md"
              {...form.getInputProps("name")}
            />}

            {!personal && <TextInput
              id="email"
              type="email"
              label={t("Your Email")}
              placeholder="email@example.com"
              variant="filled"
              mt="md"
              {...form.getInputProps("email")}
            />}

            <PasswordInput
              id="password"
              label={t("Password")}
              placeholder={t(personal ? "Your password" : "Enter a strong password")}
              description={personal ? t("Use at least one character. A longer password is recommended.") : undefined}
              autoComplete="new-password"
              variant="filled"
              mt="md"
              visibilityToggleButtonProps={{
                "aria-label": t("Toggle password visibility"),
                "aria-hidden": false,
                tabIndex: 0,
              }}
              {...form.getInputProps("password")}
            />
            {personal && <PasswordInput
              id="confirmPassword"
              label={t("Confirm password")}
              placeholder={t("Confirm password")}
              autoComplete="new-password"
              variant="filled"
              mt="md"
              visibilityToggleButtonProps={{
                "aria-label": t("Toggle password visibility"),
                "aria-hidden": false,
                tabIndex: 0,
              }}
              {...form.getInputProps("confirmPassword")}
              error={form.values.password !== form.values.confirmPassword
                ? (form.values.confirmPassword.length > 0 ? t("Password does not match") : form.errors.confirmPassword)
                : undefined}
              errorProps={{ role: "alert" }}
            />}
            <Button type="submit" fullWidth mt="xl" loading={isLoading}
              disabled={personal && (!form.values.password.length || form.values.password !== form.values.confirmPassword)}>
              {t(personal ? "Set password" : "Create workspace")}
            </Button>
          </form>
        </Box>
      </Container>
      {isCloud() && (
        <Text ta="center">
          {t("Already part of an existing workspace?")}{" "}
          <Anchor
            component={Link}
            to={APP_ROUTE.AUTH.SELECT_WORKSPACE}
            fw={500}
          >
            {t("Sign-in")}
          </Anchor>
        </Text>
      )}
    </AuthLayout>
  );
}
