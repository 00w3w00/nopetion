import ConnectorSettings from "@/features/personal-connectors/connector-settings";
import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/layouts/global/layout.tsx";
import { Error404 } from "@/components/ui/error-404.tsx";
import { isCloud, isPersonalMode } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import { useTrackOrigin } from "@/hooks/use-track-origin";


const SetupWorkspace = lazy(() => import("@/pages/auth/setup-workspace.tsx"));
const LoginPage = lazy(() => import("@/pages/auth/login"));
const Home = lazy(() => import("@/pages/dashboard/home"));
const Page = lazy(() => import("@/pages/page/page"));
const AccountSettings = lazy(
  () => import("@/pages/settings/account/account-settings"),
);
const WorkspaceMembers = lazy(
  () => import("@/pages/settings/workspace/workspace-members"),
);
const WorkspaceSettings = lazy(
  () => import("@/pages/settings/workspace/workspace-settings"),
);
const Groups = lazy(() => import("@/pages/settings/group/groups"));
const GroupInfo = lazy(() => import("./pages/settings/group/group-info"));
const Spaces = lazy(() => import("@/pages/settings/space/spaces.tsx"));
const AccountPreferences = lazy(
  () => import("@/pages/settings/account/account-preferences.tsx"),
);
const SpaceHome = lazy(() => import("@/pages/space/space-home.tsx"));
const PageRedirect = lazy(() => import("@/pages/page/page-redirect.tsx"));
const InviteSignup = lazy(() => import("@/pages/auth/invite-signup.tsx"));
const SharedPage = lazy(() => import("@/pages/share/shared-page.tsx"));
const Shares = lazy(() => import("@/pages/settings/shares/shares.tsx"));
const ShareLayout = lazy(
  () => import("@/features/share/components/share-layout.tsx"),
);
const ShareRedirect = lazy(() => import("@/pages/share/share-redirect.tsx"));
const PublicSpacePage = lazy(
  () => import("@/pages/public-space/public-space-page.tsx"),
);
const PublicSpaceLayout = lazy(
  () => import("@/features/public-space/components/public-space-layout.tsx"),
);
const PublicSpaceDirectoryPage = lazy(
  () => import("@/pages/public-space/public-space-directory-page.tsx"),
);
const SpacesPage = lazy(() => import("@/pages/spaces/spaces.tsx"));
const SpaceTrash = lazy(() => import("@/pages/space/space-trash.tsx"));
const PersonalAiSettings = lazy(() => import("@/features/personal-ai/personal-ai-settings"));
const McpSettings = lazy(() => import("@/features/personal-mcp/mcp-settings"));
const FavoritesPage = lazy(() => import("@/pages/favorites/favorites-page"));
const LabelPage = lazy(() => import("@/pages/label/label-page"));
const PersonalTemplates = lazy(() => import("@/features/personal/components/template-gallery"));
const ClassificationWorkspace = lazy(() => import('@/features/personal-classification/classification-workspace'));
const OfflineWorkspace = lazy(() => import('@/features/offline/offline-workspace'));
const ServerSettings = lazy(() => import('@/features/server-settings/server-settings'));
const OfflineSettings = lazy(() => import('@/features/offline/offline-settings'));

export default function App() {
  const { t } = useTranslation();

  useTrackOrigin();

  useEffect(() => {
    // warm the editor chunk so opening a page doesn't wait on the network
    const timer = setTimeout(() => import("@/pages/page/page"), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={null}>
      <Routes>
        <Route index element={<Navigate to="/home" />} />
        <Route path={"/login"} element={<LoginPage />} />
        <Route path={"/invites/:invitationId"} element={<InviteSignup />} />
        {isPersonalMode() && <Route path="/offline" element={<OfflineWorkspace />} />}




        {!isCloud() && (
          <Route path={"/setup/register"} element={<SetupWorkspace />} />
        )}



        <Route element={<ShareLayout />}>
          <Route
            path={"/share/:shareId/p/:pageSlug"}
            element={<SharedPage />}
          />
          <Route path={"/share/p/:pageSlug"} element={<SharedPage />} />
        </Route>

        <Route path={"/docs"} element={<PublicSpaceDirectoryPage />} />
        <Route element={<PublicSpaceLayout />}>
          <Route path={"/docs/:spaceSlug"} element={<PublicSpacePage />} />
          <Route
            path={"/docs/:spaceSlug/:pageSlug"}
            element={<PublicSpacePage />}
          />
        </Route>


        <Route path={"/share/:shareId"} element={<ShareRedirect />} />
        <Route path={"/p/:pageSlug"} element={<PageRedirect />} />

        <Route element={<Layout />}>
          <Route path={"/home"} element={<Home />} />
          {isPersonalMode() && <Route path="/templates" element={<PersonalTemplates />} />}
          {isPersonalMode() && <Route path="/classifications" element={<ClassificationWorkspace />} />}


          <Route path={"/spaces"} element={<SpacesPage />} />
          <Route path={"/favorites"} element={<FavoritesPage />} />
          <Route path={"/labels/:labelName"} element={<LabelPage />} />


          <Route path={"/s/:spaceSlug"} element={<SpaceHome />} />
          <Route path={"/s/:spaceSlug/trash"} element={<SpaceTrash />} />
          <Route
            path={"/s/:spaceSlug/p/:pageSlug"}
            element={<Page />}
          />



          <Route path={"/settings"}>
            {isPersonalMode() && <Route path="server" element={<ServerSettings />} />}
            {isPersonalMode() && <Route path="offline" element={<OfflineSettings />} />}
            <Route path={"account/profile"} element={<AccountSettings />} />
            <Route
              path={"account/preferences"}
              element={<AccountPreferences />}
            />


            <Route path={"workspace"} element={<WorkspaceSettings />} />
            <Route path={"members"} element={<WorkspaceMembers />} />

            <Route path={"groups"} element={<Groups />} />
            <Route path={"groups/:groupId"} element={<GroupInfo />} />
            <Route path={"spaces"} element={<Spaces />} />
            <Route path={"sharing"} element={<Shares />} />


            <Route path={"connections"} element={<ConnectorSettings />} />
            <Route path={"personal-ai"} element={<PersonalAiSettings />} />
            {isPersonalMode() && <Route path="mcp" element={<McpSettings />} />}







          </Route>
        </Route>

        <Route path="*" element={<Error404 />} />
      </Routes>
    </Suspense>
  );
}
