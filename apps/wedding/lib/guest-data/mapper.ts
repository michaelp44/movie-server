import type { InvitationDTO, RsvpStatus } from "@/lib/types";

export interface InvitationQueryGuest {
  first_name: string;
  last_name: string | null;
  guest_order: number;
}
export interface InvitationQueryRecord {
  id: string;
  display_name: string;
  number_invited: number;
  number_confirmed: number;
  rsvp_status: RsvpStatus;
  table_number: string | null;
  guests: InvitationQueryGuest[] | null;
}

export function toInvitationDTO(
  record: InvitationQueryRecord,
  seatingPublished: boolean,
): InvitationDTO {
  const guestNames = [...(record.guests ?? [])]
    .sort((left, right) => left.guest_order - right.guest_order)
    .map(({ first_name, last_name }) => [first_name, last_name].filter(Boolean).join(" ").trim())
    .filter(Boolean);

  return {
    id: record.id,
    displayName: record.display_name,
    numberInvited: record.number_invited,
    numberConfirmed: record.number_confirmed,
    rsvpStatus: record.rsvp_status,
    tableNumber: seatingPublished ? record.table_number : null,
    guestNames,
  };
}

export function parseBooleanSetting(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) {
    return (value as { enabled?: unknown }).enabled === true;
  }
  return fallback;
}
