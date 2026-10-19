import { useEffect, useState } from "react";
import {
  ActionIcon,
  Group,
  Loader,
  NavLink,
  Select,
  Text,
} from "@mantine/core";
import {
  IconChevronLeft,
  IconFile,
  IconHome,
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

export default function PersonalSidebar() {
  const { t } = useTranslation();
  const { t: tc } = useTranslation('classification');
  const { spaceSlug } = useParams();
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
  const { data: favorites } = useFavoritesQuery("page");
  const ability = useSpaceAbility(space?.membership?.permissions);
  const canCreate =
    !!space && ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  const { handleCreate } = useTreeMutation(space?.id || "");
  const [creating, setCreating] = useState(false);
  const currentEditor = useAtomValue(pageEditorAtom);
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
          onClick={closeMobile}
        />
        <NavLink component={Link} to="/classifications" label={tc('title')}
          leftSection={<IconTags size={18} />} active={location.pathname === '/classifications'}
          aria-current={location.pathname === '/classifications' ? 'page' : undefined} onClick={closeMobile} />
        <NavLink
          component={Link}
          to={space ? `/templates?spaceId=${space.id}` : "/templates"}
          label={t("Templates")}
          leftSection={<IconTemplate size={18} />}
          active={location.pathname === "/templates"}
          aria-current={location.pathname === "/templates" ? "page" : undefined}
          onClick={closeMobile}
        />
      </nav>
      <div className={classes.scroller}>
        {!!favorites?.pages.some((p) => p.items.length) && (
          <section className={classes.favorites}>
            <Text className={classes.heading}>{t("Favorites")}</Text>
            {favorites.pages
              .flatMap((p) => p.items)
              .filter((item) => item.page)
              .map((item) => (
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
                  onClick={closeMobile}
                />
              ))}
          </section>
        )}
        <Group justify="space-between" className={classes.sectionHeading}>
          <Text className={classes.heading}>{t("Personal pages")}</Text>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="xs"
            aria-label={t("New document")}
            disabled={!canCreate || creating}
            onClick={create}
          >
            <IconPlus size={15} />
          </ActionIcon>
        </Group>
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
          leftSection={creating ? <Loader size={15} /> : <IconPlus size={18} />}
          disabled={!canCreate || creating}
          onClick={create}
        />
        <NavLink
          component={Link}
          to="/spaces"
          label={t("All spaces")}
          leftSection={<IconChevronLeft size={16} />}
          onClick={closeMobile}
        />
      </div>
      <nav className={classes.footer} aria-label={t("Settings and trash")}>
        <NavLink
          component={Link}
          to="/settings/account/preferences"
          label={t("Settings")}
          leftSection={<IconSettings size={18} />}
          onClick={closeMobile}
        />
        {space && (
          <NavLink
            component={Link}
            to={`${getSpaceUrl(space.slug)}/trash`}
            label={t("Trash")}
            leftSection={<IconTrash size={18} />}
            onClick={closeMobile}
          />
        )}
        <Text className={classes.hint}>
          ● {t("Automatically saved to database")}
        </Text>
      </nav>
    </div>
  );
}
