export const AI_JOB_QUERY_PARAM = "aiJobId";

export function isAiJobId(value: unknown): value is string {
  return typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
}

export function aiJobIdFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(AI_JOB_QUERY_PARAM);
  return isAiJobId(value) ? value : null;
}
