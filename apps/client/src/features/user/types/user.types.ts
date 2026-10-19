import { IWorkspace } from "@/features/workspace/types/workspace.types";
import type { AppFont } from "../app-fonts";

export interface IUser {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date;
  avatarUrl: string;
  timezone: string;
  settings: IUserSettings;
  invitedById: string;
  lastLoginAt: string;
  lastActiveAt: Date;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  workspaceId: string;
  deactivatedAt: Date;
  deletedAt: Date;
  fullPageWidth: boolean; // used for update
  pageEditMode: string; // used for update
  editorToolbar: boolean; // used for update
  appFont?: AppFont;
  documentFont?: "sans" | "serif" | "mono";
  smallText?: boolean;
  notificationPageUpdates: boolean; // used for update
  notificationPageUserMention: boolean; // used for update
  notificationCommentUserMention: boolean; // used for update
  notificationCommentCreated: boolean; // used for update
  notificationCommentResolved: boolean; // used for update
  hasGeneratedPassword?: boolean;
}

export interface ICurrentUser {
  accountId?: string;
  user: IUser;
  workspace: IWorkspace;
}

export interface IUserSettings {
  preferences: {
    fullPageWidth: boolean;
    pageEditMode: string;
    editorToolbar: boolean;
    appFont?: AppFont;
    documentFont?: "sans" | "serif" | "mono";
    smallText?: boolean;
  };
  notifications?: {
    "page.updated"?: boolean;
    "page.userMention"?: boolean;
    "comment.userMention"?: boolean;
    "comment.created"?: boolean;
    "comment.resolved"?: boolean;
  };
}

export enum PageEditMode {
  Read = "read",
  Edit = "edit",
}
