import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { getAdminOverview } from "@/lib/admin/data";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), createAdminDataClient: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/admin/service-client", () => ({ createAdminDataClient: mocks.createAdminDataClient }));

describe("admin communication totals", () => {
  const requests: Array<{ url: URL; method?: string; prefer: string | null }> = [];
  let activityFails = false;

  beforeEach(() => {
    vi.clearAllMocks();
    requests.length = 0;
    activityFails = false;
    mocks.requireAdmin.mockResolvedValue({ email: "admin@example.com" });
    const db = createClient<Database>("https://example.supabase.co", "test-service-key", {
      auth: { persistSession: false },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          requests.push({ url, method: init?.method, prefer: new Headers(init?.headers).get("prefer") });
          const select = url.searchParams.get("select") ?? "";
          if (activityFails && select.includes("invitation_activity")) {
            return Response.json({ message: "Activity data unavailable" }, { status: 400 });
          }
          if (init?.method === "HEAD") {
            const count = select.includes("message_deliveries") ? 1597 : select.includes("invitation_activity") ? 1003 : 0;
            return new Response(null, { headers: { "content-range": `*/${count}` } });
          }
          return Response.json([
            { number_invited: 2, number_confirmed: 2, rsvp_status: "confirmed", table_number: null },
            { number_invited: 1, number_confirmed: 0, rsvp_status: "pending", table_number: null },
          ]);
        },
      },
    });
    mocks.createAdminDataClient.mockReturnValue(db);
  });

  it("uses exact parent-invitation counts, including totals above the API row limit", async () => {
    const overview = await getAdminOverview();
    expect(overview).toMatchObject({ totalInvitations: 2, totalInvited: 3, contactedInvitations: 1597, openedInvitations: 1003 });

    const sent = requests.find(({ url }) => url.searchParams.get("select")?.includes("message_deliveries"))!;
    expect(sent.url.pathname).toBe("/rest/v1/invitations");
    expect(sent.method).toBe("HEAD");
    expect(sent.prefer).toContain("count=exact");
    expect(sent.url.searchParams.get("select")).toContain("message_deliveries!inner(id)");
    expect(sent.url.searchParams.get("message_deliveries.status")).toBe("eq.sent");

    const opened = requests.find(({ url }) => url.searchParams.get("select")?.includes("invitation_activity"))!;
    expect(opened.url.pathname).toBe("/rest/v1/invitations");
    expect(opened.method).toBe("HEAD");
    expect(opened.prefer).toContain("count=exact");
    expect(opened.url.searchParams.get("select")).toContain("invitation_activity!inner(id)");
    expect(opened.url.searchParams.get("invitation_activity.event_type")).toBe("in.(link_opened,rsvp_page_viewed)");
  });

  it("does not report zero opens when the activity query fails", async () => {
    activityFails = true;
    await expect(getAdminOverview()).rejects.toThrow("Activity data unavailable");
  });

  it("requires an admin before accessing communication totals", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
    await expect(getAdminOverview()).rejects.toThrow("Unauthorized");
    expect(requests).toHaveLength(0);
  });
});
