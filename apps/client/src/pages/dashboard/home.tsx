import { Container, Space } from "@mantine/core";
import HomeTabs from "@/features/home/components/home-tabs";
import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
import SpaceCarousel from "@/features/space/components/space-carousel.tsx";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { isPersonalMode } from "@/lib/config";
import RecentChanges from "@/components/common/recent-changes";
import { Title } from "@mantine/core";

export default function Home() {
  const { t } = useTranslation();
  if (isPersonalMode()) {
    return <>
      <DocumentTitle title={t("Recent documents")} />
      <Container size="900" pt="lg">
        <Title order={2} mb="md">{t("Recent documents")}</Title>
        <RecentChanges />
      </Container>
    </>;
  }

  return (
    <>
      <DocumentTitle title={t("Home")} />
      <Container size={"900"} pt="xl">
        <HomeAiPrompt />

        <Space h="xl" />

        <SpaceCarousel />

        <Space h="xl" />

        <HomeTabs />
      </Container>
    </>
  );
}
