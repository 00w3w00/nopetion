import {
  Modal,
  Button,
  Group,
  Text,
  Select,
  Switch,
  Divider,
  Tooltip,
  Badge,
} from "@mantine/core";
import {
  exportPage,
  exportPageToDocx,
  getPageById,
} from "@/features/page/services/page-service.ts";
import { useAtomValue } from "jotai";
import {
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import {
  bodySaveStateAtom,
  titleSaveStateAtom,
} from "@/features/personal/save-status";
import {
  captureAiSnapshot,
  documentHash,
  snapshotMatchesSaved,
} from "@/features/personal-ai/ai-editor";
import { useState } from "react";
import { ExportFormat } from "@/features/page/types/page.types.ts";
import { notifications } from "@mantine/notifications";
import { exportSpace } from "@/features/space/services/space-service";
import { useTranslation } from "react-i18next";
import { Feature } from "@/features/community/capabilities";
import { useHasFeature } from "@/features/community/capabilities";
import { useUpgradeLabel } from "@/features/community/capabilities";
import { downloadSelectedPdf, usePdfSelection } from "./pdf-export-selection";
import { PdfSubpageSelection } from "./pdf-subpage-selection";

interface ExportModalProps {
  id: string;
  type: "space" | "page";
  open: boolean;
  onClose: () => void;
}

export default function ExportModal({
  id,
  type,
  open,
  onClose,
}: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.Markdown);
  const [includeChildren, setIncludeChildren] = useState<boolean>(false);
  const [includeAttachments, setIncludeAttachments] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const { t } = useTranslation(["translation", "pdf"]);
  const upgradeLabel = useUpgradeLabel();
  const isDocx = format === ExportFormat.Docx;
  const isPdf = format === ExportFormat.PDF;
  const editor = useAtomValue(pageEditorAtom),
    titleEditor = useAtomValue(titleEditorAtom);
  const bodySave = useAtomValue(bodySaveStateAtom),
    titleSave = useAtomValue(titleSaveStateAtom);
  const openEditor =
    editor && !editor.isDestroyed && editor.storage.pageId === id
      ? editor
      : null;
  const openTitle =
    titleEditor && !titleEditor.isDestroyed && titleEditor.storage.pageId === id
      ? titleEditor
      : null;
  const waitingForSave =
    isPdf &&
    !!openEditor &&
    (!openTitle ||
      bodySave.pageId !== id ||
      bodySave.state !== "saved" ||
      titleSave.pageId !== id ||
      titleSave.state !== "saved");
  const docxEntitled = useHasFeature(Feature.DOCX_EXPORT);
  const blockedByLicense = isDocx && !docxEntitled;
  const pdfSelection = usePdfSelection(id, open && type === "page" && isPdf);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (type === "page") {
        if (format === ExportFormat.PDF) {
          let sourceHash: string | undefined, title: string | undefined;
          if (openEditor) {
            if (waitingForSave || !openTitle) throw new Error("pdfStale");
            const snapshot = captureAiSnapshot(openEditor, openTitle.getText());
            const saved = await getPageById({ pageId: id });
            if (
              openTitle.isDestroyed ||
              !snapshotMatchesSaved(
                openEditor,
                openTitle.getText(),
                snapshot,
                saved,
              )
            )
              throw new Error("pdfStale");
            sourceHash = await documentHash(saved.content);
            title = saved.title || "";
            if (openTitle.isDestroyed || !snapshotMatchesSaved(openEditor, openTitle.getText(), snapshot, saved))
              throw new Error("pdfStale");
          }
          await downloadSelectedPdf({ pageId: id, sourceHash, title, selectedPages: pdfSelection.selectedPages });
        } else if (format === ExportFormat.Docx) {
          await exportPageToDocx({ pageId: id });
        } else {
          await exportPage({
            pageId: id,
            format,
            includeChildren,
            includeAttachments,
          });
        }
      }
      if (type === "space") {
        await exportSpace({ spaceId: id, format, includeAttachments });
      }
      notifications.show({
        message: t("Export successful"),
      });
      onClose();
    } catch (err) {
      const response = (err as { response?: { status?: number } })?.response;
      if (isPdf && response?.status === 409) pdfSelection.refresh();
      notifications.show({
        message: isPdf
          ? t(
              (err instanceof Error && err.message === "pdfStale") ||
                response?.status === 409
                ? "pdf:wait"
                : "pdf:failed",
            )
          : t("Export failed"),
        color: "red",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleChange = (format: ExportFormat) => {
    setFormat(format);
  };

  return (
    <Modal.Root
      opened={open}
      onClose={onClose}
      size={500}
      padding="xl"
      yOffset="10vh"
      xOffset={0}
      mah={400}
      styles={{ content: { maxHeight: "80dvh", display: "flex", flexDirection: "column" } }}
      onClick={(e) => e.stopPropagation()}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Header py={0}>
          <Modal.Title fw={500}>{t(`Export ${type}`)}</Modal.Title>
          <Modal.CloseButton aria-label={t("Close")} />
        </Modal.Header>
        <Modal.Body style={{ overflowY: "auto" }}>
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Text size="md">{t("Format")}</Text>
            </div>
            <ExportFormatSelection
              format={format}
              onChange={handleChange}
              includeDocx={type === "page"}
              includePdf={type === "page"}
              docxEntitled={docxEntitled}
            />
          </Group>

          {type === "page" && isPdf && (
            <><Text size="sm" c="dimmed" mt="md">
              {t(waitingForSave ? "pdf:wait" : "pdf:scope")}
            </Text><PdfSubpageSelection {...pdfSelection} onChange={pdfSelection.setSelectedIds} onRetry={pdfSelection.refresh} disabled={isExporting} /></>
          )}

          {type === "page" && !isDocx && !isPdf && (
            <>
              <Divider my="sm" />

              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="md">{t("Include subpages")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeChildren(event.currentTarget.checked)
                  }
                  checked={includeChildren}
                />
              </Group>

              <Group justify="space-between" wrap="nowrap" mt="md">
                <div>
                  <Text size="md">{t("Include attachments")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeAttachments(event.currentTarget.checked)
                  }
                  checked={includeAttachments}
                />
              </Group>
            </>
          )}

          {type === "space" && (
            <>
              <Divider my="sm" />

              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="md">{t("Include attachments")}</Text>
                </div>
                <Switch
                  onChange={(event) =>
                    setIncludeAttachments(event.currentTarget.checked)
                  }
                  checked={includeAttachments}
                />
              </Group>
            </>
          )}

          <Group justify="center" mt="md">
            <Button onClick={onClose} variant="default">
              {t("Cancel")}
            </Button>
            <Tooltip
              label={upgradeLabel}
              disabled={!blockedByLicense}
              withArrow
            >
              <Button
                onClick={handleExport}
                loading={isExporting}
                disabled={blockedByLicense || waitingForSave || (isPdf && pdfSelection.loading)}
                data-disabled={blockedByLicense || undefined}
              >
                {t("Export")}
              </Button>
            </Tooltip>
          </Group>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

interface ExportFormatSelection {
  format: ExportFormat;
  onChange: (value: string) => void;
  includeDocx?: boolean;
  includePdf?: boolean;
  docxEntitled?: boolean;
}
function ExportFormatSelection({
  format,
  onChange,
  includeDocx,
  includePdf,
  docxEntitled,
}: ExportFormatSelection) {
  const { t } = useTranslation();

  const data = [
    { value: "markdown", label: "Markdown" },
    { value: "html", label: "HTML" },
    ...(includePdf ? [{ value: "pdf", label: "PDF (.pdf)" }] : []),
    ...(includeDocx
      ? [{ value: "docx", label: "Word (.docx)", disabled: !docxEntitled }]
      : []),
  ];

  return (
    <Select
      data={data}
      defaultValue={format}
      onChange={onChange}
      styles={{ wrapper: { maxWidth: 140 }, option: { opacity: 1 } }}
      comboboxProps={{ width: 200 }}
      allowDeselect={false}
      withCheckIcon={false}
      aria-label={t("Select export format")}
      renderOption={({ option }) =>
        option.value === "docx" && !docxEntitled ? (
          <div>
            <Text size="sm" c="dimmed">
              {option.label}
            </Text>
            <Badge size="xs" mt={4}>
              {t("Enterprise")}
            </Badge>
          </div>
        ) : (
          <Text size="sm">{option.label}</Text>
        )
      }
    />
  );
}
