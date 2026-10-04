"use client";

import {
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  createTransactionAction,
  deleteTransactionAction,
  duplicateTransactionAction,
  updateTransactionAction,
} from "@/actions/transactions";
import { ActionMessage } from "@/components/ui/ActionMessage";
import { buttonStyles, iconButtonStyles } from "@/components/ui/styles";
import type { ActionFailure } from "@/lib/actions/result";
import type { TransactionRow } from "@/lib/transactions/types";
import {
  EMPTY_ROW,
  hasForeign,
  isBlank,
  parseStoredValues,
  sameValues,
  toActionInput,
  toRowValues,
  type EditableField,
  type RowValues,
} from "./rowValues";
import { TransactionRowView, type PersonOption, type RowStatusView } from "./TransactionRowView";
import { validateRow } from "./validateRow";

/**
 * The spreadsheet. Database rows come in as props and stay authoritative;
 * this component layers on top of them:
 *   - drafts: what the user has typed into a saved row but not yet saved;
 *   - new rows: the entry row at the bottom, plus any that failed to save;
 *   - optimistic changes while a save is in flight (React's useOptimistic),
 *     which disappear on their own if the save fails, so a failed delete
 *     visibly puts the row back.
 * Typed values are never thrown away by a failure: they stay in the row,
 * marked "Not saved", and are mirrored to sessionStorage until saved.
 */

type SaveState = { kind: "saving" } | { kind: "saved" } | { kind: "error"; failure: ActionFailure };
type DisplayRow = { key: string; id: string | null; values: RowValues };
type NewRow = { key: string; values: RowValues; failure: ActionFailure | null };
type OptimisticChange =
  | { kind: "add"; row: DisplayRow }
  | { kind: "update"; id: string; values: RowValues }
  | { kind: "remove"; id: string };

const NAV_COLUMNS: readonly string[] = ["description", "foreignCurrency", "foreignAmount", "amountPhp"];

function applyChange(rows: DisplayRow[], change: OptimisticChange): DisplayRow[] {
  switch (change.kind) {
    case "add":
      return [...rows, change.row];
    case "update":
      return rows.map((row) => (row.id === change.id ? { ...row, values: change.values } : row));
    case "remove":
      return rows.filter((row) => row.id !== change.id);
  }
}

