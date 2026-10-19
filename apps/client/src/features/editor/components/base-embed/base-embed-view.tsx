import { NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { Alert } from "@mantine/core";
import { useTranslation } from "react-i18next";
/** Preserve the original reference in JSON/Yjs. Commercial database data is
 * never silently converted to an unrelated community database. */
export function BaseEmbedView({ node }: NodeViewProps) {
  const { t } = useTranslation();
  return <NodeViewWrapper contentEditable={false} data-type="baseEmbed" data-page-id={node.attrs.pageId}>
    <Alert color="gray">{t("This legacy database is unavailable in the community build. Its reference has been preserved.")}</Alert>
  </NodeViewWrapper>;
}
