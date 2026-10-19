import { appPath } from "@/lib/app-path";
import { useState } from 'react';
import { Alert, Button, Group, Modal, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { selectPersonalWorkspace } from '@/lib/personal-workspace-scope';
import api from '@/lib/api-client';
import { clearOfflineData } from '@/features/offline/offline-store';

export default function PersonalWorkspaceReset() {
  const { t } = useTranslation('personal-workspaces');
  const current = useAtomValue(currentUserAtom);
  const [opened, setOpened] = useState(false), [busy, setBusy] = useState(false);
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [requestId, setRequestId] = useState(''), [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [localCleanupFailed, setLocalCleanupFailed] = useState(false);
  if (current?.user?.role !== 'owner') return null;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !password.length || confirmation !== 'RESET') return;
    setBusy(true); setError('');
    try {
      const result = (await api.post<{ fallbackWorkspaceId: string; cleanupPending: number }>('/personal-workspaces/reset', {
        confirmationPassword: password, confirmation, requestId,
      })).data;
      setPassword('');
      selectPersonalWorkspace(result.fallbackWorkspaceId);
      try { await clearOfflineData(); }
      catch { setLocalCleanupFailed(true); setPending(true); setBusy(false); return; }
      if (result.cleanupPending) { setPending(true); setBusy(false); }
      else window.location.assign(appPath('/home'));
    } catch { setError(t('resetFailed')); setBusy(false); }
  };
  return <Stack gap="sm">
    <Title order={3}>{t('resetAll')}</Title>
    <Text size="sm" c="dimmed">{t('resetSummary')}</Text>
    <Button color="red" variant="outline" w="fit-content" data-reset-personal-workspaces onClick={() => {
      setPassword(''); setConfirmation(''); setError(''); setPending(false); setLocalCleanupFailed(false); setRequestId(crypto.randomUUID()); setOpened(true);
    }}>{t('resetAll')}</Button>
    <Modal opened={opened} centered title={t('resetAll')} onClose={() => { if (!busy && !pending) { setPassword(''); setOpened(false); } }}
      closeOnClickOutside={!busy && !pending} closeOnEscape={!busy && !pending} withCloseButton={!busy && !pending}>
      {pending ? <Stack><Alert color="orange">{t(localCleanupFailed ? 'offlineCleanupFailed' : 'cleanupPending')}</Alert>
        <Button onClick={async () => {
          if (localCleanupFailed) { try { await clearOfflineData(); } catch { return; } }
          window.location.assign(appPath('/home'));
        }}>{t(localCleanupFailed ? 'retryLocalCleanup' : 'done')}</Button></Stack>
      : <form onSubmit={submit}><Stack>
        <Alert color="red">{t('resetDescription')}</Alert>
        <PasswordInput label={t('confirmPassword')} value={password} disabled={busy} autoComplete="current-password"
          visibilityToggleButtonProps={{ 'aria-label': t('togglePasswordVisibility') }}
          required data-autofocus onChange={event => setPassword(event.currentTarget.value)} />
        <TextInput label={t('confirmReset')} value={confirmation} disabled={busy} autoComplete="off" required
          onChange={event => setConfirmation(event.currentTarget.value)} />
        {error && <Alert color="red" role="alert">{error}</Alert>}
        <Group justify="flex-end"><Button variant="default" disabled={busy} onClick={() => { setPassword(''); setOpened(false); }}>{t('cancel')}</Button>
          <Button color="red" type="submit" loading={busy} disabled={!password.length || confirmation !== 'RESET'}>{t('resetAll')}</Button></Group>
      </Stack></form>}
    </Modal>
  </Stack>;
}
