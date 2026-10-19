import { queryClient } from "@/main";
import { getSpaces } from "@/features/space/services/space-service";
import { getGroups } from "@/features/group/services/group-service";
import { getWorkspaceMembers } from "@/features/workspace/services/workspace-service";
import { getShares } from "@/features/share/services/share-service";
export const prefetchWorkspaceMembers = () => queryClient.prefetchQuery({ queryKey: ["workspaceMembers", { limit: 100, query: "" }], queryFn: () => getWorkspaceMembers({ limit: 100, query: "" }) });
export const prefetchSpaces = () => queryClient.prefetchQuery({ queryKey: ["spaces", {}], queryFn: () => getSpaces({}) });
export const prefetchGroups = () => queryClient.prefetchQuery({ queryKey: ["groups", {}], queryFn: () => getGroups({}) });
export const prefetchShares = () => queryClient.prefetchQuery({ queryKey: ["share-list", {}], queryFn: () => getShares({}) });
