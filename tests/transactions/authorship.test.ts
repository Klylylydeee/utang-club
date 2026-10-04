import { describe, expect, it } from "vitest";
import { describeAuthorship, shouldShowAuthorship } from "@/lib/transactions/authorship";

const you = { name: "Bea", isYou: true };
const dave = { name: "Dave", isYou: false };

describe("describeAuthorship", () => {
  it("names who added the row, and who changed it", () => {
    expect(describeAuthorship({ addedBy: dave, editedBy: null })).toBe("Added by Dave");
    expect(describeAuthorship({ addedBy: you, editedBy: null })).toBe("Added by you");
    expect(describeAuthorship({ addedBy: you, editedBy: dave })).toBe("Added by you, edited by Dave");
    expect(describeAuthorship({ addedBy: dave, editedBy: dave })).toBe("Added by Dave, edited by Dave");
  });

  it("handles rows from before authors were recorded", () => {
    expect(describeAuthorship({ addedBy: null, editedBy: null })).toBeNull();
    expect(describeAuthorship({ addedBy: null, editedBy: you })).toBe("Edited by you");
  });
});

describe("shouldShowAuthorship", () => {
  const mine = [{ addedBy: you, editedBy: null }];

  it("stays quiet on a tab only its owner uses", () => {
    expect(shouldShowAuthorship({ access: "owner", isShared: false }, mine)).toBe(false);
    expect(shouldShowAuthorship({ access: "owner", isShared: false }, [{ addedBy: null, editedBy: null }])).toBe(false);
  });

  it("shows names once more than one account is involved", () => {
    expect(shouldShowAuthorship({ access: "owner", isShared: true }, mine)).toBe(true);
    expect(shouldShowAuthorship({ access: "editor", isShared: true }, mine)).toBe(true);
    expect(shouldShowAuthorship({ access: "admin", isShared: false }, mine)).toBe(true);
    // Shared once, since unshared: the other person's rows still explain themselves.
    expect(shouldShowAuthorship({ access: "owner", isShared: false }, [{ addedBy: dave, editedBy: null }])).toBe(true);
    expect(shouldShowAuthorship({ access: "owner", isShared: false }, [{ addedBy: you, editedBy: dave }])).toBe(true);
  });
});
