import type { InvitationQueryRecord } from "@/lib/guest-data/mapper";

interface DemoInvitation {
  normalizedPhone: string;
  secureToken: string;
  invitation: InvitationQueryRecord;
}

// Loaded only when WEDDING_DEMO_MODE=true outside production. Production data
// must always come from Supabase.
export const demoInvitations: readonly DemoInvitation[] = [
  {
    normalizedPhone: "+972501234567",
    secureToken: "demo_daniel_noa_7Yq4q7nTm3wKz9WmJ2A8M2fL",
    invitation: {
      id: "10000000-0000-4000-8000-000000000001",
      display_name: "דניאל ונועה",
      number_invited: 2,
      number_confirmed: 2,
      rsvp_status: "confirmed",
      table_number: "14",
      guests: [
        { first_name: "דניאל", last_name: "כהן", guest_order: 0 },
        { first_name: "נועה", last_name: "כהן", guest_order: 1 },
      ],
    },
  },
  {
    normalizedPhone: "+972521112233",
    secureToken: "demo_cohen_family_H8zP5bK3mN6yT2qR9vX4dS1c",
    invitation: {
      id: "10000000-0000-4000-8000-000000000002",
      display_name: "משפחת כהן",
      number_invited: 4,
      number_confirmed: 4,
      rsvp_status: "confirmed",
      table_number: "8",
      guests: [
        { first_name: "יעל", last_name: "כהן", guest_order: 0 },
        { first_name: "אורי", last_name: "כהן", guest_order: 1 },
        { first_name: "גילי", last_name: "כהן", guest_order: 2 },
        { first_name: "רוני", last_name: "כהן", guest_order: 3 },
      ],
    },
  },
  {
    normalizedPhone: "+972549876543",
    secureToken: "demo_maya_4qH8yW3nA7mC5vT9kL2pR6xS_safe",
    invitation: {
      id: "10000000-0000-4000-8000-000000000003",
      display_name: "מאיה",
      number_invited: 1,
      number_confirmed: 0,
      rsvp_status: "pending",
      table_number: null,
      guests: [{ first_name: "מאיה", last_name: "לוי", guest_order: 0 }],
    },
  },
];

export function findDemoInvitationByPhone(phone: string): DemoInvitation | null {
  return demoInvitations.find((item) => item.normalizedPhone === phone) ?? null;
}

export function findDemoInvitationById(id: string): DemoInvitation | null {
  return demoInvitations.find((item) => item.invitation.id === id) ?? null;
}

export function findDemoInvitationByToken(token: string): DemoInvitation | null {
  return demoInvitations.find((item) => item.secureToken === token) ?? null;
}
