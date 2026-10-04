"use client";

import { useState, useTransition, type FormEvent } from "react";
import { recordPaymentAction } from "@/actions/payments";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { errorProps, Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import { formatPhp, minorToInputString } from "@/lib/settlement/money";
import type { SettlementPerson } from "@/lib/settlements/types";

/**
 * "Record payment" on an outstanding card. Prefilled with the full
 * outstanding amount (D7) and editable for partial payments. The server
 * refuses an overpayment until "Save anyway" is pressed (D1).
 */
export function RecordPaymentButton(props: {
  tabId: string;
  debtor: SettlementPerson;
  creditor: SettlementPerson;
  outstandingCentavos: number;
}) {
  const { debtor, creditor } = props;
  const prefilled = minorToInputString(props.outstandingCentavos);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(prefilled);
  const [description, setDescription] = useState("");
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  const overpaying = failure?.code === "conflict";
  const id = `pay-${debtor.id}-${creditor.id}`;

  function openSheet() {
    setAmount(prefilled);
    setDescription("");
    setFailure(null);
    setOpen(true);
  }

  function save(allowOverpayment: boolean) {
    startTransition(async () => {
      const result = await recordPaymentAction({
        tabId: props.tabId,
        debtorId: debtor.id,
        creditorId: creditor.id,
        amountPhp: amount,
        description,
        allowOverpayment,
      });
      if (result.ok) {
        setOpen(false);
      } else {
        setFailure(result);
      }
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save(false);
  }

  const amountError = failure?.fieldErrors?.amountPhp;

  return (
    <>
      <button type="button" onClick={openSheet} className={`${buttonStyles.tinted} w-full`}>
        Record payment
      </button>
      <Sheet
        open={open}
        onRequestClose={() => setOpen(false)}
        title="Record payment"
        description={
          <>
            {debtor.displayName} pays {creditor.displayName}. Outstanding: {formatPhp(props.outstandingCentavos)}
          </>
        }
        footer={
          // Keyed so React never turns "Change amount" into the submit button mid-click.
          overpaying ? (
            <div key="overpay" className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setFailure(null)} className={buttonStyles.quiet} disabled={isPending}>
                Change amount
              </button>
              <button type="button" onClick={() => save(true)} className={buttonStyles.primary} disabled={isPending}>
                {isPending ? "Saving…" : "Save anyway"}
              </button>
            </div>
          ) : (
            <button key="save" type="submit" form={id} className={`${buttonStyles.primary} w-full`} disabled={isPending}>
              {isPending ? "Saving…" : `Save payment`}
            </button>
          )
        }
      >
        <form id={id} onSubmit={submit} noValidate className="space-y-4">
          <Field id={`${id}-amount`} label="Amount (₱)" error={amountError} hint="Change it for a partial payment.">
            <input
              {...errorProps(`${id}-amount`, amountError)}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setFailure(null);
              }}
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              maxLength={32}
              className={`${inputStyles} text-right tabular-nums`}
            />
          </Field>
          <Field id={`${id}-description`} label="Note (optional)" hint="Shown on the card, e.g. “GCash” or “Cash”.">
            <input
              id={`${id}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Payment"
              maxLength={200}
              autoComplete="off"
              className={inputStyles}
            />
          </Field>
          {failure && !amountError && <ActionMessage failure={failure} />}
          <p className="text-sm text-ink-secondary">
            Saved as its own transaction. The original expenses stay in the history.
          </p>
        </form>
      </Sheet>
    </>
  );
}
