import { Alert, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title";
import SettingsTitle from "@/components/settings/settings-title";
import { isPersonalMode } from "@/lib/config";
import AiConnection from "./ai-connection";

export default function PersonalAiSettings() {
  const { t } = useTranslation("personal-ai");
  return (
    <Stack>
      <DocumentTitle title={t("connection")} />
      <SettingsTitle title={t("connection")} />
      {isPersonalMode() ? <AiConnection /> : <Alert>{t("personalOnly")}</Alert>}
    </Stack>
  );
}
