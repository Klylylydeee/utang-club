"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LOGIN_PATH } from "@/lib/auth/constants";
import { authedAction } from "@/lib/auth/authedAction";
import { endSession } from "@/lib/auth/session";

const noInput = z.undefined();

export const signOut = authedAction(noInput, async () => {
  await endSession();
  redirect(LOGIN_PATH);
});
