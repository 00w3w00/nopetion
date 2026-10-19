import { Group, Text, ScrollArea, ActionIcon } from "@mantine/core";
import { IconUser, IconSettings, IconArrowLeft, IconSpaces, IconBrush, IconSparkles, IconPlugConnected, IconDeviceMobile } from "@tabler/icons-react";
import { isPersonalMode } from "@/lib/config";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAtomValue } from "jotai";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar";
import { useSettingsNavigation } from "@/hooks/use-settings-navigation";
import { prefetchSpaces } from "./settings-queries";
import AppVersion from "./app-version";
import classes from "./settings.module.css";
const groups = [
  { title: "Account", items: [
    { label: "Profile", icon: IconUser, path: "/settings/account/profile" },
    { label: "Preferences", icon: IconBrush, path: "/settings/account/preferences" },
    { label: "Connections", icon: IconSettings, path: "/settings/connections" },
    { label: "personal-ai:connection", icon: IconSparkles, path: "/settings/personal-ai" },
    ...(isPersonalMode() ? [{ label: "MCP connection", icon: IconPlugConnected, path: "/settings/mcp" }] : []),
    ...(isPersonalMode() ? [{ label: 'server-settings:title', icon: IconSettings, path: '/settings/server' }] : []),
    ...(isPersonalMode() ? [{ label: 'offline:title', icon: IconDeviceMobile, path: '/settings/offline' }] : []),
  ] },
  { title: "Workspace", items: [
    { label: "General", icon: IconSettings, path: "/settings/workspace" },
    { label: "Spaces", icon: IconSpaces, path: "/settings/spaces" },
  ] },
];
export default function SettingsSidebar() {
  const { t } = useTranslation(["translation", "personal-ai", "offline", "server-settings"]), { pathname } = useLocation(), { goBack } = useSettingsNavigation();
  const mobile = useAtomValue(mobileSidebarAtom), toggle = useToggleSidebar(mobileSidebarAtom);
  return <div className={classes.navbar}>
    <Group className={classes.title}><ActionIcon variant="transparent" c="gray" aria-label={t("Back")} onClick={() => { goBack(); if(mobile)toggle(); }}><IconArrowLeft /></ActionIcon><Text fw={500}>{t("Settings")}</Text></Group>
    <ScrollArea w="100%">{groups.map(group => <div key={group.title}><Text c="dimmed" className={classes.linkHeader}>{t(group.title)}</Text>{group.items.map(item => <Link key={item.path} to={item.path} className={classes.link} data-active={pathname === item.path || undefined} onClick={() => { if(mobile)toggle(); }} onMouseEnter={item.label === "Spaces" ? prefetchSpaces : undefined}><item.icon className={classes.linkIcon} stroke={2}/><span>{t(item.label)}</span></Link>)}</div>)}</ScrollArea><AppVersion />
  </div>;
}
