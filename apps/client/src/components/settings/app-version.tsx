import { useAppVersion } from "@/features/workspace/queries/workspace-query.ts";
import { getAppName, isCloud } from "@/lib/config.ts";
import classes from "@/components/settings/settings.module.css";
import { Anchor, Text } from "@mantine/core";
import { appPath } from "@/lib/app-path";
import { useTranslation } from "react-i18next";

export default function AppVersion() {
  const { t } = useTranslation();
  const { data: appVersion } = useAppVersion(!isCloud());
  return (
    <div className={classes.text}>
      <Text size="sm" c="dimmed">
        {getAppName()}
        {appVersion?.currentVersion && <> v{appVersion.currentVersion}</>}
      </Text>
      <Anchor size="xs" href={appPath("/api/legal")} target="_blank" rel="noopener noreferrer">
        {t("Source and license")}
      </Anchor>
    </div>
  );
}
