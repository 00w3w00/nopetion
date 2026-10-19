import { Badge, Group } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useAtomValue } from 'jotai';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { workspaceAtom } from '@/features/user/atoms/current-user-atom';
import { isPersonalMode } from '@/lib/config';
import { classificationApi } from './classification-api';

export function ClassificationTags({ pageId }: { pageId: string }) {
  const workspaceId = useAtomValue(workspaceAtom)?.id;
  const { t } = useTranslation('classification');
  const { data } = useQuery({
    queryKey: ['personal-classification', workspaceId, 'page', pageId],
    queryFn: () => classificationApi<{ enabled: boolean; labels: string[] }>(workspaceId, 'page', { pageId }),
    enabled: isPersonalMode() && !!workspaceId && !!pageId,
    staleTime: 0, refetchInterval: 15000, refetchOnWindowFocus: true,
  });
  if (!data?.enabled || !data.labels.length) return null;
  return <Group gap={6} mt={8} mb={12} aria-label={t('automaticLabels')} data-classification-tags>
    {data.labels.map(label => <Badge key={label} component={Link} to={'/classifications?label=' + encodeURIComponent(label)}
      variant="light" tt="none" style={{ cursor: 'pointer', maxWidth: '100%' }}>{t('automatic')}: {label}</Badge>)}
  </Group>;
}
