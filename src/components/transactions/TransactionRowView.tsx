"use client";

import type { FocusEvent, InputHTMLAttributes, ReactNode } from "react";
import { cellInputStyles } from "@/components/ui/styles";
import type { EditableField, RowValues } from "./rowValues";

export type PersonOption = { id: string; displayName: string };

/** What the row's status cell says. Always text plus a glyph, never colour alone. */
export type RowStatusView = "idle" | "unsaved" | "saving" | "saved" | "error";

type Props = {
  rowKey: string;
  /** Used in accessible names, e.g. "row 3" or "new row". */
  rowLabel: string;
  values: RowValues;
  people: PersonOption[];
  showForeign: boolean;
  status: RowStatusView;
  fieldErrors?: Record<string, string>;
  /** A row that is being created can't be edited until the server answers. */
  locked?: boolean;
  isEntry?: boolean;
  onChange: (field: EditableField, value: string) => void;
  /** Called when focus leaves the row entirely (used for autosave). */
  onLeave?: () => void;
  actions: ReactNode;
  /** A full-width line under the row: errors, delete confirmation. */
  below?: ReactNode;
  columnCount: number;
};

export function TransactionRowView(props: Props) {
  const { rowKey, rowLabel, values, fieldErrors, locked = false } = props;

  function handleBlur(event: FocusEvent<HTMLTableRowElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    props.onLeave?.();
  }

  function errorFor(field: EditableField) {
    const message = fieldErrors?.[field];
    const id = `${rowKey}-${field}-error`;
    return {
      message,
      id,
      inputProps: {
        "aria-invalid": message ? true : undefined,
        "aria-describedby": message ? id : undefined,
      },
    };
  }

  function textCell(field: "description" | "foreignCurrency" | "foreignAmount" | "amountPhp", label: string, extra: InputHTMLAttributes<HTMLInputElement>) {
    const error = errorFor(field);
    return (
      <td className="px-1 py-1 align-top">
        <input
          data-col={field}
          value={values[field]}
          onChange={(event) => props.onChange(field, event.target.value)}
          readOnly={locked}
          aria-label={`${label}, ${rowLabel}`}
          autoComplete="off"
          className={cellInputStyles}
          {...error.inputProps}
          {...extra}
        />
        <FieldError id={error.id} message={error.message} />
      </td>
    );
  }

  function personCell(field: "payerId" | "recipientId", label: string, placeholder: string) {
    const error = errorFor(field);
    return (
      <td className="px-1 py-1 align-top">
        <select
          data-col={field}
          value={values[field]}
          onChange={(event) => props.onChange(field, event.target.value)}
          disabled={locked}
          aria-label={`${label}, ${rowLabel}`}
          className={`${cellInputStyles} ${values[field] ? "" : "text-ink-secondary"}`}
          {...error.inputProps}
        >
          <option value="">{placeholder}</option>
          {props.people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.displayName}
            </option>
          ))}
        </select>
        <FieldError id={error.id} message={error.message} />
      </td>
    );
  }

  return (
    <>
      <tr
        data-row-key={rowKey}
        data-entry={props.isEntry ? "" : undefined}
        onBlur={handleBlur}
        className={props.below ? "" : "border-b border-separator"}
      >
        {textCell("description", "Description", {
          placeholder: props.isEntry ? "Add a description…" : "Description",
          maxLength: 200,
          enterKeyHint: "next",
        })}
        {props.showForeign && (
          <>
            {textCell("foreignCurrency", "Foreign currency", {
              placeholder: "USD",
              maxLength: 3,
              autoCapitalize: "characters",
              className: `${cellInputStyles} uppercase placeholder:normal-case`,
            })}
            {textCell("foreignAmount", "Foreign amount", {
              placeholder: "0.00",
              inputMode: "decimal",
              maxLength: 32,
              className: `${cellInputStyles} text-right tabular-nums`,
            })}
          </>
        )}
        {textCell("amountPhp", "Amount in PHP", {
          placeholder: "0.00",
          inputMode: "decimal",
          maxLength: 32,
          className: `${cellInputStyles} text-right tabular-nums`,
        })}
        {personCell("payerId", "To pay", "Who owes?")}
        {personCell("recipientId", "To be paid", "Who’s owed?")}
        <td className="px-1 py-1 align-top">
          <select
            data-col="type"
            value={values.type}
            onChange={(event) => props.onChange("type", event.target.value)}
            disabled={locked}
            aria-label={`Type, ${rowLabel}`}
            className={cellInputStyles}
          >
            <option value="expense">Expense</option>
            <option value="payment">Payment</option>
          </select>
        </td>
        <td className="py-1 pr-1 pl-2 align-top">
          <div className="flex min-h-11 items-center justify-end gap-2">
            <StatusLabel status={props.status} />
            {props.actions}
          </div>
        </td>
      </tr>
      {props.below && (
        <tr className="border-b border-separator">
          <td colSpan={props.columnCount} className="px-3 pb-3">
            {props.below}
          </td>
        </tr>
      )}
    </>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="px-2.5 pt-1 pb-1 text-sm text-negative">
      {message}
    </p>
  );
}

const STATUS_TEXT: Record<Exclude<RowStatusView, "idle">, { glyph: string; text: string; className: string }> = {
  unsaved: { glyph: "•", text: "Unsaved", className: "text-ink-secondary" },
  saving: { glyph: "…", text: "Saving", className: "text-ink-secondary" },
  saved: { glyph: "✓", text: "Saved", className: "text-positive" },
  error: { glyph: "!", text: "Not saved", className: "font-medium text-negative" },
};

function StatusLabel({ status }: { status: RowStatusView }) {
  return (
    <span role="status" className="min-w-16 text-right text-sm whitespace-nowrap">
      {status !== "idle" && (
        <span className={STATUS_TEXT[status].className}>
          <span aria-hidden="true">{STATUS_TEXT[status].glyph} </span>
          {STATUS_TEXT[status].text}
        </span>
      )}
    </span>
  );
}
