import { Alert, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import OfflineNavigationButton from "./offline-navigation-button";

export default function OfflineReauthenticate() {
  const { t } = useTranslation("offline");
  const redirect = window.location.pathname + window.location.search + window.location.hash;
  return <Alert color="orange">
    <Text>{t("Offline documents are locked. Sign in again with the same account to recover your pending changes.")}</Text>
    <OfflineNavigationButton to={`/login?${new URLSearchParams({ redirect })}`}>{t("Sign in again")}</OfflineNavigationButton>
  </Alert>;
}
