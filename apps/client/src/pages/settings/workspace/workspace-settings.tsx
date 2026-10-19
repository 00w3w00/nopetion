import SettingsTitle from "@/components/settings/settings-title.tsx";
import WorkspaceNameForm from "@/features/workspace/components/settings/components/workspace-name-form";
import WorkspaceIcon from "@/features/workspace/components/settings/components/workspace-icon.tsx";
import { useTranslation } from "react-i18next";
import { isBetaPublicSpaces, isCloud, isPersonalMode } from "@/lib/config.ts";
import { Divider } from "@mantine/core";
import WorkspaceDefaultPageEditMode from "@/features/workspace/components/settings/components/workspace-default-page-edit-mode.tsx";
import AllowPublicSpaces from "@/features/workspace/components/settings/components/allow-public-spaces.tsx";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import PersonalWorkspaceReset from '@/features/personal/components/personal-workspace-reset';

export default function WorkspaceSettings() {
  const { t } = useTranslation();
  return (
    <>
      <DocumentTitle title="Workspace Settings" />
      <SettingsTitle title={t("General")} />
      <WorkspaceIcon />
      <WorkspaceNameForm />

      {!isPersonalMode() && <>
        <Divider my="md" />

        <Divider my="md" />

      </>}

      {isBetaPublicSpaces() && (
        <>
          <Divider my="md" />
          <AllowPublicSpaces />
        </>
      )}

      {isCloud() && (
        <>
          <Divider my="md" />

        </>
      )}

      <Divider my="md" />
      <WorkspaceDefaultPageEditMode />
      {isPersonalMode() && <><Divider my="xl" /><PersonalWorkspaceReset /></>}
    </>
  );
}
