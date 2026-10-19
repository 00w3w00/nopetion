import { Alert, Button, Checkbox, Group, Loader, ScrollArea, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { PdfSubpage } from "./pdf-export-selection";

interface Props {
  items: PdfSubpage[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading: boolean;
  error: boolean;
  maxPages: number;
  onRetry: () => void;
  disabled?: boolean;
}

export function PdfSubpageSelection({ items, selectedIds, onChange, loading, error, maxPages, onRetry, disabled }: Props) {
  const { t } = useTranslation(["pdf", "translation"]);
  const limit = Math.max(0, maxPages - 1);
  return <Stack gap="xs" mt="md">
    <Text fw={500} size="sm">{t("pdf:subpages")}</Text>
    <Text size="xs" c="dimmed">{t("pdf:order")}</Text>
    {loading ? <Group gap="xs" role="status"><Loader size="xs" /><Text size="sm">{t("pdf:loading")}</Text></Group>
      : error ? <Alert color="yellow"><Text size="sm">{t("pdf:loadFailed")}</Text><Button size="xs" variant="subtle" onClick={onRetry}>{t("pdf:retry")}</Button></Alert>
        : items.length === 0 ? <Text size="sm" c="dimmed">{t("pdf:noSubpages")}</Text> : <>
          <Group gap="xs">
            <Button size="xs" variant="subtle" disabled={disabled || items.length > limit} onClick={() => onChange(items.map((page) => page.id))}>{t("pdf:selectAll")}</Button>
            <Button size="xs" variant="subtle" disabled={disabled || !selectedIds.length} onClick={() => onChange([])}>{t("pdf:clearSelection")}</Button>
            <Text size="xs" c="dimmed">{t("pdf:selected", { count: selectedIds.length })}</Text>
          </Group>
          <Text size="xs" c="dimmed">{t("pdf:limit", { count: limit })}</Text>
          <ScrollArea.Autosize mah={180} type="auto" offsetScrollbars>
            <Stack gap="xs" role="group" aria-label={t("pdf:subpages")}>
              {items.map((page) => <Checkbox key={page.id} label={page.title || t("translation:Untitled")} title={page.title || t("translation:Untitled")}
                checked={selectedIds.includes(page.id)}
                disabled={disabled || (!selectedIds.includes(page.id) && selectedIds.length >= limit)}
                onChange={(event) => onChange(event.currentTarget.checked ? [...selectedIds, page.id] : selectedIds.filter((id) => id !== page.id))}
                ml={Math.min(Math.max(0, page.depth - 1), 6) * 12}
                styles={{ label: { overflowWrap: "anywhere" } }} />)}
            </Stack>
          </ScrollArea.Autosize>
        </>}
  </Stack>;
}
