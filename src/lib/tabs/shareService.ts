import "server-only";
import mongoose, { Types } from "mongoose";
import { DomainError } from "@/lib/actions/result";
import type { Actor } from "@/lib/auth/actor";
import { connectToDatabase } from "@/lib/db/connect";
import { TabShare } from "@/models/TabShare";
import { User } from "@/models/User";
import type { LeaveTabInput, RemoveShareInput, ShareTabInput, UpdateShareInput } from "@/schemas/share";
import { loadOwnedTab, loadReadableTab } from "./tabService";
import type { TabShareView } from "./types";

/**
 * Sharing a tab with other accounts (D19). Only the owner manages shares
 * (loadOwnedTab); anyone a tab is shared with may leave it. Shares point
 * at user ids, so a renamed account keeps its access.
 */

export const MAX_SHARES_PER_TAB = 50;

const NO_ACCOUNT =
  "No account uses that email. Ask your friend to create one with that email, then share again.";

/** Who the tab is shared with, by name. Owner only. */
export async function listTabShares(tabId: string, actor: Actor): Promise<TabShareView[]> {
  await connectToDatabase();
  const tab = await loadOwnedTab(tabId, actor);
  const shares = await TabShare.find({ tabId: tab._id }).sort({ createdAt: 1 }).lean();
  const users = await User.find(
    { _id: mongoose.trusted({ $in: shares.map((share) => share.userId) }) },
    { name: 1, email: 1 },
  ).lean();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return shares.flatMap((share) => {
    const user = byId.get(share.userId.toString());
    if (!user) return [];
    const role = share.role === "editor" ? "editor" : "viewer";
    return [{ userId: user._id.toString(), name: user.name, email: user.email, role }];
  });
}

/** Shares the tab with an existing, active account. Returns who it was shared with. */
export async function shareTab(input: ShareTabInput, actor: Actor): Promise<TabShareView> {
  await connectToDatabase();
  const tab = await loadOwnedTab(input.tabId, actor);
  const user = await User.findOne({ email: input.email }, { name: 1, email: 1, status: 1 }).lean();
  // A disabled account can't sign in, so it gets the same answer as none at all.
  if (!user || user.status !== "active") throw new DomainError("not-found", NO_ACCOUNT, { email: NO_ACCOUNT });
  if (user._id.equals(actor.userId)) {
    const message = "That's your own account. You already have this tab.";
    throw new DomainError("conflict", message, { email: message });
  }
  if (await TabShare.exists({ tabId: tab._id, userId: user._id })) {
    const message = `This tab is already shared with ${user.name}. Change their access below.`;
    throw new DomainError("conflict", message, { email: message });
  }
  if ((await TabShare.countDocuments({ tabId: tab._id })) >= MAX_SHARES_PER_TAB) {
    throw new DomainError("conflict", `A tab can be shared with at most ${MAX_SHARES_PER_TAB} people.`);
  }
  try {
    await TabShare.create({ tabId: tab._id, userId: user._id, role: input.role });
  } catch (error) {
    // Two shares at once (E11000): the first one won.
    if ((error as { code?: unknown } | null)?.code === 11000) {
      throw new DomainError("conflict", `This tab is already shared with ${user.name}.`);
    }
    throw error;
  }
  return { userId: user._id.toString(), name: user.name, email: user.email, role: input.role };
}

/** Changes someone's access between view and edit. Owner only. */
export async function updateShare(input: UpdateShareInput, actor: Actor): Promise<void> {
  await connectToDatabase();
  const tab = await loadOwnedTab(input.tabId, actor);
  const result = await TabShare.updateOne(
    { tabId: tab._id, userId: new Types.ObjectId(input.userId) },
    { $set: { role: input.role } },
  );
  if (result.matchedCount === 0) throw new DomainError("not-found", "This tab isn't shared with them any more.");
}

/** Stops sharing the tab with someone. Owner only. */
export async function removeShare(input: RemoveShareInput, actor: Actor): Promise<void> {
  await connectToDatabase();
  const tab = await loadOwnedTab(input.tabId, actor);
  await TabShare.deleteOne({ tabId: tab._id, userId: new Types.ObjectId(input.userId) });
}

/** Someone a tab was shared with removes it from their own list. */
export async function leaveTab(input: LeaveTabInput, actor: Actor): Promise<void> {
  await connectToDatabase();
  const tab = await loadReadableTab(input.tabId, actor);
  const result = await TabShare.deleteOne({ tabId: tab._id, userId: new Types.ObjectId(actor.userId) });
  if (result.deletedCount === 0) throw new DomainError("conflict", "This tab isn't shared with you.");
}
