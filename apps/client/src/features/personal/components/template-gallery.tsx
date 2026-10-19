import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Modal,
  Pagination,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import {
  IconArrowRight,
  IconFilePlus,
  IconSearch,
  IconTemplate,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DocumentTitle } from "@/components/ui/document-title";
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
import { useCreatePageMutation } from "@/features/page/queries/page-query";
import { buildPageUrl } from "@/features/page/page.utils";
import { personalTemplates } from "../editor/personal-templates";
import { templateCategories } from "../templates/categories";
import classes from "./template-gallery.module.css";

const TemplatePreview = lazy(() => import("./template-preview"));
const pageSize = 24;

export default function TemplateGallery() {
  const { t, i18n } = useTranslation(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const workspace = useAtomValue(workspaceAtom),
    spaces = useGetSpacesQuery({ limit: 100 });
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null),
    [chosenSpace, setChosenSpace] = useState("");
  const [customTitle, setCustomTitle] = useState<string | null>(null),
    [failed, setFailed] = useState(false);
  const creating = useRef(false),
    alive = useRef(true),
    workspaceRef = useRef(workspace?.id);
  workspaceRef.current = workspace?.id;
  const mobile = useMediaQuery("(max-width: 48em)");
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const availableSpaces = spaces.data?.items || [],
    requestedSpace = chosenSpace || params.get("spaceId");
  const spaceId =
    requestedSpace ||
    (availableSpaces.some((s) => s.id === workspace?.defaultSpaceId)
      ? workspace.defaultSpaceId
      : availableSpaces[0]?.id) ||
    "";
  const destination = availableSpaces.find((s) => s.id === spaceId);
  const detail = useSpaceQuery(destination?.id),
    ability = useSpaceAbility(detail.data?.membership?.permissions);
  const mutation = useCreatePageMutation();
  const canCreate =
    !!destination &&
    detail.data?.id === destination.id &&
    !detail.isError &&
    ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page);
  const filtered = personalTemplates.filter(
    (template) =>
      (category === "all" || template.category === category) &&
      `${t(template.title)} ${t(template.description)} ${template.tags.map((tag) => t(tag)).join(" ")}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)),
    currentPage = Math.min(page, pageCount);
  const template = personalTemplates.find((item) => item.id === selected);
  const content = useMemo(
    () => template?.content(t),
    [template, t, i18n.resolvedLanguage],
  );
  const title = customTitle ?? (template ? t(template.title) : "");
  const chooseCategory = (value: string) => {
    setCategory(value);
    setPage(1);
  };
  const close = () => {
    if (!creating.current) setSelected(null);
  };
  const useTemplate = async () => {
    if (
      !canCreate ||
      !template ||
      !destination ||
      !title.trim() ||
      creating.current
    )
      return;
    creating.current = true;
    setFailed(false);
    const originalWorkspace = workspace?.id;
    try {
      const created = await mutation.mutateAsync({
        spaceId: destination.id,
        title: title.trim(),
        icon: template.icon,
        content: template.content(t),
        format: "json",
      });
      if (alive.current && workspaceRef.current === originalWorkspace)
        navigate(buildPageUrl(destination.slug, created.slugId, created.title));
    } catch {
      if (alive.current && workspaceRef.current === originalWorkspace)
        setFailed(true);
    } finally {
      creating.current = false;
    }
  };
  const categoryOptions = [
    { value: "all", label: t("All templates") },
    ...templateCategories.map((item) => ({
      value: item.id,
      label: `${item.icon} ${t(item.label)}`,
    })),
  ];
  return (
    <Container size={1200} className={classes.page}>
      <DocumentTitle title={t("Templates")} />
      <Group gap="sm" mb="xs">
        <IconTemplate size={27} aria-hidden />
        <Title order={1} fz={30}>
          {t("Templates")}
        </Title>
        <Badge variant="light">
          {t("{{count}} templates", { count: personalTemplates.length })}
        </Badge>
      </Group>
      <Text c="dimmed" className={classes.intro}>
        {t(
          "Choose a starting point, preview its blocks, and create your own page.",
        )}
      </Text>
      <div className={classes.tools}>
        <TextInput
          className={classes.search}
          aria-label={t("Search templates...")}
          placeholder={t("Search templates...")}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setPage(1);
          }}
          leftSection={<IconSearch size={17} />}
        />
        <Select
          aria-label={t("Template category")}
          value={category}
          allowDeselect={false}
          data={categoryOptions}
          onChange={(value) => {
            if (typeof value === "string") chooseCategory(value);
          }}
        />
      </div>
      <div className={classes.layout}>
        <nav
          className={classes.categories}
          aria-label={t("Template categories")}
        >
          {categoryOptions.map((item) => (
            <UnstyledButton
              key={item.value}
              aria-pressed={category === item.value}
              data-active={category === item.value || undefined}
              onClick={() => chooseCategory(item.value)}
            >
              <span>{item.label}</span>
              <small>
                {item.value === "all"
                  ? personalTemplates.length
                  : personalTemplates.filter((t) => t.category === item.value)
                      .length}
              </small>
            </UnstyledButton>
          ))}
        </nav>
        <section className={classes.catalog} aria-label={t("Template list")}>
          <span
            id="template-catalog-top"
            className={classes.scrollTarget}
            aria-hidden
          />
          <Text size="sm" c="dimmed" mb="md" role="status" aria-live="polite">
            {t("{{count}} templates found", { count: filtered.length })}
          </Text>
          <div className={classes.grid}>
            {filtered
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((item) => (
                <UnstyledButton
                  key={item.id}
                  className={classes.card}
                  data-template-id={item.id}
                  onClick={() => {
                    setSelected(item.id);
                    setCustomTitle(null);
                    setFailed(false);
                  }}
                >
                  <div
                    className={classes.thumbnail}
                    data-category={item.category}
                  >
                    <span aria-hidden>{item.icon}</span>
                    <div className={classes.previewLines} aria-hidden>
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                  <div className={classes.cardBody}>
                    <strong>{t(item.title)}</strong>
                    <small>{t(item.description)}</small>
                    <span className={classes.cardFooter}>
                      {t(
                        templateCategories.find((c) => c.id === item.category)
                          ?.label || "Essentials",
                      )}
                      <IconArrowRight size={15} aria-hidden />
                    </span>
                  </div>
                </UnstyledButton>
              ))}
          </div>
          {!filtered.length && (
            <Paper withBorder p="xl" radius="md">
              <Text c="dimmed">
                {t("No templates found. Try another search.")}
              </Text>
              <Button
                variant="subtle"
                mt="sm"
                onClick={() => {
                  setQuery("");
                  chooseCategory("all");
                }}
              >
                {t("Clear filters")}
              </Button>
            </Paper>
          )}
          {pageCount > 1 && (
            <Pagination
              className={classes.pagination}
              total={pageCount}
              value={currentPage}
              onChange={(value) => {
                setPage(value);
                document
                  .getElementById("template-catalog-top")
                  ?.scrollIntoView({ block: "start" });
              }}
              siblings={mobile ? 0 : 1}
              boundaries={1}
            />
          )}
        </section>
      </div>
      <Modal
        opened={!!template}
        onClose={close}
        title={template ? t(template.title) : ""}
        size={900}
        fullScreen={mobile}
        centered={!mobile}
        closeOnClickOutside={!mutation.isPending}
        closeOnEscape={!mutation.isPending}
        withCloseButton={!mutation.isPending}
        closeButtonProps={{ "aria-label": t("Close") }}
        classNames={{ body: classes.modalBody }}
      >
        {template && content && (
          <>
            <div className={classes.previewHeader}>
              <Badge variant="light" color="gray">
                {t("Preview")}
              </Badge>
              <Text size="xs" c="dimmed">
                {t("A new page is created when you use this template.")}
              </Text>
            </div>
            <section
              className={classes.preview}
              aria-label={t("Template preview")}
            >
              <Text className={classes.previewIcon} aria-hidden>
                {template.icon}
              </Text>
              <Title order={2} mb="sm">
                {t(template.title)}
              </Title>
              <Text size="sm" c="dimmed" mb="lg">
                {t(template.description)}
              </Text>
              <div className={classes.previewDocument}>
                <Suspense fallback={<Loader size="sm" />}>
                  <TemplatePreview
                    key={`${template.id}:${i18n.resolvedLanguage}`}
                    content={content}
                  />
                </Suspense>
              </div>
            </section>
            <Stack gap="md" className={classes.form}>
              {spaces.isError && (
                <Alert color="red" role="alert">
                  {t("Could not load Spaces")}
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => spaces.refetch()}
                  >
                    {t("Retry")}
                  </Button>
                </Alert>
              )}
              {!spaces.isPending &&
                !spaces.isError &&
                !availableSpaces.length && (
                  <Alert color="gray">
                    {t("Create a Space before using a template.")}
                  </Alert>
                )}
              <div className={classes.fields}>
                <TextInput
                  label={t("Page title")}
                  value={title}
                  maxLength={250}
                  disabled={mutation.isPending}
                  onChange={(event) =>
                    setCustomTitle(event.currentTarget.value)
                  }
                />
                <Select
                  label={t("Destination Space")}
                  placeholder={t("Choose a Space")}
                  value={destination?.id || null}
                  disabled={spaces.isPending || mutation.isPending}
                  data={availableSpaces.map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                  allowDeselect={false}
                  onChange={(value) =>
                    setChosenSpace(typeof value === "string" ? value : "")
                  }
                />
              </div>
              {detail.isError && (
                <Alert color="red" role="alert">
                  {t("Failed to fetch space")}
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => detail.refetch()}
                  >
                    {t("Retry")}
                  </Button>
                </Alert>
              )}
              {destination && detail.isSuccess && !canCreate && (
                <Text size="sm" c="dimmed">
                  {t("You need permission to create pages in this Space.")}
                </Text>
              )}
              {failed && (
                <Alert color="red" role="alert">
                  {t("Failed to create page")}
                </Alert>
              )}
              <Button
                className={classes.apply}
                leftSection={<IconFilePlus size={17} />}
                loading={mutation.isPending}
                disabled={!canCreate || mutation.isPending || !title.trim()}
                onClick={useTemplate}
              >
                {t("Use template")}
              </Button>
              {template.source && (
                <Text size="xs" c="dimmed">
                  {t(
                    "Original Nopetion template. Inspired by this public use case:",
                  )}{" "}
                  <Anchor
                    href={template.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="xs"
                  >
                    {template.source.title}
                  </Anchor>
                </Text>
              )}
            </Stack>
          </>
        )}
      </Modal>
    </Container>
  );
}
