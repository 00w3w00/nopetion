import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { readDeviceStorage, requestDevicePersistence, type DeviceStorageState } from "./device-storage";
import OfflineRecoveryButton from "./offline-recovery-button";
import { formatBytes } from "@/lib/utils";

export default function DeviceStorageStatus({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation("offline");
  const [status, setStatus] = useState<DeviceStorageState | null>(null);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const refresh = useCallback(() => {
    void readDeviceStorage().then(value => { setStatus(value); setFailed(false); }).catch(() => setFailed(true));
  }, []);
  useEffect(() => { refresh(); window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [refresh]);
  return <Alert color={failed ? "red" : "gray"} title={t("Storage on this device")}><Stack gap="xs">
    <Text size="sm">{failed ? t("Could not check device storage") : status?.persistent ? t("The browser has granted persistent storage.") : t("The browser may clear local copies when space is needed.")}</Text>
    {status?.usage !== undefined && status?.quota !== undefined && <Text size="sm">{t("Used")}: {formatBytes(status.usage)} · {t("Storage limit")}: {formatBytes(status.quota)}</Text>}
    <Text size="xs">{t("Device storage is not a backup. Keep pending edits safe before clearing browser data.")}</Text>
    <Group>
      {enabled && status?.supported && !status.persistent && <Button size="compact-sm" variant="default" loading={busy} onClick={async () => {
        setBusy(true);
        try { setStatus(await requestDevicePersistence()); setFailed(false); } catch { setFailed(true); } finally { setBusy(false); }
      }}>{t("Ask the browser to keep offline documents")}</Button>}
      <Button size="compact-sm" variant="subtle" onClick={refresh}>{t("Refresh storage status")}</Button>
      {enabled && <OfflineRecoveryButton />}
    </Group>
  </Stack></Alert>;
}
