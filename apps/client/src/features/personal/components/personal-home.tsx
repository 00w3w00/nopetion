import {
  Alert,
  Button,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import {
  IconFile,
  IconSearch,
  IconStar,
  IconTemplate,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { useRecentChangesQuery } from "@/features/page/queries/page-query";
import { searchSpotlight } from "@/features/search/constants";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { platformModifierLabel } from "@/lib/utils";
import type { IPage } from "@/features/page/types/page.types";
import type { IFavorite } from "@/features/favorite/types/favorite.types";
import classes from "./personal-home.module.css";

const RECENT_PREVIEW_LIMIT = 6;
const FAVORITE_PREVIEW_LIMIT = 4;

function PageIcon({ icon }: { icon?: string | null }) {
  return icon ? (
    <span className={classes.emoji} aria-hidden="true">
      {icon}
    </span>
  ) : (
    <IconFile size={20} stroke={1.7} aria-hidden="true" />
  );
}

function RecentCard({ page }: { page: IPage }) {
  const { t } = useTranslation();
  const updated = useTimeAgo(page.updatedAt);
  return (
    <UnstyledButton
      component={Link}
      to={buildPageUrl(page.space.slug, page.slugId, page.title)}
      className={classes.recentCard}
    >
      <span className={classes.cardIcon}>
        <PageIcon icon={page.icon} />
      </span>
      <Text className={classes.cardTitle} lineClamp={2}>
        {getPageTitle(page.title, page.isBase, t)}
      </Text>
      <Text className={classes.cardMeta} lineClamp={1}>
        {page.space.name || t("Personal pages")}
        {updated ? ` · ${updated}` : ""}
      </Text>
    </UnstyledButton>
  );
}

function FavoriteRow({ favorite }: { favorite: IFavorite }) {
  const { t } = useTranslation();
  if (!favorite.page) return null;
  return (
    <UnstyledButton
      component={Link}
      to={buildPageUrl(
        favorite.space?.slug as string,
        favorite.page.slugId,
        favorite.page.title,
      )}
      className={classes.favoriteRow}
    >
      <span className={classes.favoriteIcon}>
        <PageIcon icon={favorite.page.icon} />
      </span>
      <span className={classes.favoriteCopy}>
        <Text className={classes.favoriteTitle} lineClamp={1}>
          {getPageTitle(favorite.page.title, favorite.page.isBase, t)}
        </Text>
        {favorite.space?.name && (
          <Text className={classes.cardMeta} lineClamp={1}>
            {favorite.space.name}
          </Text>
        )}
      </span>
    </UnstyledButton>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Alert color="red" variant="light" role="alert">
      <Group justify="space-between" gap="sm">
        <Text size="sm">{t("Failed to load pages")}</Text>
        <Button size="compact-xs" variant="subtle" onClick={onRetry}>
          {t("Retry")}
        </Button>
      </Group>
    </Alert>
  );
}

function LoadingCards({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div className={classes.recentGrid} aria-label={t("Loading")}>
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} height={116} radius="md" />
      ))}
    </div>
  );
}

