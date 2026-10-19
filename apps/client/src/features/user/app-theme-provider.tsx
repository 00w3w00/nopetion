import { useMemo, type PropsWithChildren } from "react";
import { MantineProvider } from "@mantine/core";
import { useAtomValue } from "jotai";
import { userAtom } from "./atoms/current-user-atom";
import { appFonts, resolveAppFont } from "./app-fonts";
import { mantineCssResolver, theme } from "@/theme";

export default function AppThemeProvider({ children }: PropsWithChildren) {
  const user = useAtomValue(userAtom);
  const font = resolveAppFont(user?.settings?.preferences?.appFont);
  const selectedTheme = useMemo(() => ({
    ...theme,
    fontFamily: appFonts[font],
    headings: { ...theme.headings, fontFamily: appFonts[font] },
  }), [font]);

  return <MantineProvider theme={selectedTheme} cssVariablesResolver={mantineCssResolver}>
    {children}
  </MantineProvider>;
}
