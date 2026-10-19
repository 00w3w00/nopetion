import {
  Box,
  Group,
  Menu,
  Text,
  UnstyledButton,
  useMantineColorScheme,
} from "@mantine/core";
import {
  IconBrush,
  IconCheck,
  IconChevronDown,
  IconDeviceDesktop,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import useAuth from "@/features/auth/hooks/use-auth";
import APP_ROUTE from "@/lib/app-route";
import classes from "./personal-account-menu.module.css";
import usePersonalWorkspaces from './personal-workspaces';

export default function PersonalAccountMenu({ header = false, workspaceLabel = false }: { header?: boolean; workspaceLabel?: boolean }) {
  const { t } = useTranslation();
  const currentUser = useAtomValue(currentUserAtom);
  const { logout } = useAuth();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { items: workspaceItems, dialog: workspaceDialog } = usePersonalWorkspaces();
  const user = currentUser?.user;
  const workspace = currentUser?.workspace;

  if (!user || !workspace) return null;

  return (
    <>
    <Menu position={workspaceLabel ? 'bottom-start' : header ? 'bottom-end' : 'top-start'} width={300} offset={8} shadow="md">
      <Menu.Target>
        <UnstyledButton
          className={classes.trigger}
          aria-label={`${t("Account")} · ${t("Workspace")}: ${user.name}`}
          data-personal-account-menu={!workspaceLabel || undefined}
          data-personal-workspace-menu={workspaceLabel || undefined}
        >
          <CustomAvatar name={workspaceLabel ? workspace.name : user.name} avatarUrl={workspaceLabel ? workspace.logo : user.avatarUrl} size={workspaceLabel ? 22 : 24} />
          <Text size="sm" fw={workspaceLabel ? 600 : 500} truncate className={classes.name} visibleFrom={header ? 'sm' : undefined}>
            {workspaceLabel ? workspace.name : user.name}
          </Text>
          <IconChevronDown size={14} aria-hidden />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown className={classes.dropdown}>
        <Box px="xs" py="sm">
          <Group gap="sm" wrap="nowrap">
            <CustomAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              size={36}
            />
            <Box className={classes.name}>
              <Text size="sm" fw={600} truncate>
                {user.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {user.email === 'owner@nopetion.invalid' ? t('Personal account') : user.email}
              </Text>
            </Box>
          </Group>
        </Box>
        <Menu.Divider />
        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.ACCOUNT.PROFILE}
          leftSection={<IconUserCircle size={17} />}
        >
          {t("My profile")}
        </Menu.Item>
        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.ACCOUNT.PREFERENCES}
          leftSection={<IconBrush size={17} />}
        >
          {t("My preferences")}
        </Menu.Item>
        <Menu.Sub withinPortal>
          <Menu.Sub.Target>
            <Menu.Sub.Item leftSection={<IconSun size={17} />}>
              {t("Theme")}
            </Menu.Sub.Item>
          </Menu.Sub.Target>
          <Menu.Sub.Dropdown>
            {(
              [
                ["light", "Light", IconSun],
                ["dark", "Dark", IconMoon],
                ["auto", "System settings", IconDeviceDesktop],
              ] as const
            ).map(([value, label, Icon]) => (
              <Menu.Item
                key={value}
                onClick={() => setColorScheme(value)}
                leftSection={<Icon size={16} />}
                rightSection={
                  colorScheme === value ? (
                    <IconCheck size={16} aria-hidden />
                  ) : null
                }
              >
                {t(label)}
              </Menu.Item>
            ))}
          </Menu.Sub.Dropdown>
        </Menu.Sub>

        <Menu.Divider />
        <Menu.Label>{t("Workspace")}</Menu.Label>
        {workspaceItems}
        <Menu.Item
          component={Link}
          to={APP_ROUTE.SETTINGS.WORKSPACE.GENERAL}
          leftSection={<IconSettings size={17} />}
        >
          {t("Workspace settings")}
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={logout} leftSection={<IconLogout size={17} />}>
          {t("Logout")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
    {workspaceDialog}
    </>
  );
}
