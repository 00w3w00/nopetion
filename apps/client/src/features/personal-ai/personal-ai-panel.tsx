import { useTranslation } from "react-i18next";
import { AI_LOCALES, aiLocale, aiLanguageName } from "./ai-languages";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap, useMediaQuery } from "@mantine/hooks";
import { useAtom, useAtomValue } from "jotai";
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  CopyButton,
  Group,
  Menu,
  Select,
  Stack,
  Text,
  Textarea,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconChevronsRight,
  IconChecklist,
  IconDots,
  IconFileText,
  IconLanguage,
  IconMessagePlus,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconSparkles,
  IconTextCaption,
} from "@tabler/icons-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { ASIDE_PANEL_ID } from "@/hooks/use-toggle-aside";
import {
  pageEditorAtom,
  titleEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms";
import {
  bodySaveStateAtom,
  titleSaveStateAtom,
} from "@/features/personal/save-status";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { aiError, aiPost, type AiStatus } from "./ai-api";
import {
  captureAiSnapshot,
  documentHash,
  snapshotCurrent,
  type AiSnapshot,
} from "./ai-editor";
import classes from "./personal-ai-panel.module.css";
import { AI_JOB_QUERY_PARAM, aiJobIdFromSearch } from "./ai-job-link";

type AiJob = {
  id: string; pageId: string; title: string; instruction: string; model: string; provider: string;
  action: string; status: "queued" | "generating" | "applying" | "completed" | "conflict" | "failed";
  createdAt: string; errorCode?: string; resultText?: string;
};
const jobActive = (job: AiJob | null) => !!job && ["queued", "generating", "applying"].includes(job.status);
const selectionTasks = [
  { value: "summary", label: "selectionSummary" },
  { value: "polish", label: "selectionPolish" },
  { value: "translate", label: "selectionTranslate" },
];
const tasks = [
  {
    icon: IconTextCaption,
    label: "summary",
    instruction: "promptSummary",
  },
  {
    icon: IconLanguage,
    label: "translate",
    instruction: "promptTranslate",
  },
  {
    icon: IconSearch,
    label: "insights",
    instruction: "promptInsights",
  },
  {
    icon: IconChecklist,
    label: "tracker",
    instruction: "promptTracker",
  },
];

export default function PersonalAiPanel({
  pageId,
  title,
  readOnly = false,
}: {
  pageId: string;
  title: string;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation("personal-ai");
  const responseLocale = aiLocale(i18n.resolvedLanguage || i18n.language);
  const storedEditor = useAtomValue(pageEditorAtom),
    storedTitleEditor = useAtomValue(titleEditorAtom);
  // During SPA navigation the atoms can briefly hold an old/destroyed editor.
  // Tiptap clears its schema on destroy, so even getText() would throw.
  const editor =
    storedEditor &&
    !storedEditor.isDestroyed &&
    storedEditor.storage.pageId === pageId
      ? storedEditor
      : null;
  const titleEditor =
    storedTitleEditor &&
    !storedTitleEditor.isDestroyed &&
    storedTitleEditor.storage.pageId === pageId
      ? storedTitleEditor
      : null;
  const body = useAtomValue(bodySaveStateAtom),
    titleSave = useAtomValue(titleSaveStateAtom),
    connection = useAtomValue(yjsConnectionStatusAtom);
  const [aside, setAside] = useAtom(asideStateAtom);
  const opened = aside.isAsideOpen && aside.tab === "personal-ai";
  const mobile = useMediaQuery("(max-width: 47.99em)");
  const panelRef = useFocusTrap(opened && mobile);
  const [snapshot, setSnapshot] = useState<AiSnapshot | null>(null);
  const [action, setAction] = useState("ask"),
    [question, setQuestion] = useState(""),
    [selectedLanguage, setLanguage] = useState<string | null>(null);
  const language = selectedLanguage || responseLocale;
  const [plan, setPlan] = useState<AiJob | null>(null),
    [written, setWritten] = useState(false),
    [sentRequest, setSentRequest] = useState(""),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [, setRevision] = useState(0);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const hasActiveJob = jobActive(plan);
  const workspaceId = useAtomValue(workspaceAtom)?.id;
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const requestedJobId = aiJobIdFromSearch(location.search);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(requestedJobId);
  const dismissedJob = useRef<string | null>(null);
  const submission = useRef<{ key: string; id: string } | null>(null);
  const submitting = useRef(false);
  const request = useRef(0),
    launcher = useRef<HTMLButtonElement>(null);
  const { pageSlug, spaceSlug } = useParams();
  const routePageId = extractPageSlugId(pageSlug);
  const currentTitle = () => titleEditor?.getText() ?? title;

  useEffect(() => {
    const update = () => setRevision((v) => v + 1);
    editor?.on("update", update);
    titleEditor?.on("update", update);
    return () => {
      editor?.off("update", update);
      titleEditor?.off("update", update);
    };
  }, [editor, titleEditor]);
  useEffect(() => {
    request.current++;
    setSnapshot(null);
    setPlan(null);
    setWritten(false);
    setError("");
    setBusy(false);
    setQuestion("");
    dismissedJob.current = null;
    submission.current = null;
    setAside((state) =>
      state.tab === "personal-ai" ? { ...state, isAsideOpen: false } : state,
    );
    // Renaming changes the readable URL while staying on the same document.
    // Keep the captured source so a pending result cannot use a renamed title.
  }, [pageId, routePageId, spaceSlug, setAside]);
  useEffect(() => {
    setSelectedJobId(requestedJobId);
    if (!requestedJobId || !workspaceId) return;
    dismissedJob.current = null;
    setPlan(null);
    setError(null);
    setWritten(false);
    setAside({ tab: "personal-ai", isAsideOpen: true });
  }, [requestedJobId, pageId, workspaceId, location.key, setAside]);
  useEffect(
    () => () => {
      request.current++;
      setAside((state) =>
        state.tab === "personal-ai" ? { ...state, isAsideOpen: false } : state,
      );
    },
    [setAside],
  );
  useEffect(() => {
    if (!opened) return;
    let active = true;
    setStatus(null);
    aiPost<AiStatus>("status")
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    document
      .getElementById(ASIDE_PANEL_ID)
      ?.querySelector<HTMLElement>("section[data-personal-ai-panel]")
      ?.focus();
    return () => {
      active = false;
    };
  }, [opened]);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true, inFlight = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      let pending = false;
      try {
        const data = await aiPost<{ items: AiJob[] }>("jobs/list", {
          pageId,
          ...(selectedJobId ? { jobId: selectedJobId } : {}),
        }, workspaceId);
        const latest = data.items?.[0];
        pending = jobActive(latest);
        if (active && latest && latest.id !== dismissedJob.current && !submitting.current) {
          setPlan(previous => !selectedJobId && previous && new Date(previous.createdAt) > new Date(latest.createdAt) ? previous : latest);
          setWritten(latest.status === "completed");
          setBusy(pending);
          setSentRequest(latest.action === "ask" ? latest.instruction : t(latest.action === "summary" ? "selectionSummary" : latest.action === "translate" ? "selectionTranslate" : "selectionPolish"));
          setError(latest.errorCode ? { response: { data: { code: latest.errorCode } } } : null);
        } else if (active && selectedJobId && !latest) {
          setPlan(null);
          setBusy(false);
          setError({ response: { status: 403 } });
        }
      } catch (error) {
        pending = true;
        if (active && selectedJobId) setError(error);
      }
      finally {
        inFlight = false;
        if (active && (opened || pending)) timer = setTimeout(refresh, 1500);
      }
    }
    const wake = () => { clearTimeout(timer); void refresh(); };
    void refresh();
    window.addEventListener("focus", wake);
    return () => { active = false; clearTimeout(timer); window.removeEventListener("focus", wake); };
  }, [pageId, workspaceId, opened, hasActiveJob, selectedJobId, t]);

  function clear() {
    setSelectedJobId(null);
    if (requestedJobId) {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.delete(AI_JOB_QUERY_PARAM);
        return next;
      }, { replace: true });
    }
    dismissedJob.current = plan?.id || dismissedJob.current;
    submission.current = null;
    request.current++;
    setPlan(null);
    setWritten(false);
    setSentRequest("");
    setError("");
    setBusy(false);
  }
  function capture(nextAction?: string, reset = true) {
    if (readOnly || !editor || !titleEditor || editor.isDestroyed || (busy && reset)) return;
    if (reset) clear();
    const next = captureAiSnapshot(editor, currentTitle());
    setSnapshot(next);
    setAction(nextAction || (next.text ? "polish" : "ask"));
  }
  function close() {
    setAside({ tab: "personal-ai", isAsideOpen: false });
    requestAnimationFrame(() => launcher.current?.focus());
  }
  function newChat() {
    setQuestion("");
    capture("ask");
  }
  const current =
    !!editor && !!snapshot && snapshotCurrent(editor, currentTitle(), snapshot);
  const saved =
    !!snapshot &&
    body.pageId === snapshot.pageId &&
    body.state === "saved" &&
    (titleSave.pageId !== snapshot.pageId || titleSave.state === "saved") &&
    connection === "connected";
  const ready =
    !readOnly &&
    !!titleEditor &&
    !!editor?.isEditable &&
    saved &&
    (action === "ask" ? !!question.trim() : current && !!snapshot?.text.trim());
  async function send() {
    if (!editor || !snapshot || !ready || busy || submitting.current) return;
    const captured = action === "ask" ? captureAiSnapshot(editor, currentTitle()) : snapshot;
    const sourceContent = captured.doc.toJSON();
    const at = captured.doc.resolve(captured.to);
    const insertionIndex = at.index(0) + (at.depth ? 1 : 0);
    const requestBody = { pageId: captured.pageId, sourceContent, sourceTitle: captured.title,
      insertionIndex, action, scope: action === "ask" ? "document" : "selection",
      selectedText: action === "ask" ? undefined : captured.text, instruction: question,
      targetLanguage: language, responseLocale };
    const key = JSON.stringify(requestBody);
    if (submission.current?.key !== key) submission.current = { key, id: crypto.randomUUID() };
    const operationId = submission.current.id;
    const sequence = ++request.current;
    submitting.current = true;
    dismissedJob.current = plan?.id || dismissedJob.current;
    setBusy(true); setError(""); setPlan(null); setWritten(false);
    try {
      const hash = await documentHash(sourceContent);
      // The immutable request remains valid when this component unmounts.
      // Only its UI response is ignored; the server owns inference and insertion.
      const next = await aiPost<AiJob>("jobs/create", { ...requestBody, sourceHash: hash, operationId }, workspaceId);
      if (sequence !== request.current) return;
      submission.current = null;
      setPlan(next); setBusy(jobActive(next)); setWritten(next.status === "completed");
      setSentRequest(action === "ask" ? question : t(action === "summary" ? "selectionSummary" : action === "translate" ? "selectionTranslate" : "selectionPolish"));
      setQuestion(""); setAction("ask");
    } catch (error) {
      if (sequence === request.current) { setError(error); setBusy(false); }
    } finally { submitting.current = false; }
  }
  const panel = (
    <section
      ref={panelRef}
      tabIndex={-1}
      className={classes.panel}
      data-personal-ai-panel
      aria-label={t("chat")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          close();
        }
      }}
    >
      <header className={classes.header}>
        <Menu position="bottom-start">
          <Menu.Target>
            <UnstyledButton
              className={classes.chatTitle}
              aria-label={t("chatMenu")}
            >
              <span className={classes.smallLogo}>
                <IconSparkles size={16} />
              </span>
              <Text size="sm" fw={500}>
                {t("newAiChat")}
              </Text>
              <IconChevronDown size={14} />
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconMessagePlus size={16} />}
              onClick={newChat}
              disabled={busy || readOnly}
            >
              {t("startNewChat")}
            </Menu.Item>
            <Menu.Item
              component={Link}
              to="/settings/personal-ai"
              onClick={close}
            >
              {t("connectionSettings")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Group gap={2} wrap="nowrap">
          <Tooltip label={t("newChat")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t("startNewChat")}
              onClick={newChat}
              disabled={busy || readOnly}
            >
              <IconMessagePlus size={18} />
            </ActionIcon>
          </Tooltip>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={t("more")}>
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                component={Link}
                to="/settings/personal-ai"
                onClick={close}
              >
                {t("connectionSettings")}
              </Menu.Item>
              <Menu.Item onClick={() => capture()} disabled={busy || readOnly}>
                {t("reloadSource")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Tooltip label={t("close")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t("closePanel")}
              onClick={close}
            >
              <IconChevronsRight size={19} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </header>
      <div className={classes.conversation} aria-live="polite" aria-busy={busy}>
        {error && (
          <Alert color="red" role="alert" mb="md">
            {aiError(error, t)}
            <Anchor
              component={Link}
              to="/settings/personal-ai"
              onClick={close}
              display="block"
              mt="xs"
            >
              {t("connectionSettings")}
            </Anchor>
          </Alert>
        )}
        {!current && snapshot && action !== "ask" && !busy && (
          <Alert color="yellow" mb="md">
            {t("sourceChanged")}
          </Alert>
        )}
        {!saved && (
          <Text size="sm" c="dimmed" mb="md">
            {t("saveWaiting")}
          </Text>
        )}
        {!plan && !written && (
          <div className={classes.welcome}>
            <div className={classes.logo}>
              <IconSparkles size={29} stroke={1.6} />
            </div>
            <Text fw={600} size="lg" mt="md" mb="sm">
              {t("welcome")}
            </Text>
            <Stack gap={2}>
              {tasks.map((task) => (
                <UnstyledButton
                  key={t(task.label)}
                  className={classes.suggestion}
                  disabled={busy || readOnly}
                  onClick={() => {
                    capture("ask");
                    setQuestion(
                      t(task.instruction, {
                        language: aiLanguageName(language, responseLocale),
                      }),
                    );
                  }}
                >
                  <task.icon size={18} stroke={1.5} />
                  <span>{t(task.label)}</span>
                </UnstyledButton>
              ))}
            </Stack>
          </div>
        )}
        {plan && (
          <Stack gap="sm">
            <div className={classes.question}>{sentRequest}</div>
            <Text size="xs" c="dimmed">
              {plan.provider} · {plan.model}
            </Text>
            {busy && (
              <Text size="sm" c="dimmed" role="status">
                {t("backgroundRunning")}
              </Text>
            )}
          </Stack>
        )}
        {plan?.resultText && ["conflict", "failed"].includes(plan.status) && (
          <Alert color="yellow" title={t("backgroundResultHeld")} mt="md">
            <Text size="sm" component="pre" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxHeight: 280, overflowY: "auto" }}>{plan.resultText}</Text>
            <CopyButton value={plan.resultText}>{({ copied, copy }) => <Button size="xs" variant="light" onClick={copy}>{t(copied ? "copiedResult" : "copyResult")}</Button>}</CopyButton>
          </Alert>
        )}
        {written && (
          <Text size="sm" mt="md" role="status">
            {t("written")}
          </Text>
        )}
      </div>
      <footer className={classes.footer}>
        {status?.connected === false && (
          <div className={classes.connectionNotice}>
            <IconSparkles size={14} />
            <span>
              {t("connectNotice")}{" "}
              <Anchor
                component={Link}
                to="/settings/personal-ai"
                onClick={close}
                size="xs"
              >
                {t("connectionSettings")}
              </Anchor>
            </span>
          </div>
        )}
        <div className={classes.composer}>
          <Tooltip
            label={currentTitle() || t("untitled")}
            multiline
            w={280}
            style={{ overflowWrap: "anywhere" }}
          >
            <div className={classes.pagePill}>
              <IconFileText size={14} />
              <Text size="xs" truncate>
                {currentTitle() || t("untitled")}
              </Text>
              <IconCheck
                size={12}
                aria-label={saved ? t("saved") : t("savePending")}
                style={{ opacity: saved ? 1 : 0.3 }}
              />
            </div>
          </Tooltip>
          {action === "ask" ? (
            <Textarea
              aria-label={t("question")}
              placeholder={t("questionPlaceholder")}
              value={question}
              onChange={(event) => {
                clear();
                setQuestion(event.currentTarget.value);
              }}
              maxLength={2000}
              autosize
              minRows={2}
              maxRows={5}
              variant="unstyled"
              className={classes.prompt}
              disabled={busy || readOnly}
            />
          ) : (
            <Stack gap="xs" mt="xs">
              <Select
                label={t("task")}
                value={action}
                data={[
                  { value: "ask", label: t("writeBlocks") },
                  ...selectionTasks.map((item) => ({
                    ...item,
                    label: t(item.label),
                  })),
                ]}
                onChange={(value) => {
                  clear();
                  setAction(value || "ask");
                }}
                disabled={busy || readOnly}
              />
              <Textarea
                label={t("selectionSource")}
                value={snapshot?.text || ""}
                readOnly
                autosize
                minRows={2}
                maxRows={4}
              />
              {action === "translate" && (
                <Select
                  label={t("translationLanguage")}
                  value={language}
                  onChange={(value) => {
                    clear();
                    setLanguage(value);
                  }}
                  data={AI_LOCALES.map((value) => ({
                    value,
                    label: aiLanguageName(value, responseLocale),
                  }))}
                  disabled={busy || readOnly}
                />
              )}
              <Text size="xs" c="dimmed">
                {t("selectionHint")}
              </Text>
            </Stack>
          )}
          <Group justify="space-between" mt="xs" wrap="nowrap">
            <Group gap={4} wrap="nowrap">
              <Menu position="top-start">
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={t("taskMenu")}
                    disabled={busy || readOnly}
                  >
                    <IconPlus size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => capture("ask")}>
                    {t("writeBlocks")}
                  </Menu.Item>
                  {selectionTasks.map((item) => (
                    <Menu.Item
                      key={item.value}
                      onClick={() => capture(item.value)}
                    >
                      {t(item.label)}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <Menu.Item onClick={() => capture()}>
                    {t("reloadSource")}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <Tooltip label={t("scopeHint")} multiline w={280}>
                <span
                  className={classes.scopeIcon}
                  tabIndex={0}
                  aria-label={t("scopeLabel")}
                >
                  <IconShieldCheck size={16} />
                </span>
              </Tooltip>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <Anchor
                component={Link}
                to="/settings/personal-ai"
                onClick={close}
                className={classes.model}
                size="xs"
                c="dimmed"
              >
                {plan?.model ||
                  status?.model ||
                  (status?.connected ? t("chooseModel") : t("connection"))}
              </Anchor>
              <Tooltip label={t("send")}>
                <ActionIcon
                  size={30}
                  radius="xl"
                  aria-label={t("send")}
                  onClick={send}
                  loading={busy}
                  disabled={!ready || busy}
                  variant="light"
                  color="gray"
                >
                  <IconArrowUp size={17} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            {t("sendHint")}
          </Text>
        </div>
      </footer>
    </section>
  );
  const target = opened ? document.getElementById(ASIDE_PANEL_ID) : null;
  return (
    <>
      <Tooltip label={t("documentAi")}>
        <ActionIcon
          ref={launcher}
          className={classes.launcher}
          aria-label={t("documentAi")}
          aria-expanded={opened}
          aria-controls={ASIDE_PANEL_ID}
          variant="default"
          size={52}
          radius="xl"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!snapshot) capture(undefined, false);
            setAside({ tab: "personal-ai", isAsideOpen: true });
          }}
          style={{ visibility: opened ? "hidden" : "visible" }}
        >
          <IconSparkles size={25} stroke={1.7} />
          {busy && <span className={classes.backgroundBadge} aria-label={t("backgroundRunning")} />}
        </ActionIcon>
      </Tooltip>
      {target && createPortal(panel, target)}
    </>
  );
}
