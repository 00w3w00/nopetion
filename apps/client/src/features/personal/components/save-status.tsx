import { useEffect } from "react";
import { Box, Text, Tooltip } from "@mantine/core";
import { IconAlertCircle, IconCheck, IconClock } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import {
  bodySaveStateAtom,
  titleSaveStateAtom,
  linkedSourceSaveStatesAtom,
} from "../save-status";
import { yjsConnectionStatusAtom } from "@/features/editor/atoms/editor-atoms";

export default function SaveStatus({ pageId, compactOnMobile = false }: { pageId: string; compactOnMobile?: boolean }) {
  const { t } = useTranslation();
  const [body, setBody] = useAtom(bodySaveStateAtom);
  const title = useAtomValue(titleSaveStateAtom);
  const connection = useAtomValue(yjsConnectionStatusAtom);
  const linkedSources = useAtomValue(linkedSourceSaveStatesAtom);
  const linked = Object.values(linkedSources).filter(
    (source) => source.hostPageId === pageId && source.dirty,
  );
  const bodyState = body?.pageId === pageId ? body.state : "connecting";
  const titleState = title?.pageId === pageId ? title.state : "saved";
  const disconnected = connection === "disconnected";
  const failed =
    bodyState === "error" ||
    titleState === "error" ||
    disconnected ||
    linked.some((source) => source.state === "error");
  const saved =
    bodyState === "saved" &&
    titleState === "saved" &&
    connection === "connected" &&
    linked.every((source) => source.state === "saved");

  useEffect(() => {
    if (bodyState !== "saving") return;
    const timer = setTimeout(() => {
      setBody((current) =>
        current?.pageId === pageId && current.state === "saving"
          ? { pageId, state: "error" }
          : current,
      );
    }, 90000);
    return () => clearTimeout(timer);
  }, [bodyState, pageId, setBody]);

  const connecting =
    !connection ||
    connection === "connecting" ||
    bodyState === "connecting" ||
    titleState === "connecting";
  const label = failed
    ? t("Save failed")
    : connecting
      ? t("Connecting")
      : saved
        ? t("Saved")
        : t("Saving");
  return (
    <Tooltip
      label={`${label} — ${
        failed
          ? t(
              "Save not confirmed. Keep this page open and check the server connection.",
            )
          : t("Changes are saved automatically to your server.")
      }`}
    >
      <Text
        role="status"
        aria-live="polite"
        aria-label={label}
        tabIndex={compactOnMobile ? 0 : undefined}
        size="xs"
        c={failed ? "red" : "dimmed"}
        style={{ whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center" }}
      >
        {compactOnMobile ? <>
          <Box component="span" hiddenFrom="sm" aria-hidden="true" style={{ display: "flex", alignItems: "center", width: 20, justifyContent: "center" }}>
            {failed ? <IconAlertCircle size={17} /> : saved ? <IconCheck size={17} /> : <IconClock size={17} />}
          </Box>
          <Text span visibleFrom="sm" inherit>{label}</Text>
        </> : label}
      </Text>
    </Tooltip>
  );
}
