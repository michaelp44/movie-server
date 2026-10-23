import { describe, expect, it } from "vitest";

import { campaignGroupLabel, campaignRecipientMatches, nextCampaignDelaySeconds, parseCampaignGroupSelection } from "@/lib/rsvp/campaign-queue";

describe("campaign queue pacing", () => {
  it("keeps randomized delays inside the configured inclusive range", () => {
    expect(nextCampaignDelaySeconds(55, 110, 0)).toBe(55);
    expect(nextCampaignDelaySeconds(55, 110, 0.999999)).toBe(110);
  });

  it("never allows a delay shorter than thirty seconds", () => {
    expect(nextCampaignDelaySeconds(1, 2, 0)).toBe(30);
  });

  it("filters a campaign by both RSVP status and guest group", () => {
    expect(campaignRecipientMatches("pending_rsvp", "חברים של שובל", "pending", "חברים של שובל")).toBe(true);
    expect(campaignRecipientMatches("pending_rsvp", "חברים של שובל", "confirmed", "חברים של שובל")).toBe(false);
    expect(campaignRecipientMatches("pending_rsvp", "חברים של שובל", "pending", "חברים של מיכאל")).toBe(false);
  });

  it("supports uncategorized guests and skips campaigns after a guest changes category", () => {
    expect(campaignRecipientMatches("all_contactable", "", "confirmed", null)).toBe(true);
    expect(campaignRecipientMatches("all_contactable", "", "pending", "חברים")).toBe(false);
    expect(campaignRecipientMatches("all_contactable", "חברים", "pending", "עבודה")).toBe(false);
  });

  it("keeps identically named groups separate by source side", () => {
    expect(campaignRecipientMatches("all_contactable", "חברים", "pending", "חברים", "michael", "מוזמנים - מיכאל")).toBe(true);
    expect(campaignRecipientMatches("all_contactable", "חברים", "pending", "חברים", "michael", "מוזמנים - שובל")).toBe(false);
    expect(campaignRecipientMatches("all_contactable", "חברים", "pending", "חברים", "shoval", "מוזמנים - שובל")).toBe(true);
  });

  it("parses the visible campaign group and side choices", () => {
    expect(parseCampaignGroupSelection("group:shoval:%D7%97%D7%91%D7%A8%D7%99%D7%9D")).toEqual({ groupFilter: "חברים", sideFilter: "shoval" });
    expect(parseCampaignGroupSelection("uncategorized:michael")).toEqual({ groupFilter: "", sideFilter: "michael" });
    expect(parseCampaignGroupSelection("all")).toEqual({ groupFilter: null, sideFilter: null });
    expect(parseCampaignGroupSelection("group:shoval:%E0%A4%A")).toBeNull();
  });

  it("labels campaign groups with their side", () => {
    expect(campaignGroupLabel("חברים", "michael")).toBe("חברים · הצד של מיכאל");
    expect(campaignGroupLabel("חברים", "shoval")).toBe("חברים · הצד של שובל");
    expect(campaignGroupLabel("חברים")).toBe("חברים · כל הצדדים");
  });
});
