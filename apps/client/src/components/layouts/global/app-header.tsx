import { appPath } from "@/lib/app-path";
import PersonalAccountMenu from '@/features/personal/components/personal-account-menu';
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import classes from "./app-header.module.css";
import React from "react";
import TopMenu from "@/components/layouts/global/top-menu.tsx";
import { Link, useLocation } from "react-router-dom";
import { IconSparkles } from "@tabler/icons-react";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import APP_ROUTE from "@/lib/app-route.ts";
import { useAtom } from "jotai";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import SidebarToggle from "@/components/ui/sidebar-toggle-button.tsx";
import { useTranslation } from "react-i18next";
import { useTrial } from "@/features/community/capabilities";
import { getAppName, isCloud, isPersonalMode } from "@/lib/config.ts";
import {
  SearchControl,
  SearchMobileControl,
} from "@/features/search/components/search-control.tsx";
import {
  searchSpotlight,
  shareSearchSpotlight,
} from "@/features/search/constants.ts";
import { NotificationPopover } from "@/features/notification/components/notification-popover.tsx";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";

const links = [
  { link: APP_ROUTE.HOME, label: "Home" },
];

export function AppHeader() {
  const { t } = useTranslation();
  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);

  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const { isTrial, trialDaysLeft } = useTrial();
  const location = useLocation();
  const toggleAside = useToggleAside();
  const [workspace] = useAtom(workspaceAtom);
  const aiChatEnabled = !isPersonalMode() && workspace?.settings?.ai?.chat === true;

  const isPageRoute = location.pathname.includes("/p/");

  const items = links.map((link) => (
    <Link key={link.label} to={link.link} className={classes.link}>
      {t(link.label)}
    </Link>
  ));

  return (
    <>
      <Group h="100%" px="md" justify="space-between" wrap={"nowrap"} className={classes.root}>
        <Group wrap="nowrap" className={classes.identity}>
          <Tooltip label={t("Sidebar toggle")}>
            <SidebarToggle
              aria-label={t("Sidebar toggle")}
              opened={mobileOpened}
              onClick={toggleMobile}
              hiddenFrom="sm"
              size="sm"
            />
          </Tooltip>

          <Tooltip label={t("Sidebar toggle")}>
            <SidebarToggle
              aria-label={t("Sidebar toggle")}
              opened={desktopOpened}
              onClick={toggleDesktop}
              visibleFrom="sm"
              size="sm"
            />
          </Tooltip>

          <Link to="/home" className={classes.brand} aria-label={getAppName()}>
            <Box hiddenFrom="sm" className={classes.brandIcon}>
              <img
                src={appPath("/icons/nopetion.svg")}
                alt={getAppName()}
                width={22}
                height={22}
              />
            </Box>
            <Text
              size="lg"
              fw={600}
              style={{ userSelect: "none" }}
              visibleFrom="sm"
            >
              {getAppName()}
            </Text>
          </Link>

          {!isPersonalMode() && <Group ml={50} gap={5} className={classes.links} visibleFrom="sm">
            {items}
          </Group>}
        </Group>

        <div>
          <Group visibleFrom="sm">
            <SearchControl onClick={searchSpotlight.open} />
          </Group>
          <Group hiddenFrom="sm">
            <SearchMobileControl onSearch={searchSpotlight.open} />
          </Group>
        </div>

        <Group
          px={isPersonalMode() ? 0 : "xl"}
          wrap="nowrap"
          hiddenFrom={isPersonalMode() && desktopOpened ? "sm" : undefined}
        >
          {aiChatEnabled && (
            <>
              <UnstyledButton
                component={Link}
                to="/ai"
                className={classes.link}
                visibleFrom="sm"
                onClick={(e: React.MouseEvent) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                    return;
                  }
                  if (isPageRoute) {
                    e.preventDefault();
                    toggleAside("chat");
                  }
                }}
              >
                {t("AI Chat")}
              </UnstyledButton>
              <Tooltip label={t("AI Chat")} openDelay={250} withArrow>
                <ActionIcon
                  component={Link}
                  to="/ai"
                  variant="subtle"
                  color="dark"
                  size="sm"
                  hiddenFrom="sm"
                  aria-label={t("AI Chat")}
                  onClick={(e: React.MouseEvent) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                      return;
                    }
                    if (isPageRoute) {
                      e.preventDefault();
                      toggleAside("chat");
                    }
                  }}
                >
                  <IconSparkles size={20} stroke={2} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          {!isPersonalMode() && <NotificationPopover />}
          {isCloud() && isTrial && trialDaysLeft !== 0 && (
            <Badge
              variant="light"
              style={{ cursor: "pointer" }}
              component={Link}
              to={APP_ROUTE.SETTINGS.WORKSPACE.BILLING}
              visibleFrom="xs"
            >
              {trialDaysLeft === 1
                ? "1 day left"
                : `${trialDaysLeft} days left`}
            </Badge>
          )}
          <>{isPersonalMode() ? <PersonalAccountMenu header /> : <TopMenu />}</>
        </Group>
      </Group>
    </>
  );
}
