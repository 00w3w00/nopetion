import { useState, type ReactNode } from "react";
import { Button, Text, type ButtonProps } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { flushOfflineWrites } from "./offline-store";
import OfflineRecoveryButton from "./offline-recovery-button";

export default function OfflineNavigationButton({ to, children, variant = "default", size }: {
  to: string; children: ReactNode; variant?: ButtonProps["variant"]; size?: ButtonProps["size"];
}) {
  const { t } = useTranslation("offline");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return <div>
    <Button variant={variant} size={size} loading={busy} onClick={async () => {
      setBusy(true);
      try { await flushOfflineWrites(); navigate(to); }
      catch { setFailed(true); } finally { setBusy(false); }
    }}>{children}</Button>
    {failed && <><Text role="alert" c="red" size="sm">{t("Could not save pending changes on this device. Keep this page open and try again before leaving.")}</Text>
      <OfflineRecoveryButton /></>}
  </div>;
}
