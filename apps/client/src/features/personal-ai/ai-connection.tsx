import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Anchor,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { aiError, aiPost, type AiStatus } from "./ai-api";
import { canStartAiSignIn } from "./ai-local-connection";

export default function AiConnection() {
  const { t } = useTranslation("personal-ai");
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [disconnectProfile, setDisconnectProfile] = useState<string | null>(
    null,
  );
  const refreshing = useRef(false);
  const [showLocalInstructions, setShowLocalInstructions] = useState(false);
  const [models, setModels] = useState<{ slug: string; displayName: string }[]>(
    [],
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [message, setMessage] = useState(""),
    [authUrl, setAuthUrl] = useState("");
  const localSettingsUrl = status?.localSettingsUrl;
  const loginSettingsUrl = status?.bridgeSettingsUrl || localSettingsUrl;
  const canSignIn = canStartAiSignIn(localSettingsUrl, window.location.origin);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setBusy(true);
    setError("");
    let receivedStatus = false;
    try {
      const next = await aiPost<AiStatus>("status");
      receivedStatus = true;
      setStatus(next);
      setSelected(next.activeId || next.profiles[0]?.id || "");
      setModels(next.connected ? await aiPost("models") : []);
    } catch (error) {
      if (!receivedStatus) setStatus(null);
      setError(error);
    } finally {
      refreshing.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const check = () => {
      if (!busy && document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [busy, refresh]);
  async function login(profileId?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    setAuthUrl("");
    try {
      const { url } = await aiPost<{ url: string }>("sign-in", { profileId });
      setAuthUrl(url);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function settings(profileId: string, model?: string) {
    setBusy(true);
    setError("");
    setAuthUrl("");
    try {
      await aiPost("settings", { profileId, model });
      await refresh();
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    if (!disconnectProfile || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await aiPost<{ revoked: boolean }>("disconnect", {
        profileId: disconnectProfile,
      });
      setDisconnectProfile(null);
      setAuthUrl("");
      await refresh();
      setMessage(result.revoked ? "disconnectedNotice" : "revokePending");
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap="md">
      <Text>{t("connectionInfo")}</Text>
      <Text size="sm" c="dimmed">
        {t("secretsInfo")}
      </Text>
      {error && (
        <Alert color="red" role="alert">
          {aiError(error, t)}
        </Alert>
      )}
      {message && !status?.connected && (
        <Alert role="status">{t(message)}</Alert>
      )}
      <Text fw={600} aria-live="polite">
        {status
          ? t(status.connected ? "connected" : "disconnected")
          : t(busy ? "checkingConnection" : "connectionUnknown")}
      </Text>
      {status && localSettingsUrl && !canSignIn && (
        <Alert
          color={status.connected ? "green" : "blue"}
          title={t(
            status.connected ? "remoteReadyTitle" : "localConnectionTitle",
          )}
        >
          <Text size="sm">
            {t(status.connected ? "remoteReadyInfo" : "remoteSetupInfo")}
          </Text>
          <Button
            variant="subtle"
            size="compact-sm"
            mt="xs"
            aria-expanded={showLocalInstructions}
            onClick={() => setShowLocalInstructions((value) => !value)}
          >
            {t("computerConnectionGuide")}
          </Button>
          {showLocalInstructions && (
            <>
              <Text size="sm" mt="xs">
                {t("localConnectionInfo")}
              </Text>
              <Text size="xs" mt="xs" style={{ overflowWrap: "anywhere" }}>
                {t("computerOnlyAddress")}: {loginSettingsUrl}
              </Text>
            </>
          )}
        </Alert>
      )}
      {!!status?.profiles.length && (
        <Select
          label={t("account")}
          data={status.profiles.map((p) => ({
            value: p.id,
            label: `${p.label}${p.connected ? "" : ` · ${t("signedOut")}`}`,
          }))}
          value={selected || null}
          onChange={(value) => {
            if (value) {
              setSelected(value);
              const profile = status.profiles.find((p) => p.id === value);
              if (profile?.connected) void settings(value);
            }
          }}
          disabled={busy}
        />
      )}
      <Group>
        {canSignIn && (
          <Button
            onClick={() => login(selected || undefined)}
            loading={busy}
            disabled={!canSignIn}
          >
            {t("continueChatGPT")}
          </Button>
        )}
        {canSignIn && !!status?.profiles.length && (
          <Button
            variant="default"
            onClick={() => login()}
            disabled={busy || !canSignIn}
          >
            {t("addAccount")}
          </Button>
        )}
        <Button
          variant="default"
          onClick={() => {
            setAuthUrl("");
            void refresh();
          }}
          disabled={busy}
        >
          {t("checkConnection")}
        </Button>
      </Group>
      {authUrl && (
        <Alert>
          <Anchor href={authUrl} target="_blank" rel="noreferrer noopener">
            {t("openLogin")}
          </Anchor>
          <Text size="sm" mt="xs">
            {t("loginHint")}
          </Text>
        </Alert>
      )}
      {status?.connected && (
        <>
          <Select
            label={t("model")}
            placeholder={t("modelPlaceholder")}
            data={models.map((m) => ({ value: m.slug, label: m.displayName }))}
            value={status.model || null}
            onChange={(model) => {
              if (model && status.activeId)
                void settings(status.activeId, model);
            }}
            disabled={busy || !models.length}
            searchable
          />
          <Group>
            <Button
              variant="outline"
              color="red"
              onClick={() => setDisconnectProfile(selected)}
              disabled={busy || !selected}
            >
              {t("disconnectAccount")}
            </Button>
            <Anchor
              href="https://chatgpt.com/settings/usage"
              target="_blank"
              rel="noreferrer"
            >
              {t("manageUsage")}
            </Anchor>
          </Group>
        </>
      )}
      <Modal
        opened={!!disconnectProfile}
        onClose={() => {
          if (!busy) setDisconnectProfile(null);
        }}
        title={t("disconnectAccount")}
        closeButtonProps={{ "aria-label": t("close") }}
        closeOnClickOutside={!busy}
        closeOnEscape={!busy}
      >
        <Text size="sm">{t("disconnectConfirmation")}</Text>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            disabled={busy}
            onClick={() => setDisconnectProfile(null)}
          >
            {t("cancelDisconnect")}
          </Button>
          <Button color="red" loading={busy} onClick={disconnect}>
            {t("confirmDisconnect")}
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
