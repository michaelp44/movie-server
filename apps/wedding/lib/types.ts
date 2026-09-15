export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export const RSVP_STATUSES = ["pending", "confirmed", "declined", "maybe"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export type SyncMode = "preview" | "apply";
export type SyncStatus = "running" | "completed" | "completed_with_errors" | "failed";
export type SyncItemAction =
  | "addition"
  | "update"
  | "unchanged"
  | "conflict"
  | "error"
  | "missing";

/** The only invitation fields that may cross the server/client boundary. */
export interface InvitationDTO {
  id: string;
  displayName: string;
  numberInvited: number;
  numberConfirmed: number;
  rsvpStatus: RsvpStatus;
  tableNumber: string | null;
  guestNames: string[];
}
export interface GuestSessionIdentity {
  invitationId: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export type UploadMediaKind = "image" | "video";

export interface ValidatedUpload {
  mimeType: string;
  size: number;
  extension: string;
  mediaKind: UploadMediaKind;
}
