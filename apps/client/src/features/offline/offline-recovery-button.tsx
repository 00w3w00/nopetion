import { useState } from "react";
import { Button, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { downloadOfflineRecovery } from "./offline-recovery";

export default function OfflineRecoveryButton({ pageKey }: { pageKey?: string }) {
  const { t } = useTranslation("offline");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <Stack gap={4}>
    <Button variant="light" size="compact-sm" loading={busy} onClick={async () => {
      setBusy(true); setMessage("");
      try {
        const count = await downloadOfflineRecovery(pageKey);
        setMessage(count ? "Recovery file downloaded. Keep it private; attachments are not included." : "No changes waiting to sync.");
      } catch { setMessage("Could not export your changes. Keep this page open and try again."); }
      finally { setBusy(false); }
    }}>{t("Export pending changes")}</Button>
    {message && <Text role="status" size="sm">{t(message)}</Text>}
  </Stack>;
}
