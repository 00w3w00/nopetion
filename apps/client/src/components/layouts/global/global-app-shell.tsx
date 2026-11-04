import { AppShell, Box, Container } from "@mantine/core";
import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SettingsSidebar from "@/components/settings/settings-sidebar.tsx";
import { useAtom } from "jotai";
import {
  asideStateAtom,
  desktopSidebarAtom,
  mobileSidebarAtom,
  sidebarWidthAtom,
  personalSidebarWidthAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { SpaceSidebar } from "@/features/space/components/sidebar/space-sidebar.tsx";
import { AppHeader } from "@/components/layouts/global/app-header.tsx";
import Aside from "@/components/layouts/global/aside.tsx";
import classes from "./app-shell.module.css";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import GlobalSidebar from "@/components/layouts/global/global-sidebar.tsx";
import PersonalSidebar from "@/features/personal/components/personal-sidebar";
import PersonalAccountMenu from "@/features/personal/components/personal-account-menu";
import { isPersonalMode } from "@/lib/config";
import { ASIDE_PANEL_ID } from "@/hooks/use-toggle-aside.tsx";
import { MAIN_CONTENT_ID, SkipToMain } from "@/components/ui/skip-to-main.tsx";

export default function GlobalAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation(["translation", "personal-ai"]);

  const [mobileOpened] = useAtom(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const [desktopOpened] = useAtom(desktopSidebarAtom);
  const [{ isAsideOpen, tab: asideTab }] = useAtom(asideStateAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [personalWidth, setPersonalWidth] = useAtom(personalSidebarWidthAtom);
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isSpaceRoute = location.pathname.startsWith("/s/");
  const personalSidebar = isPersonalMode() && !isSettingsRoute;
  const defaultWidth = personalSidebar ? 240 : 300;
  const storedWidth = Number(personalSidebar ? personalWidth : sidebarWidth);
  const width = Number.isFinite(storedWidth)
    ? Math.min(600, Math.max(220, storedWidth))
    : defaultWidth;
  const setWidth = personalSidebar ? setPersonalWidth : setSidebarWidth;
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = React.useCallback(
    (mouseDownEvent: React.MouseEvent) => {
      if (mouseDownEvent.button !== 0) return;
      mouseDownEvent.preventDefault();
      setIsResizing(true);
    },
    [],
  );

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing && sidebarRef.current) {
        const newWidth =
          mouseMoveEvent.clientX -
          sidebarRef.current.getBoundingClientRect().left;
        if (newWidth < 220) {
          setWidth(220);
          return;
        }
        if (newWidth > 600) {
          setWidth(600);
          return;
        }
        setWidth(newWidth);
      }
    },
    [isResizing, setWidth],
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    window.addEventListener("blur", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      window.removeEventListener("blur", stopResizing);
    };
  }, [resize, stopResizing]);

  const isPageRoute = location.pathname.includes("/p/");
  const showGlobalSidebar = !isSpaceRoute && !isSettingsRoute;
  const showAside = isAsideOpen && !(isPersonalMode() && asideTab === "chat");
  const isPersonalAiAside = isPersonalMode() && asideTab === "personal-ai";
  const asideTransform = showAside
    ? "translateX(0)"
    : "translateX(var(--app-shell-aside-width))";
  const asideTransformRtl = showAside
    ? "translateX(0)"
    : "translateX(calc(var(--app-shell-aside-width) * -1))";

  return (
    <>
      <SkipToMain />
      <AppShell
        data-personal-shell={isPersonalMode() || undefined}
        header={{ height: 45 }}
        navbar={{
          width: personalSidebar || isSpaceRoute ? width : 300,
          breakpoint: "sm",
          collapsed: {
            mobile: !mobileOpened,
            desktop: !desktopOpened,
          },
        }}
        aside={
          isPageRoute && {
            width: isPersonalAiAside ? 420 : 350,
            breakpoint: "sm",
            collapsed: { mobile: !showAside, desktop: !showAside },
          }
        }
        padding={isPersonalMode() ? 0 : "md"}
        style={
          isPageRoute
            ? ({
                "--app-shell-aside-transform": asideTransform,
                "--app-shell-aside-transform-rtl": asideTransformRtl,
              } as React.CSSProperties)
            : undefined
        }
      >
        {!(personalSidebar && isPageRoute) && (
          <AppShell.Header px={0} className={classes.header}>
            <AppHeader />
          </AppShell.Header>
        )}
        <AppShell.Navbar
          className={classes.navbar}
          withBorder={false}
          ref={sidebarRef}
          aria-label={
            isSpaceRoute
              ? t("Space navigation")
              : isSettingsRoute
                ? t("Settings navigation")
                : t("Main navigation")
          }
        >
          {(personalSidebar || isSpaceRoute) && (
            <div
              className={classes.resizeHandle}
              role="separator"
              tabIndex={0}
              aria-label={t("Resize sidebar")}
              aria-orientation="vertical"
              aria-valuemin={220}
              aria-valuemax={600}
              aria-valuenow={width}
              data-resizing={isResizing || undefined}
              onMouseDown={startResizing}
              onDoubleClick={() => setWidth(defaultWidth)}
              onKeyDown={(event) => {
                const step = event.shiftKey ? 50 : 10;
                const next =
                  event.key === "ArrowLeft"
                    ? width - step
                    : event.key === "ArrowRight"
                      ? width + step
                      : event.key === "Home"
                        ? 220
                        : event.key === "End"
                          ? 600
                          : null;
                if (next === null) return;
                event.preventDefault();
                setWidth(Math.min(600, Math.max(220, next)));
              }}
            />
          )}
          <div className={classes.sidebarContent}>
            {personalSidebar && <PersonalSidebar />}
            {!personalSidebar && isSpaceRoute && <SpaceSidebar />}
            {isSettingsRoute && <SettingsSidebar />}
            {!personalSidebar && showGlobalSidebar && <GlobalSidebar />}
          </div>
          {isPersonalMode() && (
            <Box
              visibleFrom="sm"
              className={classes.accountFooter}
              data-personal-account-footer
            >
              <PersonalAccountMenu />
            </Box>
          )}
        </AppShell.Navbar>
        <AppShell.Main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className={classes.main}
        >
          {isSettingsRoute ? (
            <Container size={900} className={classes.settingsContent}>
              {children}
            </Container>
          ) : (
            children
          )}
        </AppShell.Main>

        {isPageRoute && (
          <AppShell.Aside
            id={ASIDE_PANEL_ID}
            tabIndex={-1}
            className={
              isPersonalAiAside ? classes.personalAiAside : classes.aside
            }
            p={isPersonalAiAside ? 0 : "md"}
            withBorder={isPersonalAiAside}
            aria-label={
              isPersonalAiAside
                ? t("personal-ai:chat")
                : asideTab === "comments"
                  ? t("Comments")
                  : asideTab === "toc"
                    ? t("Table of contents")
                    : asideTab === "chat"
                      ? t("AI Chat")
                      : asideTab === "details"
                        ? t("Details")
                        : undefined
            }
          >
            {!isPersonalAiAside && <Aside />}
          </AppShell.Aside>
        )}
      </AppShell>
    </>
  );
}
