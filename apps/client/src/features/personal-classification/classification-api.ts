import api from '@/lib/api-client';
export interface ClassificationRule {
  id: string; name: string; keywords: string[]; field: 'title' | 'content' | 'both'; enabled: boolean;
}
export interface ClassificationConfig { enabled: boolean; rules: ClassificationRule[]; revision: string | null; updatedAt: string | null; }
export interface ClassifiedPage { id: string; slugId: string; title: string; icon: string | null; spaceSlug: string; autoLabels: string[]; }
export interface ClassificationPages { enabled: boolean; items: ClassifiedPage[]; nextCursor: string | null; }
export function classificationApi<T>(workspaceId: string, route: string, body: unknown = {}): Promise<T> {
  return api.post<T>('/personal-classification/' + route, body, { headers: { 'x-nopetion-workspace-id': workspaceId } })
    .then(response => response.data);
}
