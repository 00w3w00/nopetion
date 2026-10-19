import { BadRequestException } from '@nestjs/common';
import { sql, type RawBuilder, type SqlBool } from 'kysely';

export interface ClassificationRule {
  id: string;
  name: string;
  keywords: string[];
  field: 'title' | 'content' | 'both';
  enabled: boolean;
}

export const DEFAULT_CLASSIFICATION_RULES: ClassificationRule[] = [
  { id: 'work', name: '업무', keywords: ['업무', '프로젝트', '일정', '기획', 'project'], field: 'both', enabled: true },
  { id: 'meeting', name: '회의', keywords: ['회의', '회의록', '미팅', 'meeting'], field: 'both', enabled: true },
  { id: 'development', name: '개발', keywords: ['개발', '코드', '오류', '버그', 'API', '개발일지'], field: 'both', enabled: true },
  { id: 'study', name: '학습', keywords: ['학습', '공부', '강의', '독서', 'study'], field: 'both', enabled: true },
  { id: 'idea', name: '아이디어', keywords: ['아이디어', '브레인스토밍', '발상', 'idea'], field: 'both', enabled: true },
  { id: 'personal', name: '개인', keywords: ['일기', '여행', '건강', '가계부', '개인 기록'], field: 'both', enabled: true },
];

export function normalizeRules(value: unknown): ClassificationRule[] {
  if (!Array.isArray(value) || value.length > 20) throw new BadRequestException('Choose up to 20 classification rules');
  const ids = new Set<string>(), names = new Set<string>();
  return value.map(rule => {
    if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(rule.id) ||
        typeof rule.name !== 'string' || typeof rule.enabled !== 'boolean' ||
        !['title', 'content', 'both'].includes(rule.field) || !Array.isArray(rule.keywords) || rule.keywords.length > 10)
      throw new BadRequestException('Invalid classification rule');
    const name = rule.name.normalize('NFKC').trim();
    if (!name || name.length > 40 || name.includes('\0') || ['all', 'unclassified'].includes(rule.id) || ids.has(rule.id) || names.has(name.toLocaleLowerCase()))
      throw new BadRequestException('Classification names and IDs must be unique');
    const keywords = [...new Set<string>(rule.keywords.map((word: unknown) => {
      if (typeof word !== 'string') throw new BadRequestException('Invalid classification keyword');
      const normalized = word.normalize('NFKC').trim().toLowerCase();
      if (!normalized || normalized.length > 80 || normalized.includes('\0')) throw new BadRequestException('Choose keywords of 1 to 80 characters');
      return normalized;
    }))];
    if (!keywords.length) throw new BadRequestException('Each rule needs at least one keyword');
    ids.add(rule.id); names.add(name.toLocaleLowerCase());
    return { id: rule.id, name, keywords, field: rule.field, enabled: rule.enabled };
  });
}

export function ruleExpression(rule: ClassificationRule): RawBuilder<SqlBool> {
  const source = rule.field === 'title' ? sql`coalesce(pages.title, '')`
    : rule.field === 'content' ? sql`coalesce(pages.text_content, '')`
    : sql`concat_ws(' ', pages.title, pages.text_content)`;
  const normalized = sql`lower(normalize(${source}, NFKC))`;
  return sql<SqlBool>`(${sql.join(rule.keywords.map(word => sql`strpos(${normalized}, ${word}) > 0`), sql` or `)})`;
}

export function labelExpression(rules: ClassificationRule[]) {
  const expressions = rules.filter(rule => rule.enabled)
    .map(rule => sql`case when ${ruleExpression(rule)} then ${rule.name}::text else null end`);
  return expressions.length ? sql<string[]>`array_remove(array[${sql.join(expressions)}], null)` : sql<string[]>`array[]::text[]`;
}
