import { minorUnitsFor } from "@/lib/currency";
import { formatIsoDate } from "@/lib/dates";
import { minorToDecimalString } from "@/lib/settlement/money";
import type { TransactionRow } from "@/lib/transactions/types";
import type { SettlementPerson, SettlementSummary } from "./types";

/**
 * A CSV for spreadsheets: every transaction, a blank line, then each pair's
 * balance (outstanding and settled). RFC 4180 quoting with CRLF line ends.
 * Amounts are plain decimals ("1234.56") so spreadsheets read them as numbers.
 */
export function buildSettlementCsv(
  rows: readonly TransactionRow[],
  people: readonly SettlementPerson[],
  summary: SettlementSummary,
): string {
  const names = new Map(people.map((person) => [person.id, person.displayName]));
  const name = (id: string) => names.get(id) ?? "Unknown";

  const lines: string[][] = [
    ["Date", "Description", "Type", "To pay", "To be paid", "Amount (PHP)", "Foreign currency", "Foreign amount", "Notes"],
    ...rows.map((row) => [
      row.transactionDate ?? formatIsoDate(new Date(row.createdAt)),
      row.description,
      row.type === "payment" ? "Payment" : "Expense",
      name(row.payerId),
      name(row.recipientId),
      minorToDecimalString(row.amountPhpCentavos),
      row.foreignCurrency ?? "",
      row.foreignCurrency && row.foreignAmountMinor !== null
        ? minorToDecimalString(row.foreignAmountMinor, minorUnitsFor(row.foreignCurrency))
        : "",
      row.notes ?? "",
    ]),
    [],
    ["To pay", "To be paid", "Outstanding (PHP)", "Status"],
    ...[...summary.outstanding, ...summary.settled].map((card) => [
      card.debtor.displayName,
      card.creditor.displayName,
      minorToDecimalString(card.amountPhpCentavos),
      card.status === "settled" ? "Settled" : "Outstanding",
    ]),
  ];

  return lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Quotes one cell. Text that a spreadsheet would run as a formula (it starts
 * with =, +, -, @, a tab or a carriage return) gets a leading apostrophe:
 * descriptions are user text. Our own amounts are never negative, so no
 * number is touched.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== safe.trim() ? `"${safe.replaceAll('"', '""')}"` : safe;
}
