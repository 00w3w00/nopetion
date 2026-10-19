import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  personalEmbedSandbox,
  type PersonalEmbedPreview,
} from "./embed-adapters";
import classes from "./widget-view.module.css";

export default function EmbedPreview({
  preview,
}: {
  preview: PersonalEmbedPreview;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  return (
    <div className={classes.externalPreview}>
      {(preview.src || preview.srcDoc) && (
        <iframe
          key={preview.src || preview.srcDoc}
          title={t("Embed preview") + ": " + preview.provider}
          src={preview.src}
          srcDoc={preview.srcDoc}
          sandbox={personalEmbedSandbox(preview)}
          allow="encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          loading="lazy"
          allowFullScreen
          className={classes.externalFrame}
          style={{ height: preview.height }}
          onLoad={() => setFailed(false)}
          onError={() => setFailed(true)}
        />
      )}
      {(failed || preview.needsEmbedCode) && (
        <p className={classes.note} role={failed ? "alert" : undefined}>
          {failed && `${t("Preview unavailable")} · `}
          {t(
            preview.provider.toLowerCase() === "google maps"
              ? "Use Google Maps → Share → Embed a map → Copy HTML."
              : "This service needs its own embed code. Paste the iframe code from its Share or Embed menu.",
          )}
        </p>
      )}
      {!preview.needsEmbedCode && (
        <p className={classes.note}>
          {t(
            "External previews depend on the provider’s sharing settings and browser privacy restrictions.",
          )}
        </p>
      )}
    </div>
  );
}
