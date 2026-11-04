import { Container, Space } from "@mantine/core";
import HomeTabs from "@/features/home/components/home-tabs";
import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
import SpaceCarousel from "@/features/space/components/space-carousel.tsx";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { isPersonalMode } from "@/lib/config";
import PersonalHome from "@/features/personal/components/personal-home";

export default function Home() {
  const { t } = useTranslation();
  if (isPersonalMode()) {
    return <PersonalHome />;
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
