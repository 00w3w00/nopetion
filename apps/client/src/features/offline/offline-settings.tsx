import { useEffect, useState } from "react";
import { Alert, Button, Container, Group, Stack, Switch, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { bodySaveStateAtom, titleSaveStateAtom } from "@/features/personal/save-status";
import { OFFLINE_CHANGED, acceptOfflineAccount, clearOfflineData, enableOffline, listOfflinePages, offlineEnabled } from "./offline-store";
import { PWA_CHANGED, installPrompt, pwaRegistration } from "./pwa";
import DeviceStorageStatus from "./device-storage-status";

export default function OfflineSettings() {
  const { t } = useTranslation("offline");
  const identity = useAtomValue(currentUserAtom);
  const body = useAtomValue(bodySaveStateAtom);
  const title = useAtomValue(titleSaveStateAtom);
  const [enabled, setEnabled] = useState(offlineEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [, redraw] = useState(0);
  useEffect(() => {
    const refresh = () => { setEnabled(offlineEnabled()); listOfflinePages().then((pages) => setPending(pages.some((page) => page.pendingBody || page.pendingTitle))).catch(() => setError(true)); redraw((v) => v + 1); };
    refresh();
    window.addEventListener(OFFLINE_CHANGED, refresh); window.addEventListener(PWA_CHANGED, refresh);
    return () => { window.removeEventListener(OFFLINE_CHANGED, refresh); window.removeEventListener(PWA_CHANGED, refresh); };
  }, []);
  const toggle = async (checked: boolean) => {
    if (!identity?.accountId) return;
    setBusy(true);
    try {
      if (checked) { await acceptOfflineAccount(identity.accountId); enableOffline(identity.accountId); }
      else await clearOfflineData();
      setEnabled(checked); setError(false);
    } catch { setError(true); } finally { setBusy(false); }
  };
  const dirty = pending || body.state === "saving" || title.state === "saving";
  return <Container size="sm" py="xl"><Stack>
    <Title order={2}>{t("Install and offline")}</Title>
    <Text>{t("Install Nopetion on your computer or phone. The same account syncs documents through your server.")}</Text>
    {installPrompt ? <Button onClick={async () => { const prompt = installPrompt; await prompt.prompt(); await prompt.userChoice; redraw((v) => v + 1); }}>{t("Install Nopetion")}</Button>
      : <Alert color="gray">{t("Use your browser menu to install this app. On iPhone or iPad, use Safari → Share → Add to Home Screen. Installation requires HTTPS or localhost.")}</Alert>}
    {pwaRegistration?.waiting && <Alert color="blue"><Text>{t("An update is ready. Your current editor will stay open.")}</Text>
      <Button variant="light" disabled={dirty} onClick={() => { pwaRegistration.waiting?.postMessage({ type: "ACTIVATE_UPDATE" }); redraw((v) => v + 1); }}>{t("Use update next time")}</Button>
    </Alert>}
    <Switch label={t("Allow offline documents on this device")} description={t("Off by default. Only documents you explicitly save are stored locally, separately for your account and workspace.")}
      checked={enabled} disabled={busy || !identity?.accountId || (enabled && pending)} onChange={(event) => void toggle(event.currentTarget.checked)} />
    {pending && <Alert color="orange">{t("Sync pending changes before turning offline storage off.")}</Alert>}
    {error && <Alert color="red">{t("Could not access local storage")}</Alert>}
    <DeviceStorageStatus enabled={enabled} />
    <Text size="sm" c="dimmed">{t("Local copies are removed when you log out or change accounts. Use offline storage only on a trusted device. Attachments, AI, search and sharing require a connection.")}</Text>
    <Group><Button component={Link} to="/offline" variant="default">{t("Offline documents")}</Button></Group>
  </Stack></Container>;
}
