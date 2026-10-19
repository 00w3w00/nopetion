import { appPath } from "@/lib/app-path";
const attachmentPrefix = "nopetion:attachment:";
const attachmentIdPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export function coverImageUrl(
  value: string | null | undefined,
  workspaceId: string,
) {
  if (!value?.startsWith(attachmentPrefix)) return undefined;
  const id = value.slice(attachmentPrefix.length);
  if (!attachmentIdPattern.test(id)) return undefined;
  return appPath(`/api/files/${id}/cover?workspaceId=${encodeURIComponent(workspaceId)}`);
}

export function isCoverImage(file: Pick<File, "name" | "type" | "size">) {
  return (
    file.size > 0 &&
    /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name) &&
    (!file.type || imageTypes.has(file.type))
  );
}
