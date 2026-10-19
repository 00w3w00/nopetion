import { appPath } from "@/lib/app-path";
import classes from "./page-header.module.css";
import PageHeaderMenu from "@/features/page/components/header/page-header-menu.tsx";
import { Badge, Group, Tooltip, Text } from "@mantine/core";
import { IconExternalLink, IconWorld } from "@tabler/icons-react";
import Breadcrumb from "@/features/page/components/breadcrumbs/breadcrumb.tsx";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { extractPageSlugId } from "@/lib";
import { buildPublicSpaceUrl } from "@/features/page/page.utils.ts";
import { isBetaPublicSpaces, isPersonalMode } from "@/lib/config.ts";
import { ActionIcon } from "@mantine/core";
import { IconLayoutSidebar } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar";
import { useMediaQuery } from "@mantine/hooks";

interface Props {
  readOnly?: boolean;
}
export default function PageHeader({ readOnly }: Props) {
  const { t } = useTranslation();
  const desktopOpen = useAtomValue(desktopSidebarAtom);
  const mobileOpen = useAtomValue(mobileSidebarAtom);
  const mobile = useMediaQuery("(max-width: 47.99em)");
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const { spaceSlug, pageSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const { data: page } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  // Restricted pages are never publicly reachable, so the chip only shows on
  // pages the public site actually serves.
  const showPublicBadge =
    isBetaPublicSpaces() &&
    space?.isPublished &&
    page &&
    page.permissions?.hasRestriction !== true;

  return (
    <header
      className={classes.header}
      data-page-header="true"
      data-personal-header={isPersonalMode() || undefined}
    >
      <Group
        justify="space-between"
        h="100%"
        px={isPersonalMode() ? 0 : "md"}
        wrap="nowrap"
        className={classes.group}
      >
        <Group gap="xs" wrap="nowrap" className={classes.identity}>
          {isPersonalMode() && (mobile || !desktopOpen) && (
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t("Toggle sidebar")}
              aria-expanded={mobile ? mobileOpen : desktopOpen}
              className={classes.sidebarToggle}
              onClick={mobile ? toggleMobile : toggleDesktop}
            >
              <IconLayoutSidebar size={18} />
            </ActionIcon>
          )}
          {isPersonalMode() && (
            <Text
              c="dimmed"
              fz={13}
              visibleFrom="sm"
              style={{ whiteSpace: "nowrap" }}
            >
              {t("Personal pages")} /
            </Text>
          )}
          <Breadcrumb />

          {showPublicBadge && (
            <Tooltip label={t("Open public page")} openDelay={250} withArrow>
              <Badge
                component="a"
                href={appPath(buildPublicSpaceUrl({
                  spaceSlug: space.slug,
                  pageSlugId: page.slugId,
                  pageTitle: page.title,
                }))}
                target="_blank"
                rel="noopener"
                size="sm"
                variant="light"
                leftSection={<IconWorld size={12} />}
                rightSection={<IconExternalLink size={11} />}
                style={{ flexShrink: 0, cursor: "pointer" }}
              >
                {t("Public")}
              </Badge>
            </Tooltip>
          )}
        </Group>

        <Group
          justify="flex-end"
          h="100%"
          px={isPersonalMode() ? 0 : "md"}
          wrap="nowrap"
          gap="var(--mantine-spacing-xs)"
          className={classes.actions}
        >
          <PageHeaderMenu readOnly={readOnly} />
        </Group>
      </Group>
    </header>
  );
}
