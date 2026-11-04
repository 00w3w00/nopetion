import { useEffect, useState } from "react";
import {
  ActionIcon,
  Loader,
  NavLink,
  Select,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconFile,
  IconHome,
  IconLayoutGrid,
  IconLayoutSidebar,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTemplate,
  IconTrash,
  IconTags,
} from "@tabler/icons-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import {
  useGetSpacesQuery,
  useSpaceQuery,
} from "@/features/space/queries/space-query";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type";
import { useTreeMutation } from "@/features/page/tree/hooks/use-tree-mutation";
import SpaceTree from "@/features/page/tree/components/space-tree";
import { searchSpotlight } from "@/features/search/constants";
import { getSpaceUrl } from "@/lib/config";
import {
  desktopSidebarAtom,
  mobileSidebarAtom,
} from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { buildPageUrl } from "@/features/page/page.utils";
import PersonalAccountMenu from "./personal-account-menu";
import classes from "./personal-sidebar.module.css";
import {
  PERSONAL_PAGE_CREATED,
  type PersonalPageCreated,
} from "../editor/create-page-command";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { platformModifierLabel } from "@/lib/utils";
import { extractPageSlugId } from "@/lib";

const FAVORITES_EXPANDED_KEY = "nopetion.sidebar.favorites-expanded";
const PAGES_EXPANDED_KEY = "nopetion.sidebar.pages-expanded";

