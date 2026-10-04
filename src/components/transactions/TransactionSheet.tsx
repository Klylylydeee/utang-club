"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createTransactionAction,
  deleteTransactionAction,
  duplicateTransactionAction,
  updateTransactionAction,
} from "@/actions/transactions";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { errorProps, Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { buttonStyles, inputStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import { EMPTY_ROW, hasForeign, sameValues, toActionInput, type EditableField, type RowValues } from "./rowValues";
import type { PersonOption } from "./TransactionRowView";
import { validateRow } from "./validateRow";

export type SheetTarget =
  | { mode: "create" }
  /** `byline`: who added and changed the row, on shared tabs. */
  | { mode: "edit"; id: string; values: RowValues; byline?: string | null };

const SHOWN_FIELDS = new Set(["description", "amountPhp", "payerId", "recipientId", "type", "foreignCurrency", "foreignAmount"]);

/**
 * Phone editor for one transaction (UI_SPEC.md: "a transaction row may open
 * in a bottom sheet"). Same validation and actions as the table. Mounted
 * only while open, so each opening starts fresh. Closing with unsaved
 * changes asks first; a failed save keeps everything typed.
 */
export function TransactionSheet(props: {
  tabId: string;
  people: PersonOption[];
  target: SheetTarget | null;
  onClose: () => void;
  /** Called after a row is deleted, so the list can offer Undo. */
  onDeleted?: (id: string, description: string) => void;
}) {
  const { target } = props;
  if (!target) return null;
  return (
    <SheetForm
      key={target.mode === "edit" ? target.id : "create"}
      tabId={props.tabId}
      people={props.people}
      target={target}
      onClose={props.onClose}
      onDeleted={props.onDeleted}
    />
  );
}

function SheetForm(props: {
  tabId: string;
  people: PersonOption[];
  target: SheetTarget;
  onClose: () => void;
  onDeleted?: (id: string, description: string) => void;
}) {
  const { tabId, target } = props;
  const initial = target.mode === "edit" ? target.values : EMPTY_ROW;
  const [values, setValues] = useState<RowValues>(initial);
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const [showForeign, setShowForeign] = useState(hasForeign(initial));
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = !sameValues(values, initial);

  /** The close button, Escape and backdrop taps all land here. */
  function requestClose() {
    if (dirty && !isPending) setConfirm("discard");
    else props.onClose();
  }

  function set(field: EditableField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFailure((current) =>
      current?.fieldErrors?.[field]
        ? { ...current, fieldErrors: Object.fromEntries(Object.entries(current.fieldErrors).filter(([key]) => key !== field)) }
        : current,
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fieldErrors = validateRow(tabId, values);
    if (fieldErrors) {
      setFailure({ ok: false, code: "validation", error: "Please fix the highlighted fields.", fieldErrors });
      if (fieldErrors.foreignCurrency || fieldErrors.foreignAmount) setShowForeign(true);
      return;
    }
    startTransition(async () => {
      const input = toActionInput(tabId, values);
      const result =
        target.mode === "edit"
          ? await updateTransactionAction({ ...input, transactionId: target.id })
          : await createTransactionAction(input);
      if (result.ok) props.onClose();
      else setFailure(result);
    });
  }

  function run(action: () => Promise<{ ok: true } | ActionFailure>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        onSuccess?.();
        props.onClose();
      } else {
        setFailure(result);
        setConfirm(null);
      }
    });
  }

  const errors = failure?.fieldErrors ?? {};
  const otherError =
    failure && (failure.code !== "validation" || Object.keys(errors).some((key) => !SHOWN_FIELDS.has(key)));
  const id = (field: string) => `sheet-${field}`;

  // Each footer variant is keyed: without keys React would reuse a type="button" element as the
  // type="submit" one mid-click, and the browser would then submit the form (e.g. on "Keep editing").
  const footer =
    confirm === "discard" ? (
      <div key="confirm-discard" role="group" aria-label="Discard changes?" className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm">Discard your changes?</span>
        <button type="button" onClick={() => setConfirm(null)} className={buttonStyles.quiet}>
          Keep editing
        </button>
        <button type="button" onClick={props.onClose} className={buttonStyles.danger}>
          Discard
        </button>
      </div>
    ) : confirm === "delete" && target.mode === "edit" ? (
      <div key="confirm-delete" role="group" aria-label="Delete this transaction?" className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm">Delete this transaction?</span>
        <button type="button" onClick={() => setConfirm(null)} className={buttonStyles.quiet} disabled={isPending}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() =>
            run(
              () => deleteTransactionAction({ transactionId: target.id }),
              () => props.onDeleted?.(target.id, target.values.description),
            )
          }
          className={buttonStyles.danger}
          disabled={isPending}
        >
          {isPending ? "Deleting…" : "Delete"}
        </button>
      </div>
    ) : (
      <div key="actions" className="flex flex-wrap gap-2">
        {target.mode === "edit" && (
          <>
            <button type="button" onClick={() => setConfirm("delete")} className={buttonStyles.danger} disabled={isPending}>
              Delete
            </button>
            <button
              type="button"
              onClick={() => run(() => duplicateTransactionAction({ transactionId: target.id }))}
              className={buttonStyles.secondary}
              disabled={isPending || dirty}
            >
              Duplicate
            </button>
          </>
        )}
        <button
          type="submit"
          form="transaction-sheet"
          className={`${buttonStyles.primary} ml-auto min-w-28`}
          disabled={isPending || (target.mode === "edit" && !dirty)}
        >
          {isPending ? "Saving…" : target.mode === "edit" ? "Save" : "Add"}
        </button>
      </div>
    );

  return (
    <Sheet
      open
      onRequestClose={requestClose}
      title={target.mode === "edit" ? "Edit transaction" : "New transaction"}
      description={target.mode === "edit" ? (target.byline ?? undefined) : undefined}
      footer={footer}
    >
      <form id="transaction-sheet" onSubmit={submit} noValidate className="space-y-4">
        <Field id={id("description")} label="Description" error={errors.description}>
          <input
            {...errorProps(id("description"), errors.description)}
            value={values.description}
            onChange={(event) => set("description", event.target.value)}
            placeholder="Mineral Water"
            maxLength={200}
            autoComplete="off"
            className={inputStyles}
          />
        </Field>
        <Field id={id("amountPhp")} label="Amount (₱)" error={errors.amountPhp}>
          <input
            {...errorProps(id("amountPhp"), errors.amountPhp)}
            value={values.amountPhp}
            onChange={(event) => set("amountPhp", event.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            maxLength={32}
            autoComplete="off"
            className={`${inputStyles} text-right tabular-nums`}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <PersonSelect
            field="payerId"
            label="To pay"
            placeholder="Who owes?"
            value={values.payerId}
            error={errors.payerId}
            people={props.people}
            onChange={set}
          />
          <PersonSelect
            field="recipientId"
            label="To be paid"
            placeholder="Who’s owed?"
            value={values.recipientId}
            error={errors.recipientId}
            people={props.people}
            onChange={set}
          />
        </div>
        <Field id={id("type")} label="Type">
          <select
            id={id("type")}
            value={values.type}
            onChange={(event) => set("type", event.target.value)}
            className={inputStyles}
          >
            <option value="expense">Expense</option>
            <option value="payment">Payment</option>
          </select>
        </Field>

        {showForeign ? (
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Field id={id("foreignCurrency")} label="Currency" error={errors.foreignCurrency}>
              <input
                {...errorProps(id("foreignCurrency"), errors.foreignCurrency)}
                value={values.foreignCurrency}
                onChange={(event) => set("foreignCurrency", event.target.value)}
                placeholder="USD"
                maxLength={3}
                autoCapitalize="characters"
                autoComplete="off"
                className={`${inputStyles} uppercase placeholder:normal-case`}
              />
            </Field>
            <Field id={id("foreignAmount")} label="Foreign amount" error={errors.foreignAmount}>
              <input
                {...errorProps(id("foreignAmount"), errors.foreignAmount)}
                value={values.foreignAmount}
                onChange={(event) => set("foreignAmount", event.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                maxLength={32}
                autoComplete="off"
                className={`${inputStyles} text-right tabular-nums`}
              />
            </Field>
          </div>
        ) : (
          <button type="button" onClick={() => setShowForeign(true)} className={`${buttonStyles.quiet} -ml-4`}>
            + Foreign currency
          </button>
        )}

        {otherError && <ActionMessage failure={failure} />}
      </form>
    </Sheet>
  );
}

function PersonSelect(props: {
  field: "payerId" | "recipientId";
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  people: PersonOption[];
  onChange: (field: EditableField, value: string) => void;
}) {
  const id = `sheet-${props.field}`;
  return (
    <Field id={id} label={props.label} error={props.error}>
      <select
        {...errorProps(id, props.error)}
        value={props.value}
        onChange={(event) => props.onChange(props.field, event.target.value)}
        className={`${inputStyles} ${props.value ? "" : "text-ink-secondary"}`}
      >
        <option value="">{props.placeholder}</option>
        {props.people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.displayName}
          </option>
        ))}
      </select>
    </Field>
  );
}
