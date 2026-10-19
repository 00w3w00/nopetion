import clsx from "clsx";
import { useTranslation } from "react-i18next";
import styles from "./docs.module.css";

export default function DocsFooterBranding({
  className,
  refSource = "public-space",
}: {
  className?: string;
  refSource?: string;
}) {
  const { t } = useTranslation();
  return (
    <footer className={clsx(styles.footer, className)}>
      <span>Powered by Nopetion</span>
      {" · "}
      <a
        className={styles.footerBranding}
        href={`https://docmost.com?ref=${refSource}`}
        target="_blank"
        rel="noreferrer"
      >
        {t("Original project")}
      </a>
    </footer>
  );
}
