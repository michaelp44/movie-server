import { describe, expect, it } from "vitest";

import { campaignGroupLabel, campaignGroupSelectionMatches, campaignGroupSelectionsLabel, campaignRecipientMatches, nextCampaignDelaySeconds, parseCampaignGroupSelection, parseCampaignGroupSelections } from "@/lib/rsvp/campaign-queue";

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

  it("parses multiple groups across both sides and matches any selected group", () => {
    const selections = ["group:shoval:%D7%9B%D7%93%D7%95%D7%A8%D7%A2%D7%A3", "group:michael:%D7%A2%D7%91%D7%95%D7%93%D7%94"];
    expect(parseCampaignGroupSelections(selections)).toEqual([
      { groupFilter: "כדורעף", sideFilter: "shoval" },
      { groupFilter: "עבודה", sideFilter: "michael" },
    ]);
    expect(campaignGroupSelectionMatches(selections, "כדורעף", "מוזמנים - שובל")).toBe(true);
    expect(campaignGroupSelectionMatches(selections, "עבודה", "מוזמנים - מיכאל")).toBe(true);
    expect(campaignGroupSelectionMatches(selections, "משפחה", "מוזמנים - מיכאל")).toBe(false);
    expect(campaignRecipientMatches("pending_rsvp", null, "pending", "עבודה", null, "מוזמנים - מיכאל", selections)).toBe(true);
    expect(campaignRecipientMatches("pending_rsvp", null, "confirmed", "עבודה", null, "מוזמנים - מיכאל", selections)).toBe(false);
  });

  it("requires choosing either all groups or one or more valid individual groups", () => {
    expect(parseCampaignGroupSelections(["all"])).toEqual([]);
    expect(parseCampaignGroupSelections(["all", "group:shoval:%D7%97%D7%91%D7%A8%D7%99%D7%9D"])).toBeNull();
    expect(parseCampaignGroupSelections([])).toBeNull();
    expect(parseCampaignGroupSelections(["group:shoval:%E0%A4%A"])).toBeNull();
    expect(campaignGroupSelectionsLabel(["group:shoval:%D7%97%D7%91%D7%A8%D7%99%D7%9D", "group:michael:%D7%A2%D7%91%D7%95%D7%93%D7%94"], null, null)).toContain("חברים");
  });
});
