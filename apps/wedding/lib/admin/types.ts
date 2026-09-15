export interface AdminOverview {
  totalInvitations: number;
  totalInvited: number;
  confirmed: number;
  declined: number;
  pending: number;
  tablesAssigned: number;
  photos: number;
  guestbook: number;
  songs: number;
}

export interface AdminInvitation {
  id: string;
  displayName: string;
  primaryPhone: string | null;
  normalizedPhone: string | null;
  numberInvited: number;
  numberConfirmed: number;
  rsvpStatus: string;
  tableNumber: string | null;
  guestGroup: string | null;
  sourceRowId: string | null;
  missingFromSource: boolean;
  secureToken: string;
  updatedAt: string;
}

export interface AdminTable {
  id: string;
  tableNumber: string;
  name: string | null;
  capacity: number | null;
  invitations: Array<Pick<AdminInvitation, "id" | "displayName" | "numberInvited" | "numberConfirmed">>;
  assignedCount: number;
}

export interface AdminPhoto {
  id: string;
  displayName: string | null;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  approved: boolean;
  rejected: boolean;
  createdAt: string;
  previewUrl: string | null;
}

export interface AdminLiveWallItem {
  id: string;
  kind: "photo" | "blessing";
  displayName: string | null;
  message: string | null;
  previewUrl: string | null;
  status: "PENDING" | "APPROVED" | "NEEDS_REVIEW" | "BLOCKED";
  reason: string | null;
  confidence: number | null;
  hiddenAt: string | null;
  createdAt: string;
}
