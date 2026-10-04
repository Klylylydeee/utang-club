"use client";

import { useState, useTransition, type FormEvent } from "react";
import { splitExpenseAction } from "@/actions/transactions";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { errorProps, Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import { formatPhp, parseMoneyToMinor } from "@/lib/settlement/money";
import { splitAmount } from "@/lib/settlement/splitAmount";
import type { PersonOption } from "./TransactionRowView";

/**
 * "Split a bill": one total, who paid, and who shared it (everyone ticked
 * by default, payer included). Creates one expense row per other person.
 * The preview uses the same pure splitAmount as the server, so what you
 * see is what gets saved. `people` must be in display-name order.
 */
export function SplitBillButton({ tabId, people }: { tabId: string; people: PersonOption[] }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(people.map((person) => person.id)));
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = description !== "" || amount !== "" || payerId !== "";
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function reset() {
    setDescription("");
    setAmount("");
    setPayerId("");
    setSelected(new Set(people.map((person) => person.id)));
    setFailure(null);
    setConfirmingDiscard(false);
  }

  function requestClose() {
    if (dirty && !isPending) setConfirmingDiscard(true);
    else setOpen(false);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    clearError("participantIds");
  }

  function clearError(field: string) {
    setFailure((current) =>
      current?.fieldErrors?.[field]
        ? { ...current, fieldErrors: Object.fromEntries(Object.entries(current.fieldErrors).filter(([key]) => key !== field)) }
        : current,
    );
  }

  const participantIds = people.filter((person) => selected.has(person.id)).map((person) => person.id);
  const names = new Map(people.map((person) => [person.id, person.displayName]));
  const total = parseMoneyToMinor(amount);
  const preview =
    total.ok && total.minor > 0 && payerId && participantIds.length > 0
      ? splitAmount(total.minor, participantIds, payerId)
      : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await splitExpenseAction({ tabId, description, amountPhp: amount, payerId, participantIds });
      if (result.ok) {
        setOpen(false);
        reset();
      } else {
        setFailure(result);
      }
    });
  }

  const errors = failure?.fieldErrors ?? {};
  const fieldsShown = ["description", "amountPhp", "payerId", "participantIds"];
  const otherError = failure && !Object.keys(errors).some((key) => fieldsShown.includes(key));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonStyles.secondary}>
        <span aria-hidden="true">÷</span> Split a bill
      </button>
      <Sheet
        open={open}
        onRequestClose={requestClose}
        title="Split a bill"
        description="One person paid; everyone ticked shares it equally."
        footer={
          confirmingDiscard ? (
            <div key="confirm-discard" className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Discard this split?">
              <span className="mr-auto text-sm">Discard this split?</span>
              <button type="button" onClick={() => setConfirmingDiscard(false)} className={buttonStyles.quiet}>
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  setOpen(false);
                }}
                className={buttonStyles.danger}
              >
                Discard
              </button>
            </div>
          ) : (
            <button key="save" type="submit" form="split-bill" className={`${buttonStyles.primary} w-full`} disabled={isPending}>
              {isPending
                ? "Saving…"
                : preview?.ok
                  ? `Add ${preview.debts.length} ${preview.debts.length === 1 ? "row" : "rows"}`
                  : "Split"}
            </button>
          )
        }
      >
        <form id="split-bill" onSubmit={submit} noValidate className="space-y-5">
          <Field id="split-description" label="What was it?" error={errors.description}>
            <input
              {...errorProps("split-description", errors.description)}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearError("description");
              }}
              placeholder="Dinner at Manam"
              maxLength={200}
              autoComplete="off"
              className={inputStyles}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="split-amount" label="Total (₱)" error={errors.amountPhp}>
              <input
                {...errorProps("split-amount", errors.amountPhp)}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  clearError("amountPhp");
                }}
                placeholder="0.00"
                inputMode="decimal"
                maxLength={32}
                autoComplete="off"
                className={`${inputStyles} text-right tabular-nums`}
              />
            </Field>
            <Field id="split-payer" label="Paid by" error={errors.payerId}>
              <select
                {...errorProps("split-payer", errors.payerId)}
                value={payerId}
                onChange={(event) => {
                  setPayerId(event.target.value);
                  clearError("payerId");
                }}
                className={`${inputStyles} ${payerId ? "" : "text-ink-secondary"}`}
              >
                <option value="">Who paid?</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset className="space-y-2" aria-describedby={errors.participantIds ? "split-people-error" : undefined}>
            <legend className="text-sm font-medium">Shared by</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((person) => {
                const on = selected.has(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(person.id)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 transition-colors ${
                      on ? "border-accent bg-accent-soft text-ink" : "border-separator text-ink-secondary"
                    }`}
                  >
                    <span aria-hidden="true" className="w-3">
                      {on ? "✓" : ""}
                    </span>
                    {person.displayName}
                  </button>
                );
              })}
            </div>
            {errors.participantIds && (
              <p id="split-people-error" className="text-sm text-negative">
                {errors.participantIds}
              </p>
            )}
          </fieldset>

          <SplitPreview preview={preview} payerName={names.get(payerId) ?? ""} names={names} />
          {otherError && <ActionMessage failure={failure} />}
        </form>
      </Sheet>
    </>
  );
}

function SplitPreview(props: {
  preview: ReturnType<typeof splitAmount> | null;
  payerName: string;
  names: ReadonlyMap<string, string>;
}) {
  const { preview } = props;
  if (!preview) {
    return <p className="text-sm text-ink-secondary">Enter a total and who paid to see each share.</p>;
  }
  if (!preview.ok) {
    return (
      <p className="text-sm text-negative">
        {preview.reason === "no-debtors"
          ? "Choose at least one person besides who paid."
          : "That amount is too small to split between these people."}
      </p>
    );
  }
  return (
    <div className="rounded-xl bg-surface p-4" aria-live="polite">
      <p className="mb-2 text-sm font-medium">This adds:</p>
      <ul className="space-y-1.5">
        {preview.debts.map((debt) => (
          <li key={debt.personId} className="flex justify-between gap-3 text-sm">
            <span>
              {props.names.get(debt.personId)} owes {props.payerName}
            </span>
            <span className="tabular-nums">{formatPhp(debt.amountPhpCentavos)}</span>
          </li>
        ))}
      </ul>
      {preview.payerShareCentavos !== null && (
        <p className="mt-2 border-t border-separator pt-2 text-sm text-ink-secondary">
          {props.payerName}’s own share: {formatPhp(preview.payerShareCentavos)} (no row needed)
        </p>
      )}
    </div>
  );
}
