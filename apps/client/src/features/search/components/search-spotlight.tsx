import { Spotlight } from "@mantine/spotlight";
import { IconSearch } from "@tabler/icons-react";
import { VisuallyHidden, Text } from "@mantine/core";
import { useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { searchSpotlightStore } from "../constants";
import { SearchSpotlightFilters } from "./search-spotlight-filters";
import { useUnifiedSearch } from "../hooks/use-unified-search";
import { SearchResultItem } from "./search-result-item";
import classes from "./search-results.module.css";
export function SearchSpotlight({ spaceId }: { spaceId?: string }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(""), [debounced] = useDebouncedValue(query, 300);
  const [filters,setFilters] = useState<any>({ contentType: "page" });
  const { data, isFetching } = useUnifiedSearch({ ...filters, query: debounced });
  const browse = !!filters.creatorId || !!filters.labelIds?.length, settled = query === debounced;
  const items = (data || []).map(result => <SearchResultItem key={result.id} result={result} isAttachmentResult={false} showSpace={!filters.spaceId} />);
  return <Spotlight.Root size="xl" maxHeight={600} store={searchSpotlightStore} query={query} onQueryChange={setQuery} scrollable overlayProps={{ backgroundOpacity: .55 }}>
    <Spotlight.Search placeholder={t("Search...")} aria-label={t("Search")} leftSection={<IconSearch size={20} stroke={1.5}/>} />
    <div style={{padding:"4px 16px"}}><SearchSpotlightFilters onFiltersChange={setFilters} onAskClick={() => {}} spaceId={spaceId} isAiMode={false}/></div>
    <VisuallyHidden role="status" aria-live="polite">{(query || browse) && settled && !isFetching ? items.length ? t("{{count}} results found",{count:items.length}) : t("No results found") : ""}</VisuallyHidden>
    <Spotlight.ActionsList className={classes.results}>{!query && !browse && !items.length && <Spotlight.Empty>{t("Start typing to search...")}</Spotlight.Empty>}{(query || browse) && settled && !isFetching && !items.length && <Spotlight.Empty>{t("No results found...")}</Spotlight.Empty>}{items}{(query || browse) && isFetching && !items.length && <Spotlight.Empty><Text size="sm">{t("Searching...")}</Text></Spotlight.Empty>}</Spotlight.ActionsList>
  </Spotlight.Root>;
}
