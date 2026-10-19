import { appPath } from "@/lib/app-path";
import { useState } from "react";
import {

  login,
  logout,

  setupWorkspace,
  verifyUserToken,
} from "@/features/auth/services/auth-service";
import { useNavigate } from "react-router-dom";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {

  ILogin,

  ISetupWorkspace,
  IVerifyUserToken,
} from "@/features/auth/types/auth.types";
import { notifications } from "@mantine/notifications";
import { IAcceptInvite } from "@/features/workspace/types/workspace.types.ts";
import {
  acceptInvitation,
  createWorkspace,
} from "@/features/workspace/services/workspace-service.ts";
import APP_ROUTE, { getPostLoginRedirect } from "@/lib/app-route.ts";
import { RESET } from "jotai/utils";
import { useTranslation } from "react-i18next";
import { isCloud } from "@/lib/config.ts";
import { clearOfflineData, hasPendingOfflineChanges, offlineConsented } from "@/features/offline/offline-store";
import { getMyInfo } from "@/features/user/services/user-service";

export default function useAuth() {
  const { t } = useTranslation(["translation", "offline"]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [, setCurrentUser] = useAtom(currentUserAtom);

  const handleSignIn = async (data: ILogin) => {
    setIsLoading(true);

    try {
      const response = await login(data);
      setIsLoading(false);

      // Check if MFA is required
      if (response?.userHasMfa) {
        navigate(APP_ROUTE.AUTH.MFA_CHALLENGE + window.location.search);
      } else if (response?.requiresMfaSetup) {
        navigate(APP_ROUTE.AUTH.MFA_SETUP_REQUIRED + window.location.search);
      } else {
        const redirect = getPostLoginRedirect();
        if (offlineConsented() || redirect.startsWith("/offline")) {
          // A recovery target may live outside UserProvider. Verify the owner
          // before opening local documents, then discard the old query cache.
          await getMyInfo();
          window.location.assign(appPath(redirect));
        } else navigate(redirect);
      }
    } catch (err) {
      setIsLoading(false);

      const message = err.response?.data?.message;
      if (isCloud() && message?.includes("verify your email")) {
        const sig = err.response?.data?.emailSignature;
        navigate(
          `${APP_ROUTE.AUTH.VERIFY_EMAIL}?email=${encodeURIComponent(data.email)}${sig ? `&sig=${sig}` : ""}`,
        );
        return;
      }

      notifications.show({
        message: typeof message === 'string' ? t(message) : message,
        color: "red",
      });
    }
  };

  const handleInvitationSignUp = async (data: IAcceptInvite) => {
    setIsLoading(true);

    try {
      const response = await acceptInvitation(data);
      setIsLoading(false);

      if (response?.requiresLogin) {
        notifications.show({
          message: t(
            "Account created successfully. Please log in to set up two-factor authentication.",
          ),
        });
        navigate(APP_ROUTE.AUTH.LOGIN);
      } else {
        navigate(APP_ROUTE.HOME);
      }
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  const handleSetupWorkspace = async (data: ISetupWorkspace) => {
    setIsLoading(true);

    try {{
        const res = await setupWorkspace(data);
        setIsLoading(false);
        navigate(APP_ROUTE.HOME);
      }
    } catch (err) {
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };



  const handleLogout = async () => {
    try {
      if (await hasPendingOfflineChanges()) {
        notifications.show({ color: "orange", message: t("Sync offline changes before logging out. Open Offline documents to finish syncing.", { ns: "offline" }) });
        return;
      }
    } catch {
      notifications.show({ color: "red", message: t("Could not check local changes. Keep this page open and try again before logging out.", { ns: "offline" }) });
      return;
    }
    await clearOfflineData();
    setCurrentUser(RESET);
    await logout();
    window.location.replace(appPath(`${APP_ROUTE.AUTH.LOGIN}?logout=1`));
  };



  const handleVerifyUserToken = async (data: IVerifyUserToken) => {
    setIsLoading(true);

    try {
      await verifyUserToken(data);
      setIsLoading(false);
    } catch (err) {
      console.log(err);
      setIsLoading(false);
      notifications.show({
        message: err.response?.data.message,
        color: "red",
      });
    }
  };

  return {
    signIn: handleSignIn,
    invitationSignup: handleInvitationSignUp,
    setupWorkspace: handleSetupWorkspace,


    verifyUserToken: handleVerifyUserToken,
    logout: handleLogout,
    isLoading,
  };
}