function focusCellIn(table: HTMLTableElement | null, rowKey: string, col: string) {
  const row = table?.querySelector<HTMLTableRowElement>(`tr[data-row-key="${CSS.escape(rowKey)}"]`);
  row?.querySelector<HTMLElement>(`[data-col="${col}"]`)?.focus();
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function validationFailure(fieldErrors: Record<string, string>): ActionFailure {
  return { ok: false, code: "validation", error: "Please fix the highlighted fields.", fieldErrors };
}

const VISIBLE_FIELDS = new Set(["description", "foreignCurrency", "foreignAmount", "amountPhp", "payerId", "recipientId", "type"]);

/** Field errors show next to their field; the row message is for everything else. */
function needsRowMessage(failure: ActionFailure): boolean {
  if (failure.code !== "validation" || !failure.fieldErrors) return true;
  return Object.keys(failure.fieldErrors).some((field) => !VISIBLE_FIELDS.has(field));
}

export function TransactionTable(props: {
  tabId: string;
  people: PersonOption[];
  rows: TransactionRow[];
  /** Extra toolbar buttons, e.g. "Split a bill". */
  actions?: ReactNode;
}) {
  const { tabId, people } = props;
  const storageKey = `utang-club:unsaved:${tabId}`;

  const savedRows = useMemo<DisplayRow[]>(
    () => props.rows.map((row) => ({ key: row.id, id: row.id, values: toRowValues(row) })),
    [props.rows],
  );
  const [displayRows, applyOptimistic] = useOptimistic(savedRows, applyChange);
  const [drafts, setDrafts] = useState<Record<string, RowValues>>({});
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [newRows, setNewRows] = useState<NewRow[]>([{ key: "new-0", values: EMPTY_ROW, failure: null }]);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [foreignToggled, setForeignToggled] = useState(false);
  const [, startTransition] = useTransition();

  const nextKey = useRef(1);
  const pendingFocus = useRef<{ rowKey: string; col: string } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const restored = useRef(false);
  /** Rows with a save on the wire; guards against double submits before state re-renders. */
  const inFlight = useRef(new Set<string>());

  const entryRow = newRows[newRows.length - 1];
  const failedRows = newRows.slice(0, -1);

  // Foreign columns stay hidden until asked for, or until any row uses them.
  const foreignInUse =
    displayRows.some((row) => hasForeign(drafts[row.key] ?? row.values)) || newRows.some((row) => hasForeign(row.values));
  const showForeign = foreignToggled || foreignInUse;
  const columnCount = showForeign ? 8 : 6;

  const hasUnsaved =
    Object.keys(drafts).length > 0 ||
    newRows.some((row) => !isBlank(row.values)) ||
    Object.values(saveStates).some((state) => state.kind === "saving");

  // --- Persistence: unsaved input survives reloads, navigation and sign-in. ---

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    let stored: unknown;
    try {
      stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    } catch {
      return;
    }
    if (typeof stored !== "object" || stored === null) return;
    const { drafts: storedDrafts, newRows: storedNew } = stored as { drafts?: unknown; newRows?: unknown };

    const restoredDrafts: Record<string, RowValues> = {};
    if (typeof storedDrafts === "object" && storedDrafts !== null) {
      for (const [id, value] of Object.entries(storedDrafts)) {
        const values = parseStoredValues(value);
        const saved = savedRows.find((row) => row.id === id);
        if (values && saved && !sameValues(values, saved.values)) restoredDrafts[id] = values;
      }
    }
    const restoredNew = (Array.isArray(storedNew) ? storedNew : [])
      .map(parseStoredValues)
      .filter((values): values is RowValues => values !== null && !isBlank(values));

    if (Object.keys(restoredDrafts).length === 0 && restoredNew.length === 0) return;
    // Restoring from browser storage after hydration is the external-sync case effects exist for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts(restoredDrafts);
    setNewRows([
      ...restoredNew.map((values) => ({ key: `new-${nextKey.current++}`, values, failure: null })),
      { key: `new-${nextKey.current++}`, values: EMPTY_ROW, failure: null },
    ]);
  }, [savedRows, storageKey]);

  useEffect(() => {
    if (!restored.current) return;
    const unsavedNew = newRows.filter((row) => !isBlank(row.values)).map((row) => row.values);
    try {
      if (Object.keys(drafts).length === 0 && unsavedNew.length === 0) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, JSON.stringify({ drafts, newRows: unsavedNew }));
    } catch {
      // Storage can be unavailable (private mode, quota). The beforeunload guard still warns.
    }
  }, [drafts, newRows, storageKey]);

  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    focusCellIn(tableRef.current, target.rowKey, target.col);
  });

  // --- Saved rows: edit, save, delete, duplicate. ---

  function setSaveState(key: string, state: SaveState | null) {
    setSaveStates((states) => (state ? { ...states, [key]: state } : without(states, key)));
  }

  function editSaved(row: DisplayRow, field: EditableField, value: string) {
    setDrafts((current) => {
      const values = { ...(current[row.key] ?? row.values), [field]: value };
      return sameValues(values, row.values) ? without(current, row.key) : { ...current, [row.key]: values };
    });
    clearFieldError(row.key, field);
  }

  function clearFieldError(key: string, field: EditableField) {
    setSaveStates((states) => {
      const state = states[key];
      if (state?.kind !== "error" || !state.failure.fieldErrors?.[field]) return states;
      const fieldErrors = without(state.failure.fieldErrors, field);
      return { ...states, [key]: { kind: "error", failure: { ...state.failure, fieldErrors } } };
    });
  }

  function saveRow(row: DisplayRow) {
    const id = row.id;
    const values = drafts[row.key];
    if (!id || !values || inFlight.current.has(row.key)) return;

    const fieldErrors = validateRow(tabId, values);
    if (fieldErrors) {
      setSaveState(row.key, { kind: "error", failure: validationFailure(fieldErrors) });
      return;
    }

    inFlight.current.add(row.key);
    setSaveState(row.key, { kind: "saving" });
    startTransition(async () => {
      applyOptimistic({ kind: "update", id, values });
      const result = await updateTransactionAction({ transactionId: id, ...toActionInput(tabId, values) });
      inFlight.current.delete(row.key);
      if (result.ok) {
        // Keep anything typed while the save was in flight.
        setDrafts((current) => (current[row.key] === values ? without(current, row.key) : current));
        setSaveState(row.key, { kind: "saved" });
      } else {
        setSaveState(row.key, { kind: "error", failure: result });
      }
    });
  }

  function revertRow(key: string) {
    setDrafts((current) => without(current, key));
    setSaveState(key, null);
  }

  function deleteRow(row: DisplayRow) {
    const id = row.id;
    if (!id) return;
    setConfirmingDelete(null);
    setSaveState(row.key, null);
    startTransition(async () => {
      applyOptimistic({ kind: "remove", id });
      const result = await deleteTransactionAction({ transactionId: id });
      if (result.ok) {
        setDrafts((current) => without(current, row.key));
      } else {
        // The optimistic removal ends with the transition, so the row reappears with this message.
        setSaveState(row.key, { kind: "error", failure: { ...result, error: `Not deleted. ${result.error}` } });
      }
    });
  }

  function duplicateRow(row: DisplayRow) {
    const id = row.id;
    if (!id) return;
    startTransition(async () => {
      applyOptimistic({ kind: "add", row: { key: `copy-${nextKey.current++}`, id: null, values: row.values } });
      const result = await duplicateTransactionAction({ transactionId: id });
      if (!result.ok) {
        setSaveState(row.key, { kind: "error", failure: { ...result, error: `Not duplicated. ${result.error}` } });
      }
    });
  }

  // --- New rows: the entry row and any that failed to save. ---

  function editNew(key: string, field: EditableField, value: string) {
    setNewRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) return row;
        const values = { ...row.values, [field]: value };
        const failure =
          row.failure?.fieldErrors?.[field] !== undefined
            ? { ...row.failure, fieldErrors: without(row.failure.fieldErrors, field) }
            : row.failure;
        return { ...row, values, failure };
      }),
    );
  }

  function submitNew(row: NewRow) {
    if (isBlank(row.values)) return;
    const isEntry = row.key === entryRow.key;

    const fieldErrors = validateRow(tabId, row.values);
    if (fieldErrors) {
      setNewRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, failure: validationFailure(fieldErrors) } : r)));
      const firstField = ["description", "foreignCurrency", "foreignAmount", "amountPhp", "payerId", "recipientId"].find(
        (field) => fieldErrors[field],
      );
      if (firstField) focusCell(row.key, firstField);
      return;
    }

    // Move the row into the table as "Saving…" and open a fresh entry row right away.
    const values = row.values;
    const freshKey = `new-${nextKey.current++}`;
    setNewRows((rows) => {
      const rest = rows.filter((r) => r.key !== row.key);
      return isEntry ? [...rest, { key: freshKey, values: EMPTY_ROW, failure: null }] : rest;
    });
    if (isEntry) pendingFocus.current = { rowKey: freshKey, col: "description" };

    startTransition(async () => {
      applyOptimistic({ kind: "add", row: { key: row.key, id: null, values } });
      const result = await createTransactionAction(toActionInput(tabId, values));
      if (!result.ok) {
        // Back above the entry row, with everything that was typed.
        setNewRows((rows) => [...rows.slice(0, -1), { key: row.key, values, failure: result }, rows[rows.length - 1]]);
      }
    });
  }

  function discardNew(key: string) {
    setNewRows((rows) => rows.filter((row) => row.key !== key));
  }

  // --- Keyboard: Enter saves and moves down, arrows move between rows. ---

  function focusCell(rowKey: string, col: string) {
    focusCellIn(tableRef.current, rowKey, col);
  }

  function moveFocus(rowKey: string, col: string, step: 1 | -1) {
    const rows = tableRef.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row-key]") ?? [];
    const keys = Array.from(rows, (row) => row.dataset.rowKey ?? "");
    const next = keys[keys.indexOf(rowKey) + step];
    if (next) focusCell(next, col);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableSectionElement>) {
    const target = event.target as HTMLElement;
    const col = target.dataset.col;
    const rowKey = target.closest<HTMLTableRowElement>("tr[data-row-key]")?.dataset.rowKey;
    if (!col || !rowKey || event.nativeEvent.isComposing) return;
    const isTextInput = target instanceof HTMLInputElement;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const newRow = newRows.find((row) => row.key === rowKey);
      if (newRow) {
        submitNew(newRow);
        return;
      }
      // Leaving the row saves it (onLeave); there is always an entry row below to move to.
      moveFocus(rowKey, col, 1);
    } else if (isTextInput && (event.key === "ArrowDown" || event.key === "ArrowUp") && NAV_COLUMNS.includes(col)) {
      event.preventDefault();
      moveFocus(rowKey, col, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Escape" && drafts[rowKey]) {
      event.preventDefault();
      revertRow(rowKey);
    }
  }

  // --- Rendering ---

  function savedRowStatus(row: DisplayRow): RowStatusView {
    if (!row.id) return "saving";
    const state = saveStates[row.key];
    if (state?.kind === "saving" || state?.kind === "error") return state.kind;
    if (drafts[row.key]) return "unsaved";
    return state?.kind === "saved" ? "saved" : "idle";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">
          Press <kbd className="font-sans font-medium">Enter</kbd> to add a row. Edits save when you leave a row.
        </p>
        <div className="flex flex-wrap gap-2">
          {props.actions}
          {!foreignInUse && (
            <button type="button" onClick={() => setForeignToggled((on) => !on)} className={buttonStyles.quiet}>
              {foreignToggled ? "Hide foreign currency" : "Add foreign currency"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              focusCell(entryRow.key, "description");
              tableRef.current?.querySelector("tr[data-entry]")?.scrollIntoView({ block: "nearest" });
            }}
            className={buttonStyles.secondary}
          >
            <span aria-hidden="true">+</span> New row
          </button>
        </div>
      </div>

      <div className="relative overflow-x-auto overscroll-x-contain rounded-2xl border border-separator bg-raised shadow-raised">
        <table ref={tableRef} className={`w-full border-collapse text-left ${showForeign ? "min-w-[1108px]" : "min-w-[900px]"}`}>
          <caption className="sr-only">Transactions. Each row says who owes whom and how much.</caption>
          {/* Fixed columns total 708px (+208 with foreign); Description takes the rest, at least ~190px.
              Both layouts fit the max-w-6xl page on a laptop; narrower screens scroll inside the card. */}
          <colgroup>
            <col />
            {showForeign && (
              <>
                <col className="w-20" />
                <col className="w-32" />
              </>
            )}
            <col className="w-32" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-28" />
            <col className="w-[180px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-separator text-sm text-ink-secondary">
              <th scope="col" className="px-3 py-3 whitespace-nowrap font-medium">Description</th>
              {showForeign && (
                <>
                  <th scope="col" className="px-3 py-3 whitespace-nowrap font-medium">Currency</th>
                  <th scope="col" className="px-3 py-3 whitespace-nowrap text-right font-medium">Foreign amount</th>
                </>
              )}
              <th scope="col" className="px-3 py-3 whitespace-nowrap text-right font-medium">Amount (₱)</th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap font-medium">To pay</th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap font-medium">To be paid</th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap font-medium">Type</th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap text-right font-medium">
                <span className="sr-only">Status and actions</span>
              </th>
            </tr>
          </thead>
          <tbody onKeyDown={handleKeyDown}>
            {displayRows.map((row, index) => {
              const state = saveStates[row.key];
              const failure = state?.kind === "error" ? state.failure : null;
              const confirming = confirmingDelete === row.key && row.id !== null;
              const description = (drafts[row.key] ?? row.values).description || `row ${index + 1}`;
              return (
                <TransactionRowView
                  key={row.key}
                  rowKey={row.key}
                  rowLabel={`row ${index + 1}`}
                  values={drafts[row.key] ?? row.values}
                  people={people}
                  showForeign={showForeign}
                  columnCount={columnCount}
                  status={savedRowStatus(row)}
                  fieldErrors={failure?.fieldErrors}
                  locked={row.id === null}
                  onChange={(field, value) => editSaved(row, field, value)}
                  onLeave={() => saveRow(row)}
                  actions={
                    row.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => duplicateRow(row)}
                          className={iconButtonStyles}
                          aria-label={`Duplicate ${description}`}
                          title="Duplicate"
                        >
                          <CopyIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(row.key)}
                          className={iconButtonStyles}
                          aria-label={`Delete ${description}`}
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </>
                    )
                  }
                  below={
                    confirming ? (
                      <div role="group" aria-label={`Confirm deleting ${description}`} className="flex flex-wrap items-center justify-end gap-2">
                        <span className="mr-auto text-sm">
                          Delete “{description}”? Its settlement will be recalculated.
                        </span>
                        <button type="button" onClick={() => deleteRow(row)} className={buttonStyles.danger} autoFocus>
                          Delete
                        </button>
                        <button type="button" onClick={() => setConfirmingDelete(null)} className={buttonStyles.quiet}>
                          Cancel
                        </button>
                      </div>
                    ) : failure && needsRowMessage(failure) ? (
                      <RowFailure failure={failure} onRevert={drafts[row.key] ? () => revertRow(row.key) : undefined} />
                    ) : undefined
                  }
                />
              );
            })}

            {failedRows.map((row) => (
              <TransactionRowView
                key={row.key}
                rowKey={row.key}
                rowLabel="unsaved row"
                values={row.values}
                people={people}
                showForeign={showForeign}
                columnCount={columnCount}
                status={row.failure ? "error" : "unsaved"}
                fieldErrors={row.failure?.fieldErrors}
                onChange={(field, value) => editNew(row.key, field, value)}
                actions={
                  <>
                    <button type="button" onClick={() => submitNew(row)} className={buttonStyles.secondary}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => discardNew(row.key)}
                      className={iconButtonStyles}
                      aria-label={`Discard unsaved row ${row.values.description}`.trim()}
                      title="Discard"
                    >
                      <TrashIcon />
                    </button>
                  </>
                }
                below={row.failure && needsRowMessage(row.failure) ? <RowFailure failure={row.failure} /> : undefined}
              />
            ))}

            <TransactionRowView
              key={entryRow.key}
              rowKey={entryRow.key}
              rowLabel="new row"
              isEntry
              values={entryRow.values}
              people={people}
              showForeign={showForeign}
              columnCount={columnCount}
              status={entryRow.failure ? "error" : "idle"}
              fieldErrors={entryRow.failure?.fieldErrors}
              onChange={(field, value) => editNew(entryRow.key, field, value)}
              actions={
                <button
                  type="button"
                  onClick={() => submitNew(entryRow)}
                  disabled={isBlank(entryRow.values)}
                  className={buttonStyles.primary}
                >
                  Add
                </button>
              }
              below={entryRow.failure && needsRowMessage(entryRow.failure) ? <RowFailure failure={entryRow.failure} /> : undefined}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowFailure({ failure, onRevert }: { failure: ActionFailure; onRevert?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="mr-auto">
        <ActionMessage failure={failure} />
      </div>
      {onRevert && (
        <button type="button" onClick={onRevert} className={buttonStyles.quiet}>
          Undo my changes
        </button>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="6.5" y="6.5" width="10" height="10" rx="2" />
      <path d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10" />
    </svg>
  );
}
