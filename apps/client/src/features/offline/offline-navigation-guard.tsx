import { useEffect, useState } from "react";
import { Alert, Box, Text } from "@mantine/core";
import { useBlocker } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { flushOfflineWrites, hasOfflineWriters } from "./offline-store";
import OfflineRecoveryButton from "./offline-recovery-button";

/** Covers links, programmatic navigation and browser Back without unmounting RAM editors. */
export default function OfflineNavigationGuard() {
  const { t } = useTranslation("offline");
  const [failed, setFailed] = useState(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasOfflineWriters()
    && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const blocked = blocker;
    let active = true;
    void flushOfflineWrites().then(() => {
      if (active) { setFailed(false); blocked.proceed(); }
    }).catch(() => {
      if (active) { setFailed(true); blocked.reset(); }
    });
    return () => { active = false; };
  }, [blocker]);
  return failed ? <Box pos="fixed" top={12} left={12} right={12} style={{ zIndex: 10001 }}>
    <Alert color="red" role="alert"><Text size="sm" mb="xs">{t("Could not save pending changes on this device. Keep this page open and try again before leaving.")}</Text>
      <OfflineRecoveryButton />
    </Alert>
  </Box> : null;
}