export default function PersonalHome() {
  const { t } = useTranslation();
  const user = useAtomValue(userAtom);
  const recent = useRecentChangesQuery();
  const favorites = useFavoritesQuery("page");
  const [recentVisible, setRecentVisible] = useState(RECENT_PREVIEW_LIMIT);
  const [favoritesVisible, setFavoritesVisible] = useState(
    FAVORITE_PREVIEW_LIMIT,
  );
  const recentPages = recent.data?.pages.flatMap((page) => page.items) ?? [];
  const favoriteItems =
    favorites.data?.pages
      .flatMap((page) => page.items)
      .filter((item) => item.page) ?? [];

  return (
    <div className={classes.root}>
      <DocumentTitle title={t("Home")} />
      <header className={classes.hero}>
        <Text className={classes.eyebrow}>{t("Home")}</Text>
        <Title order={1} className={classes.title}>
          {t("Welcome back, {{name}}", {
            name: user?.name || t("there"),
            defaultValue: "Welcome back, {{name}}",
          })}
        </Title>
        <Text className={classes.subtitle}>
          {t("Pick up where you left off.", {
            defaultValue: "Pick up where you left off.",
          })}
        </Text>
      </header>

      <div className={classes.quickActions}>
        <UnstyledButton
          className={classes.quickAction}
          onClick={() => searchSpotlight.open()}
        >
          <span className={classes.quickIcon}>
            <IconSearch size={19} />
          </span>
          <span>
            <Text fw={600} size="sm">
              {t("Search")}
            </Text>
            <Text className={classes.quickDescription}>
              {t("Find anything in your workspace", {
                defaultValue: "Find anything in your workspace",
              })}
            </Text>
          </span>
          <kbd className={classes.shortcut}>{platformModifierLabel} K</kbd>
        </UnstyledButton>
        <UnstyledButton
          component={Link}
          to="/templates"
          className={classes.quickAction}
        >
          <span className={classes.quickIcon}>
            <IconTemplate size={19} />
          </span>
          <span>
            <Text fw={600} size="sm">
              {t("Templates")}
            </Text>
            <Text className={classes.quickDescription}>
              {t("Start with a ready-made page", {
                defaultValue: "Start with a ready-made page",
              })}
            </Text>
          </span>
        </UnstyledButton>
      </div>

      <section className={classes.section} aria-labelledby="recent-pages-title">
        <Group justify="space-between" align="center" mb="sm">
          <Title
            order={2}
            id="recent-pages-title"
            className={classes.sectionTitle}
          >
            {t("Recent documents")}
          </Title>
          {(recentPages.length > recentVisible || recent.hasNextPage) && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              onClick={() => {
                setRecentVisible((value) => value + RECENT_PREVIEW_LIMIT);
                if (
                  recentVisible + RECENT_PREVIEW_LIMIT >= recentPages.length &&
                  recent.hasNextPage
                ) {
                  void recent.fetchNextPage();
                }
              }}
              disabled={recent.isFetchingNextPage}
            >
              {recent.isFetchingNextPage ? t("Loading") : t("Load more")}
            </Button>
          )}
        </Group>
        {recent.isLoading ? (
          <LoadingCards count={3} />
        ) : recent.isError ? (
          <SectionError onRetry={() => void recent.refetch()} />
        ) : recentPages.length ? (
          <div className={classes.recentGrid}>
            {recentPages.slice(0, recentVisible).map((page) => (
              <RecentCard key={page.id} page={page} />
            ))}
          </div>
        ) : (
          <div className={classes.empty}>
            <IconFile size={24} stroke={1.5} />
            <Text fw={600} size="sm">
              {t("No pages yet")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("Pages you create will show up here.")}
            </Text>
          </div>
        )}
      </section>

      <section
        className={classes.section}
        aria-labelledby="favorite-pages-title"
      >
        <Group justify="space-between" align="center" mb="sm">
          <Title
            order={2}
            id="favorite-pages-title"
            className={classes.sectionTitle}
          >
            {t("Favorites")}
          </Title>
          {(favoriteItems.length > favoritesVisible ||
            favorites.hasNextPage) && (
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              onClick={() => {
                setFavoritesVisible((value) => value + FAVORITE_PREVIEW_LIMIT);
                if (
                  favoritesVisible + FAVORITE_PREVIEW_LIMIT >=
                    favoriteItems.length &&
                  favorites.hasNextPage
                ) {
                  void favorites.fetchNextPage();
                }
              }}
              loading={favorites.isFetchingNextPage}
            >
              {t("Load more")}
            </Button>
          )}
        </Group>
        {favorites.isLoading ? (
          <Stack gap={7}>
            <Skeleton height={54} radius="md" />
            <Skeleton height={54} radius="md" />
          </Stack>
        ) : favorites.isError ? (
          <SectionError onRetry={() => void favorites.refetch()} />
        ) : favoriteItems.length ? (
          <div className={classes.favoriteList}>
            {favoriteItems.slice(0, favoritesVisible).map((favorite) => (
              <FavoriteRow key={favorite.id} favorite={favorite} />
            ))}
          </div>
        ) : (
          <div className={classes.empty}>
            <IconStar size={24} stroke={1.5} />
            <Text fw={600} size="sm">
              {t("No favorites yet")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("Pages you star will show up here.")}
            </Text>
          </div>
        )}
      </section>
    </div>
  );
}
