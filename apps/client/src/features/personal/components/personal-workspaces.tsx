import { appPath } from "@/lib/app-path";
import { useState } from "react";
import {
  Alert,
  Button,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import {
  IconCheck,
  IconPlus,
  IconTrash,
  IconRestore,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import api from "@/lib/api-client";
import { selectPersonalWorkspace } from "@/lib/personal-workspace-scope";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  bodySaveStateAtom,
  titleSaveStateAtom,
  linkedSourceSaveStatesAtom,
} from "../save-status";
import {
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";

type Workspace = {
  id: string;
  name: string;
  logo?: string;
  canDelete?: boolean;
};
export default function usePersonalWorkspaces() {
  const { t } = useTranslation("personal-workspaces");
  const store = useStore();
  const current = useAtomValue(currentUserAtom);
  const [opened, setOpened] = useState(false),
    [name, setName] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [creationKey, setCreationKey] = useState("");
  const [deleting, setDeleting] = useState<Workspace | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [trashOpened, setTrashOpened] = useState(false);
  const canCreate = current?.user?.role === "owner";
  const { data, isError, refetch } = useQuery({
    queryKey: ["personal-workspaces", current?.user?.id],
    queryFn: async () =>
      (await api.post<Workspace[]>("/personal-workspaces/list")).data,
    enabled: canCreate,
  });
  const trash = useQuery({
    queryKey: ["personal-workspaces-trash", current?.user?.id],
    queryFn: async () =>
      (await api.post<Workspace[]>("/personal-workspaces/trash")).data,
    enabled: canCreate && trashOpened,
  });
  const protectedSwitch = () => {
    const editor = store.get(pageEditorAtom),
      titleEditor = store.get(titleEditorAtom);
    const body = store.get(bodySaveStateAtom),
      title = store.get(titleSaveStateAtom);
    const unsaved =
      (editor &&
        !editor.isDestroyed &&
        body.pageId &&
        body.state !== "saved") ||
      (titleEditor &&
        !titleEditor.isDestroyed &&
        title.pageId &&
        title.state !== "saved") ||
      Object.values(store.get(linkedSourceSaveStatesAtom)).some(
        (source) => source.dirty && source.state !== "saved",
      );
    if (!unsaved) return true;
    notifications.show({ color: "orange", message: t("waitForSave") });
    return false;
  };
  const switchTo = async (id: string) => {
    if (!protectedSwitch() || busy || id === current?.workspace?.id) return;
    setBusy(true);
    try {
      await api.post("/personal-workspaces/switch", { workspaceId: id });
      if (!protectedSwitch()) {
        setBusy(false);
        return;
      }
      selectPersonalWorkspace(id);
      window.location.assign(appPath("/home"));
    } catch {
      notifications.show({ color: "red", message: t("switchFailed") });
      setBusy(false);
    }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !protectedSwitch() || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = (
        await api.post<{ id: string }>("/personal-workspaces/create", {
          name: name.trim(),
          creationKey,
        })
      ).data;
      await api.post("/personal-workspaces/switch", { workspaceId: result.id });
      if (!protectedSwitch()) {
        setBusy(false);
        return;
      }
      selectPersonalWorkspace(result.id);
      window.location.assign(appPath("/home"));
    } catch {
      setError(t("createFailed"));
      setBusy(false);
    }
  };
  const workspaces: Workspace[] =
    data || (current?.workspace ? [current.workspace] : []);
  const selected = workspaces.find(
    (workspace) => workspace.id === current?.workspace?.id,
  );
  const remove = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !deleting ||
      confirmation !== deleting.name ||
      !protectedSwitch() ||
      busy
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = (
        await api.post<{ fallbackWorkspaceId: string }>(
          "/personal-workspaces/delete",
          {
            workspaceId: deleting.id,
            confirmationName: confirmation,
          },
        )
      ).data;
      selectPersonalWorkspace(result.fallbackWorkspaceId);
      window.location.assign(appPath("/home"));
    } catch {
      setError(t("deleteFailed"));
      setBusy(false);
    }
  };
  const restore = async (workspace: Workspace) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/personal-workspaces/restore", {
        workspaceId: workspace.id,
      });
      await Promise.all([refetch(), trash.refetch()]);
      notifications.show({ message: t("restored", { name: workspace.name }) });
    } catch {
      setError(t("restoreFailed"));
    } finally {
      setBusy(false);
    }
  };
  return {
    items: (
      <>
        {workspaces.map((workspace) => (
          <Menu.Item
            key={workspace.id}
            disabled={busy}
            onClick={() => switchTo(workspace.id)}
            data-workspace-id={workspace.id}
            leftSection={
              <CustomAvatar
                name={workspace.name}
                avatarUrl={workspace.logo}
                workspaceId={workspace.id}
                type={AvatarIconType.WORKSPACE_ICON}
                size={24}
              />
            }
            rightSection={
              workspace.id === current?.workspace?.id ? (
                <IconCheck size={16} aria-hidden />
              ) : null
            }
          >
            <Text size="sm" truncate>
              {workspace.name}
            </Text>
          </Menu.Item>
        ))}
        {isError && <Menu.Label c="red">{t("listFailed")}</Menu.Label>}
        {canCreate && (
          <Menu.Item
            leftSection={<IconPlus size={17} />}
            data-create-personal-workspace
            disabled={busy}
            onClick={() => {
              if (!protectedSwitch()) return;
              setCreationKey(crypto.randomUUID());
              setName("");
              setError("");
              setOpened(true);
            }}
          >
            {t("newWorkspace")}
          </Menu.Item>
        )}
        {canCreate && (
          <>
            <Menu.Item
              c="red"
              leftSection={<IconTrash size={17} />}
              data-delete-personal-workspace
              disabled={busy || !selected?.canDelete}
              title={!selected?.canDelete ? t("rootProtected") : undefined}
              onClick={() => {
                if (selected && protectedSwitch()) {
                  setDeleting(selected);
                  setConfirmation("");
                  setError("");
                }
              }}
            >
              {t("deleteWorkspace")}
            </Menu.Item>
            {selected?.canDelete === false && (
              <Menu.Label>{t("rootProtected")}</Menu.Label>
            )}
            <Menu.Item
              leftSection={<IconRestore size={17} />}
              data-trash-personal-workspaces
              disabled={busy}
              onClick={() => {
                setError("");
                setTrashOpened(true);
              }}
            >
              {t("deletedWorkspaces")}
            </Menu.Item>
          </>
        )}
      </>
    ),
    dialog: (
      <>
        <Modal
          opened={opened}
          onClose={() => !busy && setOpened(false)}
          title={t("newWorkspace")}
          centered
          closeOnClickOutside={!busy}
          closeOnEscape={!busy}
          withCloseButton={!busy}
        >
          <form onSubmit={create}>
            <Stack>
              <Text size="sm" c="dimmed">
                {t("description")}
              </Text>
              <TextInput
                label={t("name")}
                placeholder={t("placeholder")}
                value={name}
                disabled={busy}
                onChange={(event) => {
                  setName(event.currentTarget.value);
                  setCreationKey(crypto.randomUUID());
                }}
                maxLength={64}
                required
                data-autofocus
              />
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Group justify="flex-end">
                <Button
                  variant="default"
                  disabled={busy}
                  onClick={() => setOpened(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" loading={busy} disabled={!name.trim()}>
                  {t("create")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
        <Modal
          opened={!!deleting}
          onClose={() => !busy && setDeleting(null)}
          title={t("deleteWorkspace")}
          centered
          closeOnClickOutside={!busy}
          closeOnEscape={!busy}
          withCloseButton={!busy}
        >
          <form onSubmit={remove}>
            <Stack>
              <Text size="sm">
                {t("deleteDescription", { name: deleting?.name })}
              </Text>
              <TextInput
                label={t("confirmName")}
                value={confirmation}
                disabled={busy}
                data-autofocus
                onChange={(event) => setConfirmation(event.currentTarget.value)}
                required
                autoComplete="off"
              />
              {error && (
                <Alert color="red" role="alert">
                  {error}
                </Alert>
              )}
              <Group justify="flex-end">
                <Button
                  variant="default"
                  disabled={busy}
                  onClick={() => setDeleting(null)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  color="red"
                  loading={busy}
                  disabled={confirmation !== deleting?.name}
                >
                  {t("delete")}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
        <Modal
          opened={trashOpened}
          onClose={() => !busy && setTrashOpened(false)}
          title={t("deletedWorkspaces")}
          centered
          closeOnClickOutside={!busy}
          closeOnEscape={!busy}
          withCloseButton={!busy}
        >
          <Stack>
            {trash.isPending && <Text size="sm">{t("loading")}</Text>}
            {trash.isError && <Alert color="red">{t("listFailed")}</Alert>}
            {error && (
              <Alert color="red" role="alert">
                {error}
              </Alert>
            )}
            {trash.data?.length === 0 && (
              <Text size="sm" c="dimmed">
                {t("trashEmpty")}
              </Text>
            )}
            {trash.data?.map((workspace) => (
              <Group key={workspace.id} wrap="nowrap" justify="space-between">
                <Text size="sm" truncate style={{ minWidth: 0 }}>
                  {workspace.name}
                </Text>
                <Button
                  variant="light"
                  size="xs"
                  disabled={busy}
                  data-restore-workspace={workspace.id}
                  onClick={() => restore(workspace)}
                >
                  {t("restore")}
                </Button>
              </Group>
            ))}
          </Stack>
        </Modal>
      </>
    ),
  };
}
