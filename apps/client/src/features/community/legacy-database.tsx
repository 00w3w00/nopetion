import { Alert } from "@mantine/core";
import { useTranslation } from "react-i18next";
export function LegacyDatabase({ titleSlot }: { pageId?: string; editable?: boolean; titleSlot?: React.ReactNode }) {
  const { t } = useTranslation();
  return <>{titleSlot}<Alert color="gray">{t("This legacy database is unavailable in the community build. Its reference has been preserved.")}</Alert></>;
}
