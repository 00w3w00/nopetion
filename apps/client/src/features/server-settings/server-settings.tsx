import { useState } from 'react';
import { Alert, Button, Group, Loader, Stack, Switch, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SettingsTitle from '@/components/settings/settings-title';
import { DocumentTitle } from '@/components/ui/document-title';
import api from '@/lib/api-client';

type Settings = { revision: number; drawioUrl: string; gotenbergUrl: string; iframeEmbedAllowed: boolean; iframeAllowedOrigins: string[] };
export default function ServerSettings() {
  const { t } = useTranslation('server-settings');
  const query = useQuery({ queryKey: ['server-settings'], staleTime: Infinity, refetchOnWindowFocus: false, queryFn: async () => (await api.post<Settings>('/server-settings/get')).data });
  return <Stack><DocumentTitle title={t('title')} /><SettingsTitle title={t('title')} />
    {query.isPending ? <Loader /> : query.isError ? <Alert color="red">{t('loadFailed')}<Button onClick={() => void query.refetch()}>{t('reload')}</Button></Alert>
      : <SettingsForm key={query.data.revision} initial={query.data} />}
  </Stack>;
}
function SettingsForm({ initial }: { initial: Settings }) {
  const { t } = useTranslation('server-settings'), client = useQueryClient();
  const [settings, setSettings] = useState(initial), [origins, setOrigins] = useState(initial.iframeAllowedOrigins.join('\n'));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false);
  const patch = (value: Partial<Settings>) => { setSettings(old => ({ ...old, ...value })); setMessage(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      const result = (await api.post<Settings>('/server-settings/update', { ...settings, iframeAllowedOrigins: origins.split(/[\n,]/).map(s => s.trim()).filter(Boolean) })).data;
      setSettings(result); setOrigins(result.iframeAllowedOrigins.join('\n')); setFailed(false); setMessage(t('saved'));
      // Runtime configuration is read by the existing editor URL accessor.
      (window as any).CONFIG = { ...(window as any).CONFIG, DRAWIO_URL: result.drawioUrl };
      notifications.show({ message: t('saved'), color: 'green' });
      client.setQueryData(['server-settings'], result);
    } catch { setFailed(true); setMessage(t('saveFailed')); } finally { setBusy(false); }
  };
  return <form onSubmit={save}><Stack gap="lg">
    <section><Title order={3}>{t('drawio')}</Title><Text size="sm" c="dimmed">{t('drawioHelp')}</Text>
      <TextInput mt="sm" label={t('drawioUrl')} value={settings.drawioUrl} disabled={busy} onChange={e => patch({ drawioUrl: e.currentTarget.value })} autoComplete="off" />
    </section>
    <section><Title order={3}>{t('pdf')}</Title><Text size="sm" c="dimmed">{t('pdfHelp')}</Text>
      <TextInput mt="sm" label={t('gotenbergUrl')} value={settings.gotenbergUrl} disabled={busy} placeholder="http://gotenberg:3000" onChange={e => patch({ gotenbergUrl: e.currentTarget.value })} autoComplete="off" />
      <Button mt="sm" variant="default" disabled={busy || !initial.gotenbergUrl || settings.gotenbergUrl !== initial.gotenbergUrl} onClick={async () => {
        setBusy(true); try { const result = (await api.post<{ connected: boolean }>('/server-settings/test-gotenberg')).data; setFailed(!result.connected); setMessage(t(result.connected ? 'connected' : 'connectionFailed')); }
        catch { setFailed(true); setMessage(t('connectionFailed')); } finally { setBusy(false); }
      }}>{t('test')}</Button>
    </section>
    <section><Title order={3}>{t('iframe')}</Title><Text size="sm" c="dimmed">{t('iframeHelp')}</Text>
      <Switch mt="sm" label={t('iframeAllowed')} checked={settings.iframeEmbedAllowed} disabled={busy} onChange={e => patch({ iframeEmbedAllowed: e.currentTarget.checked })} />
      <Textarea mt="sm" label={t('origins')} description={t('originsHelp')} value={origins} disabled={busy || !settings.iframeEmbedAllowed} minRows={3} placeholder="https://portal.example.com" onChange={e => { setOrigins(e.currentTarget.value); setMessage(''); }} />
    </section>
    {message && <Alert color={failed ? 'red' : 'green'} role="status">{message}</Alert>}
    <Group><Button type="submit" loading={busy}>{t('save')}</Button><Button variant="default" disabled={busy} onClick={() => void client.invalidateQueries({ queryKey: ['server-settings'] })}>{t('reload')}</Button></Group>
  </Stack></form>;
}
