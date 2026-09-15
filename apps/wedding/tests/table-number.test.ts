import { describe, expect, it } from "vitest";

import { parseTableNumber } from "@/lib/table";

describe("table number parsing", () => {
  it.each([
    ["1", "1"],
    ["014", "14"],
    ["999", "999"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(parseTableNumber(input)).toBe(expected);
  });

  it.each([undefined, null, "", "0", "-1", "1000", "14a", 14])(
    "rejects invalid table identifier %j",
    (input) => {
      expect(parseTableNumber(input)).toBeNull();
    },
  );
});
