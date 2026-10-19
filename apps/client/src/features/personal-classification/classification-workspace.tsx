import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, Container, Divider, Group, Loader, Paper, Select, Stack, Switch, TagsInput, Text, TextInput, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { workspaceAtom } from '@/features/user/atoms/current-user-atom';
import { buildPageUrl } from '@/features/page/page.utils';
import { DocumentTitle } from '@/components/ui/document-title';
import { isPersonalMode } from '@/lib/config';
import { classificationApi, type ClassificationConfig, type ClassificationPages, type ClassificationRule } from './classification-api';

export default function ClassificationWorkspace() {
  const workspace = useAtomValue(workspaceAtom);
  return isPersonalMode() && workspace ? <Workspace key={workspace.id} workspaceId={workspace.id} /> : null;
}

function Workspace({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation('classification');
  const client = useQueryClient();
  const [params] = useSearchParams();
  const [selected, setSelected] = useState('all');
  const [query, setQuery] = useState('');
  const [search] = useDebouncedValue(query, 200);
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [revision, setRevision] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const config = useQuery({ queryKey: ['personal-classification', workspaceId, 'config'],
    queryFn: () => classificationApi<ClassificationConfig>(workspaceId, 'config'), staleTime: 0, refetchOnMount: 'always' });
  useEffect(() => {
    if (config.data && !dirty) {
      setRules(config.data.rules); setEnabled(config.data.enabled); setRevision(config.data.revision);
    }
  }, [config.data, dirty]);
  useEffect(() => {
    const label = params.get('label');
    const rule = config.data?.rules.find(r => r.name === label && r.enabled);
    if (rule) setSelected(rule.id);
  }, [params, config.data]);
  const save = useMutation({
    mutationFn: () => classificationApi<ClassificationConfig>(workspaceId, 'configure', {
      enabled, rules, ...(revision ? { expectedRevision: revision } : {}),
    }),
    onSuccess: result => {
      setDirty(false); setRevision(result.revision); setSelected('all');
      client.setQueryData(['personal-classification', workspaceId, 'config'], result);
      void client.invalidateQueries({ queryKey: ['personal-classification', workspaceId] });
    },
  });
  const pages = useInfiniteQuery({
    queryKey: ['personal-classification', workspaceId, 'pages', selected, search, config.data?.revision],
    queryFn: ({ pageParam }) => classificationApi<ClassificationPages>(workspaceId, 'pages', {
      ...(selected !== 'all' ? { ruleId: selected } : {}), query: search,
      ...(pageParam ? { cursor: pageParam } : {}), limit: 30,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.nextCursor || undefined,
    enabled: !!config.data?.enabled, staleTime: 0, refetchOnWindowFocus: true,
  });
  function patchRule(id: string, patch: Partial<ClassificationRule>) {
    setRules(all => all.map(rule => rule.id === id ? { ...rule, ...patch } : rule)); setDirty(true);
  }
  const currentRules = config.data?.rules.filter(r => r.enabled) || [];
  const items = pages.data?.pages.flatMap(p => p.items) || [];
  if (config.isPending) return <Container py="xl"><Loader size="sm" /></Container>;
  return <Container size="100%" py="md" style={{ paddingInline: 16, minWidth: 0 }} data-classification-workspace>
    <DocumentTitle title={t('title')} />
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>{t('title')}</Title>
        <Button variant="default" onClick={() => setEditing(!editing)}>{t(editing ? 'hideRules' : 'editRules')}</Button>
      </Group>
      <Text c="dimmed" size="sm">{t('description')}</Text>
      {config.isError && <Alert color="red">{t('loadError')} <Button size="xs" variant="subtle" onClick={() => config.refetch()}>{t('retry')}</Button></Alert>}
      <Paper withBorder p="md" radius="md">
        <Stack gap="md">
          <Switch label={t('enable')} checked={enabled} disabled={config.isError || save.isPending}
            onChange={event => { setEnabled(event.currentTarget.checked); setDirty(true); }} />
          {(editing || !config.data?.enabled) && <>
            <Text size="xs" c="dimmed">{t('ruleHelp')}</Text>
            {rules.map(rule => <Paper key={rule.id} withBorder p="sm" radius="sm">
              <Stack gap="xs">
                <Group wrap="wrap" align="end">
                  <TextInput label={t('name')} value={rule.name} maxLength={40} disabled={save.isPending} style={{ flex: '1 1 150px', minWidth: 0 }}
                    onChange={event => patchRule(rule.id, { name: event.currentTarget.value })} />
                  <Select label={t('field')} value={rule.field} allowDeselect={false} disabled={save.isPending} style={{ flex: '1 1 150px', minWidth: 0 }}
                    data={['both', 'title', 'content'].map(value => ({ value, label: t('field_' + value) }))}
                    onChange={value => patchRule(rule.id, { field: value as ClassificationRule['field'] })} />
                  <Button color="red" variant="subtle" size="sm" disabled={save.isPending} aria-label={t('removeRule', { name: rule.name })}
                    onClick={() => { setRules(all => all.filter(r => r.id !== rule.id)); setDirty(true); }}><IconTrash size={16} /></Button>
                </Group>
                <TagsInput label={t('keywords')} value={rule.keywords} maxTags={10} disabled={save.isPending} splitChars={[',', '，']}
                  onChange={keywords => patchRule(rule.id, { keywords })} />
                <Switch label={t('ruleEnabled')} checked={rule.enabled} disabled={save.isPending} onChange={event => patchRule(rule.id, { enabled: event.currentTarget.checked })} />
              </Stack>
            </Paper>)}
            <Button variant="light" leftSection={<IconPlus size={16} />} disabled={rules.length >= 20 || save.isPending}
              onClick={() => { setRules(all => [...all, { id: crypto.randomUUID(), name: '', keywords: [], field: 'both', enabled: true }]); setDirty(true); }}>{t('addRule')}</Button>
          </>}
          <Group justify="space-between" wrap="wrap">
            <Text size="xs" c="dimmed">{t(dirty ? 'unsaved' : revision ? 'saved' : 'defaults')}</Text>
            <Button loading={save.isPending} disabled={!dirty || config.isError || rules.some(r => !r.name.trim() || !r.keywords.length)} onClick={() => save.mutate()}>{t('save')}</Button>
          </Group>
          {save.isError && <Alert color="red">{t((save.error as any)?.response?.status === 409 ? 'conflict' : 'saveError')}</Alert>}
        </Stack>
      </Paper>
      {config.data?.enabled && <>
        <Divider />
        <Group gap="xs">
          {[{ id: 'all', name: t('all') }, ...currentRules, { id: 'unclassified', name: t('unclassified') }].map(rule =>
            <Button key={rule.id} size="xs" variant={selected === rule.id ? 'filled' : 'light'} onClick={() => setSelected(rule.id)}>{rule.name}</Button>)}
        </Group>
        <TextInput value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder={t('search')} aria-label={t('search')} />
        {pages.isPending && <Loader size="sm" />}
        {pages.isError && <Alert color="red">{t('loadError')} <Button variant="subtle" onClick={() => pages.refetch()}>{t('retry')}</Button></Alert>}
        {!pages.isPending && !pages.isError && !items.length && <Text c="dimmed">{t('empty')}</Text>}
        <Stack gap="xs">
          {items.map(page => <Paper key={page.id} withBorder p="sm" radius="sm">
            <Stack gap={6}>
              <Text component={Link} to={buildPageUrl(page.spaceSlug, page.slugId, page.title)} fw={500} style={{ overflowWrap: 'anywhere' }}>
                {page.icon || '📄'} {page.title || t('untitled')}
              </Text>
              <Group gap={6}>{page.autoLabels.map(label => <Badge key={label} variant="light" tt="none">{label}</Badge>)}</Group>
            </Stack>
          </Paper>)}
        </Stack>
        {pages.hasNextPage && <Button variant="default" loading={pages.isFetchingNextPage} onClick={() => pages.fetchNextPage()}>{t('more')}</Button>}
      </>}
    </Stack>
  </Container>;
}
