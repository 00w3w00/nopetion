import { PERSONAL_DATABASE_VIEWS } from "@docmost/editor-ext";

export const DATABASE_SORTS = ["default", "name", "date", "value"] as const;
export const DATABASE_STATUSES = ["todo", "doing", "done"] as const;

export type DatabaseSort = (typeof DATABASE_SORTS)[number];
export type DatabaseStatus = (typeof DATABASE_STATUSES)[number];
export type DatabaseView = (typeof PERSONAL_DATABASE_VIEWS)[number];
export type DatabaseViewSetting = {
  status: DatabaseStatus | null;
  sort: DatabaseSort;
};
export type DatabaseViewSettings = Partial<
  Record<DatabaseView, DatabaseViewSetting>
>;

const defaultSetting: DatabaseViewSetting = { status: null, sort: "default" };

export function databaseViewSetting(
  settings: DatabaseViewSettings,
  view: DatabaseView,
): DatabaseViewSetting {
  return settings[view] ?? defaultSetting;
}

export function parseDatabaseViewSettings(value: unknown): DatabaseViewSettings {
  if (typeof value !== "string" || value.length > 20_000) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      PERSONAL_DATABASE_VIEWS.flatMap((view) => {
        const candidate = (parsed as Record<string, unknown>)[view];
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
          return [];
        }
        const { status, sort } = candidate as Record<string, unknown>;
        return [
          [
            view,
            {
              status: DATABASE_STATUSES.includes(status as DatabaseStatus)
                ? (status as DatabaseStatus)
                : null,
              sort: DATABASE_SORTS.includes(sort as DatabaseSort)
                ? (sort as DatabaseSort)
                : "default",
            },
          ],
        ];
      }),
    );
  } catch {
    return {};
  }
}

export function updateDatabaseViewSetting(
  settings: DatabaseViewSettings,
  view: DatabaseView,
  change: Partial<DatabaseViewSetting>,
): DatabaseViewSettings {
  return {
    ...settings,
    [view]: { ...databaseViewSetting(settings, view), ...change },
  };
}

export function serializeDatabaseViewSettings(
  settings: DatabaseViewSettings,
): string {
  return JSON.stringify(settings);
}
