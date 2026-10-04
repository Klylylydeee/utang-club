"use server";

import { revalidatePath } from "next/cache";
import { authedAction } from "@/lib/auth/authedAction";
import { recordPayment } from "@/lib/payments/paymentService";
import { recordPaymentSchema } from "@/schemas/payment";

export const recordPaymentAction = authedAction(recordPaymentSchema, async (input) => {
  const row = await recordPayment(input);
  revalidatePath("/");
  revalidatePath(`/tabs/${input.tabId}`, "layout");
  return row;
});
