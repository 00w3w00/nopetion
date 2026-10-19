import { appPath } from "@/lib/app-path";
import React from "react";
import { Group, Text } from "@mantine/core";
import classes from "./auth.module.css";
import { getAppName } from "@/lib/config";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <>
      <Group justify="center" gap={8} className={classes.logo}>
        <img
          src={appPath("/icons/nopetion.svg")}
          alt={getAppName()}
          width={22}
          height={22}
        />
        <Text size="28px" fw={700} style={{ userSelect: "none" }}>
          {getAppName()}
        </Text>
      </Group>
      <Text size="sm" ta="center" c="dimmed" mb="md">Notion? Nope. Your docs, your rules.</Text>
      <main>{children}</main>
    </>
  );
}
