import { describe, expect, it } from "vitest";
import { findDemoInvitationByPhone } from "@/lib/guest-data/demo";
import { parseBooleanSetting, toInvitationDTO } from "@/lib/guest-data/mapper";
import { normalizeIsraeliPhone } from "@/lib/phone";

describe("invitation lookup and safe DTO", () => {
  it("finds a household through a normalized phone", () => {
    const normalized = normalizeIsraeliPhone("050-123-4567");
    const result = normalized ? findDemoInvitationByPhone(normalized) : null;
    expect(result?.invitation.display_name).toBe("דניאל ונועה");
  });

  it("never includes phone or secure token in the guest DTO", () => {
    const result = findDemoInvitationByPhone("+972501234567");
    const dto = toInvitationDTO(result!.invitation, true);
    expect(dto.tableNumber).toBe("14");
    expect(dto.guestNames).toEqual(["דניאל כהן", "נועה כהן"]);
    expect(dto).not.toHaveProperty("normalizedPhone");
    expect(dto).not.toHaveProperty("secureToken");
  });

  it("hides seating until the publication flag is enabled", () => {
    const result = findDemoInvitationByPhone("+972501234567");
    expect(toInvitationDTO(result!.invitation, false).tableNumber).toBeNull();
    expect(parseBooleanSetting({ enabled: true })).toBe(true);
    expect(parseBooleanSetting(false)).toBe(false);
  });
});
