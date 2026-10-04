import { describe, expect, it } from "vitest";
import { normalizePersonName, personInputSchema } from "@/schemas/person";

describe("normalizePersonName", () => {
  it("ignores case and surrounding/inner whitespace", () => {
    expect(normalizePersonName("  ADRIAN ")).toBe("adrian");
    expect(normalizePersonName("Mary   Ann")).toBe(normalizePersonName("mary ann"));
  });

  it("keeps accented names distinct", () => {
    expect(normalizePersonName("Adrián")).not.toBe(normalizePersonName("Adrian"));
  });
});

describe("personInputSchema", () => {
  it("trims the display name", () => {
    const parsed = personInputSchema.parse({ tabId: "65a0000000000000000000ff", displayName: "  Klyde " });
    expect(parsed.displayName).toBe("Klyde");
  });

  it("rejects blank and overly long names", () => {
    const tabId = "65a0000000000000000000ff";
    expect(personInputSchema.safeParse({ tabId, displayName: " " }).success).toBe(false);
    expect(personInputSchema.safeParse({ tabId, displayName: "x".repeat(61) }).success).toBe(false);
  });
});
