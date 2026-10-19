import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  CopyButton,
  Group,
  Loader,
  MultiSelect,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconCheck,
  IconCopy,
  IconKey,
  IconPlugConnected,
  IconRefresh,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import api from "@/lib/api-client";
import SettingsTitle from "@/components/settings/settings-title";
import { DocumentTitle } from "@/components/ui/document-title";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import classes from "./mcp-settings.module.css";

type Connection = {
  id: string;
  name: string;
  access: "read" | "write";
  spaceIds: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};
type Status = { endpoint: string; tokens: Connection[] };
const post = async <T,>(path: string, body: object = {}): Promise<T> =>
  (await api.post("/personal-mcp/" + path, body)).data;

export default function McpSettings() {
  const { t, i18n } = useTranslation(),
    workspace = useAtomValue(workspaceAtom);
  const workspaceRef = useRef(workspace?.id),
    mounted = useRef(true);
  const creating = useRef(false);
  workspaceRef.current = workspace?.id;
  const query = useQuery({
    queryKey: ["personal-mcp", workspace?.id],
    queryFn: () => post<Status>("status"),
    enabled: !!workspace?.id,
    retry: false,
  });
  const spaces = useGetSpacesQuery({ limit: 100 });
  const [name, setName] = useState(""),
    [access, setAccess] = useState("read"),
    [spaceIds, setSpaceIds] = useState<string[]>([]),
    [days, setDays] = useState("30");
  const [busy, setBusy] = useState(false),
    [revoking, setRevoking] = useState<string | null>(null),
    [failed, setFailed] = useState(false),
    [issued, setIssued] = useState<{
      id: string;
      secret: string;
      name: string;
    } | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setIssued(null);
    setSpaceIds([]);
    setName("");
    setFailed(false);
  }, [workspace?.id]);
  const stillHere = (id: string) =>
    mounted.current && workspaceRef.current === id;
  const create = async () => {
    if (
      creating.current ||
      !name.trim() ||
      !spaceIds.length ||
      spaces.isFetching
    )
      return;
    creating.current = true;
    setBusy(true);
    setFailed(false);
    setIssued(null);
    const id = workspace?.id;
    try {
      const created = await post<Connection & { secret: string }>("create", {
        name: name.trim(),
        access,
        spaceIds,
        expiresInDays: Number(days),
      });
      if (stillHere(id)) {
        setIssued({
          id: created.id,
          secret: created.secret,
          name: created.name,
        });
        await query.refetch();
      }
    } catch {
      if (stillHere(id)) setFailed(true);
    } finally {
      creating.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const revoke = async (tokenId: string) => {
    if (revoking) return;
    setRevoking(tokenId);
    setFailed(false);
    const id = workspace?.id;
    try {
      await post("revoke", { id: tokenId });
      if (stillHere(id)) {
        if (issued?.id === tokenId) setIssued(null);
        await query.refetch();
      }
    } catch {
      if (stillHere(id)) setFailed(true);
    } finally {
      if (mounted.current) setRevoking(null);
    }
  };
  const date = (value: string) =>
    new Date(value).toLocaleString(i18n.resolvedLanguage || i18n.language);
  return (
    <div className={classes.page}>
      <DocumentTitle title={t("MCP connection")} />
      <SettingsTitle title={t("MCP connection")} />
      <Text c="dimmed" size="sm" mb="lg">
        {t(
          "Connect your AI client to Nopetion. Choose exactly which Spaces it may use.",
        )}
      </Text>
      {query.isPending && <Loader size="sm" />}
      {query.isError && (
        <Alert color="red" title={t("Could not load MCP connections")}>
          <Button size="xs" variant="subtle" onClick={() => query.refetch()}>
            {t("Retry")}
          </Button>
        </Alert>
      )}
      {query.data && (
        <Stack gap="lg">
          <Paper withBorder p="lg" radius="md">
            <Group gap="xs" mb="sm">
              <IconPlugConnected size={19} />
              <Text fw={600}>{t("Server address")}</Text>
              <Badge variant="light">Streamable HTTP</Badge>
            </Group>
            <div className={classes.copyRow}>
              <code>{query.data.endpoint}</code>
              <CopyButton value={query.data.endpoint}>
                {({ copied, copy }) => (
                  <Button
                    variant="default"
                    size="xs"
                    onClick={copy}
                    aria-label={t("Copy MCP address")}
                    leftSection={
                      copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                    }
                  >
                    {t(copied ? "Copied" : "Copy")}
                  </Button>
                )}
              </CopyButton>
            </div>
            <Text size="sm" c="dimmed" mt="sm">
              {t(
                "Use this address with a Bearer connection key. Your app login password is not used.",
              )}
            </Text>
            <Text size="xs" c="dimmed" mt="xs">
              {t(
                "For a Tailscale address, connect the AI client device to the same Tailscale network.",
              )}
            </Text>
            <Text size="xs" mt="sm">
              {t("Authentication header")}:{" "}
              <code>Authorization: Bearer &lt;{t("Connection key")}&gt;</code>
            </Text>
          </Paper>
          <Paper withBorder p="lg" radius="md">
            <Text fw={600} mb="md">
              {t("Create connection key")}
            </Text>
            <Stack gap="md">
              <TextInput
                label={t("Connection name")}
                placeholder={t("For example, my AI assistant")}
                maxLength={64}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              <div className={classes.fields}>
                <Select
                  label={t("Access permission")}
                  value={access}
                  data={[
                    { value: "read", label: t("Read only") },
                    { value: "write", label: t("Read and write") },
                  ]}
                  allowDeselect={false}
                  disabled={busy}
                  onChange={(v) => {
                    if (v) setAccess(v);
                  }}
                />
                <Select
                  label={t("Key expires after")}
                  value={days}
                  data={[
                    { value: "7", label: t("7 days") },
                    { value: "30", label: t("30 days") },
                    { value: "90", label: t("90 days") },
                  ]}
                  allowDeselect={false}
                  disabled={busy}
                  onChange={(v) => {
                    if (v) setDays(v);
                  }}
                />
              </div>
              <MultiSelect
                label={t("Allowed Spaces")}
                placeholder={t("Select Spaces to allow")}
                searchable
                clearable
                maxValues={50}
                value={spaceIds}
                disabled={busy || spaces.isFetching}
                data={(spaces.data?.items || []).map((s) => ({
                  value: s.id,
                  label: s.name,
                }))}
                onChange={setSpaceIds}
              />
              {spaces.isError && (
                <Alert color="red">
                  {t("Could not load Spaces")}
                  <Button
                    variant="subtle"
                    size="xs"
                    onClick={() => spaces.refetch()}
                  >
                    {t("Retry")}
                  </Button>
                </Alert>
              )}
              <Text size="sm" c="dimmed">
                {t(
                  access === "write"
                    ? "This key can search, read, create pages, append blocks and replace a requested block in the selected Spaces."
                    : "This key can only search and read documents in the selected Spaces.",
                )}
              </Text>
              <Button
                className={classes.create}
                leftSection={<IconKey size={17} />}
                loading={busy}
                disabled={
                  busy ||
                  !name.trim() ||
                  !spaceIds.length ||
                  spaces.isFetching ||
                  spaces.isError
                }
                onClick={create}
              >
                {t("Create connection key")}
              </Button>
            </Stack>
          </Paper>
          {failed && (
            <Alert color="red" role="alert">
              {t(
                "MCP connection action failed. Check your permissions and try again.",
              )}
            </Alert>
          )}
          {issued && (
            <Alert color="blue" title={t("Copy your key now")}>
              <Text size="sm" mb="sm">
                {t(
                  "This key is shown only once. Save it in your AI client, then close this key display.",
                )}
              </Text>
              <PasswordInput
                label={issued.name}
                value={issued.secret}
                readOnly
                visibilityToggleButtonProps={{
                  "aria-label": t("Toggle connection key visibility"),
                }}
              />
              <Group mt="md">
                <CopyButton value={issued.secret}>
                  {({ copied, copy }) => (
                    <Button
                      variant="light"
                      size="xs"
                      onClick={copy}
                      leftSection={
                        copied ? (
                          <IconCheck size={14} />
                        ) : (
                          <IconCopy size={14} />
                        )
                      }
                    >
                      {t(copied ? "Copied" : "Copy connection key")}
                    </Button>
                  )}
                </CopyButton>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setIssued(null)}
                >
                  {t("Close key display")}
                </Button>
              </Group>
            </Alert>
          )}
          <div>
            <Group justify="space-between" mb="sm">
              <Text fw={600}>{t("Connection keys")}</Text>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconRefresh size={14} />}
                loading={query.isFetching}
                onClick={() => query.refetch()}
              >
                {t("Refresh")}
              </Button>
            </Group>
            {!query.data.tokens.length && (
              <Text size="sm" c="dimmed">
                {t("No connection keys yet.")}
              </Text>
            )}
            <Stack gap="sm">
              {query.data.tokens.map((token) => {
                const expired =
                    new Date(token.expiresAt).getTime() <= Date.now(),
                  inactive = !!token.revokedAt || expired;
                return (
                  <Paper key={token.id} withBorder p="md" radius="md">
                    <div className={classes.tokenRow}>
                      <div className={classes.tokenDetails}>
                        <Group gap="xs">
                          <Text fw={600} className={classes.name}>
                            {token.name}
                          </Text>
                          <Badge
                            color={inactive ? "gray" : "green"}
                            variant="light"
                          >
                            {t(
                              token.revokedAt
                                ? "Revoked"
                                : expired
                                  ? "Expired"
                                  : "Active",
                            )}
                          </Badge>
                          <Badge variant="light" color="gray">
                            {t(
                              token.access === "write"
                                ? "Read and write"
                                : "Read only",
                            )}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" mt="xs">
                          {t("Allowed Spaces")}:{" "}
                          {token.spaceIds
                            .map(
                              (id) =>
                                spaces.data?.items.find((s) => s.id === id)
                                  ?.name || t("Unavailable Space"),
                            )
                            .join(", ")}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("Expires")}: {date(token.expiresAt)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t("Last used")}:{" "}
                          {token.lastUsedAt
                            ? date(token.lastUsedAt)
                            : t("Not used yet")}
                        </Text>
                      </div>
                      <Button
                        color="red"
                        variant="subtle"
                        size="xs"
                        disabled={inactive || !!revoking}
                        loading={revoking === token.id}
                        onClick={() => revoke(token.id)}
                      >
                        {t("Revoke connection")}
                      </Button>
                    </div>
                  </Paper>
                );
              })}
            </Stack>
          </div>
          <Text size="xs" c="dimmed">
            {t(
              "AI clients receive Nopetion's block editing guide automatically. They cannot access account settings, passwords or AI login credentials.",
            )}
          </Text>
        </Stack>
      )}
    </div>
  );
}
