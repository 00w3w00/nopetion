import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api-client";
import { saveAs } from "file-saver";

export interface PdfSubpage {
  id: string;
  title: string;
  parentPageId: string;
  depth: number;
  sourceHash: string;
}

export function usePdfSelection(pageId: string, enabled: boolean) {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<{ pageId: string; items: PdfSubpage[]; maxPages: number; loading: boolean; error: boolean }>({ pageId: "", items: [], maxPages: 30, loading: false, error: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const refresh = useCallback(() => setGeneration((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setSelectedIds([]);
    setState({ pageId, items: [], maxPages: 30, loading: true, error: false });
    api.post<{ items: PdfSubpage[]; maxPages: number }>("/pdf-export/tree", { pageId }).then(({ data }) => {
      if (current) setState({ pageId, items: data.items, maxPages: data.maxPages, loading: false, error: false });
    }).catch(() => {
      if (current) setState({ pageId, items: [], maxPages: 30, loading: false, error: true });
    });
    return () => { current = false; };
  }, [pageId, enabled, generation]);
  const ready = enabled && state.pageId === pageId;
  const items = ready ? state.items : [];
  return { items, maxPages: state.maxPages, loading: enabled && (!ready || state.loading), error: ready && state.error,
    selectedIds: ready ? selectedIds : [], setSelectedIds,
    selectedPages: items.filter((page) => selectedIds.includes(page.id)).map((page) => ({ pageId: page.id, title: page.title, sourceHash: page.sourceHash })), refresh };
}

export async function downloadSelectedPdf(data: { pageId: string; sourceHash?: string; title?: string; selectedPages: { pageId: string; title: string; sourceHash: string }[] }) {
  const response = await api.post("/pdf-export", data, { responseType: "blob" });
  const filename = /filename="([^"]+)"/.exec(String(response.headers["content-disposition"] || ""))?.[1];
  if (!filename || response.data.type !== "application/pdf") throw new Error("pdfFailed");
  saveAs(response.data, decodeURIComponent(filename));
}