function usePersistedExpanded(key: string) {
  const [expanded, setExpanded] = useState(() => {
    try {
      return localStorage.getItem(key) !== "false";
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setExpanded((current) => {
      const next = !current;
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // A restricted browser may not expose persistent storage.
      }
      return next;
    });
  };

  return [expanded, toggle] as const;
}

export default function PersonalSidebar() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation("classification");
  const { spaceSlug, pageSlug } = useParams();
  const workspace = useAtomValue(workspaceAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const mobileOpened = useAtomValue(mobileSidebarAtom);
  const toggleMobile = useToggleSidebar(mobileSidebarAtom);
  const toggleDesktop = useToggleSidebar(desktopSidebarAtom);
  const closeMobile = () => {
    if (mobileOpened) toggleMobile();
  };
  const { data: spaces } = useGetSpacesQuery({ limit: 100 });
  const selectedSpace =
    spaceSlug || workspace?.defaultSpaceId || spaces?.items[0]?.id;
  const { data: space, isPending, isError } = useSpaceQuery(selectedSpace);
  const {
    data: favorites,
    hasNextPage: hasMoreFavorites,
    fetchNextPage: fetchMoreFavorites,
    isFetchingNextPage: loadingMoreFavorites,
  } = useFavoritesQuery("page");
  const ability = useSpaceAbility(space?.membership?.permissions);
  const canCreate =
    !!space && ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  const { handleCreate } = useTreeMutation(space?.id || "");
  const [creating, setCreating] = useState(false);
  const [favoritesExpanded, toggleFavorites] = usePersistedExpanded(
    FAVORITES_EXPANDED_KEY,
  );
  const [pagesExpanded, togglePages] = usePersistedExpanded(PAGES_EXPANDED_KEY);
  const currentEditor = useAtomValue(pageEditorAtom);
  const isHome = location.pathname === "/home";
  const isClassifications = location.pathname === "/classifications";
  const isTemplates = location.pathname === "/templates";
  const isSpaces = location.pathname === "/spaces";
  const isSettings = location.pathname.startsWith("/settings");
  const trashPath = space ? `${getSpaceUrl(space.slug)}/trash` : "";
  useEffect(() => {
    const openCreatedPage = (event: Event) => {
      const { page, editor } = (event as CustomEvent<PersonalPageCreated>)
        .detail;
      if (
        editor !== currentEditor ||
        editor.isDestroyed ||
        page.workspaceId !== workspace?.id
      )
        return;
      navigate(
        buildPageUrl(
          page.spaceId === space?.id ? space.slug : undefined,
          page.slugId,
          page.title,
        ),
      );
      if (mobileOpened) toggleMobile();
    };
    window.addEventListener(PERSONAL_PAGE_CREATED, openCreatedPage);
    return () =>
      window.removeEventListener(PERSONAL_PAGE_CREATED, openCreatedPage);
  }, [
    currentEditor,
    workspace?.id,
    navigate,
    space?.id,
    space?.slug,
    mobileOpened,
    toggleMobile,
  ]);
  const create = async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      await handleCreate(null);
      closeMobile();
    } catch {
      /* The mutation reports errors. */
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className={classes.sidebar} data-personal-navigation>
      <div className={classes.workspace}>
        <PersonalAccountMenu workspaceLabel />
        <ActionIcon
          className={classes.collapse}
          variant="subtle"
          color="gray"
          aria-label={t("Toggle sidebar")}
          onClick={mobileOpened ? toggleMobile : toggleDesktop}
        >
          <IconLayoutSidebar size={17} />
        </ActionIcon>
      </div>
      <nav className={classes.navigation} aria-label={t("Main navigation")}>
        <NavLink
          component="button"
          type="button"
          label={t("Search")}
          leftSection={<IconSearch size={18} />}
          rightSection={
            <span className={classes.shortcut} aria-hidden="true">
              {platformModifierLabel} K
            </span>
          }
          onClick={() => {
            searchSpotlight.open();
            closeMobile();
          }}
        />
        <NavLink
          component={Link}
          to="/home"
          label={t("Home")}
          leftSection={<IconHome size={18} />}
          active={isHome}
          aria-current={isHome ? "page" : undefined}
          onClick={closeMobile}
        />
        <NavLink
          component={Link}
          to="/classifications"
          label={tc("title")}
          leftSection={<IconTags size={18} />}
          active={isClassifications}
          aria-current={isClassifications ? "page" : undefined}
          onClick={closeMobile}
        />
        <NavLink
          component={Link}
          to={space ? `/templates?spaceId=${space.id}` : "/templates"}
          label={t("Templates")}
          leftSection={<IconTemplate size={18} />}
          active={isTemplates}
          aria-current={isTemplates ? "page" : undefined}
          onClick={closeMobile}
        />
      </nav>
      <div className={classes.scroller}>
        {!!favorites?.pages.some((p) => p.items.length) && (
          <section className={classes.favorites}>
            <UnstyledButton
              className={classes.sectionToggle}
              aria-expanded={favoritesExpanded}
              aria-controls="personal-sidebar-favorites"
              onClick={toggleFavorites}
            >
              {favoritesExpanded ? (
                <IconChevronDown size={13} aria-hidden="true" />
              ) : (
                <IconChevronRight size={13} aria-hidden="true" />
              )}
              <Text className={classes.heading}>{t("Favorites")}</Text>
            </UnstyledButton>
            {favoritesExpanded && (
              <div id="personal-sidebar-favorites">
                {favorites.pages
                  .flatMap((p) => p.items)
                  .filter((item) => item.page)
                  .map((item) => {
                    const active =
                      !!pageSlug &&
                      extractPageSlugId(pageSlug) === item.page.slugId;
                    return (
                      <NavLink
                        key={item.id}
                        component={Link}
                        to={buildPageUrl(
                          undefined,
                          item.page.slugId,
                          item.page.title,
                        )}
                        label={item.page.title || t("Untitled")}
                        leftSection={
                          item.page.icon ? (
                            <span>{item.page.icon}</span>
                          ) : (
                            <IconFile size={17} />
                          )
                        }
                        active={active}
                        aria-current={active ? "page" : undefined}
                        onClick={closeMobile}
                      />
                    );
                  })}
                {hasMoreFavorites && (
                  <NavLink
                    component="button"
                    type="button"
                    label={loadingMoreFavorites ? t("Loading") : t("Load more")}
                    disabled={loadingMoreFavorites}
                    onClick={() => void fetchMoreFavorites()}
                    className={classes.loadMore}
                  />
                )}
              </div>
            )}
          </section>
        )}
        <div className={classes.sectionHeading}>
          <UnstyledButton
            className={classes.sectionToggle}
            aria-expanded={pagesExpanded}
            aria-controls="personal-sidebar-pages"
            onClick={togglePages}
          >
            {pagesExpanded ? (
              <IconChevronDown size={13} aria-hidden="true" />
            ) : (
              <IconChevronRight size={13} aria-hidden="true" />
            )}
            <Text className={classes.heading}>{t("Personal pages")}</Text>
          </UnstyledButton>
          <ActionIcon
            className={classes.sectionAction}
            variant="subtle"
            color="gray"
            size="xs"
            aria-label={t("New document")}
            aria-disabled={!canCreate || creating}
            disabled={!canCreate || creating}
            onClick={create}
          >
            <IconPlus size={15} />
          </ActionIcon>
        </div>
        {pagesExpanded && (
          <div id="personal-sidebar-pages">
            {spaces?.items.length > 1 && (
              <Select
                className={classes.spacePicker}
                aria-label={t("Spaces")}
                size="xs"
                variant="unstyled"
                value={space?.slug ?? null}
                data={spaces.items.map((item) => ({
                  value: item.slug,
                  label: item.name,
                }))}
                onChange={(slug) => {
                  if (slug) navigate(getSpaceUrl(slug));
                }}
                allowDeselect={false}
              />
            )}
            <div className={classes.tree}>
              {isPending && <Loader size="sm" aria-label={t("Loading")} />}
              {isError && (
                <Text size="sm" c="red">
                  {t("Failed to fetch space")}
                </Text>
              )}
              {space && (
                <SpaceTree
                  key={space.id}
                  spaceId={space.id}
                  readOnly={!canCreate}
                />
              )}
            </div>
            <NavLink
              component="button"
              label={t("New page")}
              leftSection={
                creating ? <Loader size={15} /> : <IconPlus size={18} />
              }
              aria-disabled={!canCreate || creating}
              disabled={!canCreate || creating}
              onClick={create}
            />
          </div>
        )}
      </div>
      <nav className={classes.footer} aria-label={t("Settings and trash")}>
        <NavLink
          component={Link}
          to="/spaces"
          label={t("All spaces")}
          leftSection={<IconLayoutGrid size={18} />}
          active={isSpaces}
          aria-current={isSpaces ? "page" : undefined}
          onClick={closeMobile}
        />
        <NavLink
          component={Link}
          to="/settings/account/preferences"
          label={t("Settings")}
          leftSection={<IconSettings size={18} />}
          active={isSettings}
          aria-current={isSettings ? "page" : undefined}
          onClick={closeMobile}
        />
        {space && (
          <NavLink
            component={Link}
            to={trashPath}
            label={t("Trash")}
            leftSection={<IconTrash size={18} />}
            active={location.pathname === trashPath}
            aria-current={location.pathname === trashPath ? "page" : undefined}
            onClick={closeMobile}
          />
        )}
      </nav>
    </div>
  );
}
