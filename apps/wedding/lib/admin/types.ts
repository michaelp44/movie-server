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
  normalizedPhone: string;
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
