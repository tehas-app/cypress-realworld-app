import { TransactionResponseItem } from "../models";

// RFC 4180, section 2.2: a field containing a comma, a double quote or a line
// break (CRLF or a lone LF) is enclosed in double quotes, and a quote inside it
// is doubled.
export const escapeCsvField = (value: string): string => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

// Transaction amounts are stored in cents; the export carries dollars with two
// decimals, so 44019 becomes "440.19" - no currency sign and no grouping
// separator, neither of which a comma delimited file carries unquoted.
export const formatAmountForExport = (amount: number): string => (amount / 100).toFixed(2);

// The date column is the transaction's last change, in ISO 8601 UTC. modifiedAt
// arrives as a Date from the seed and as a string once read back from lowdb, so
// both are normalised here.
export const formatDateForExport = (date: Date | string): string => new Date(date).toISOString();

// One pair per column: the header, then how to read the value for a row. Adding a
// column means adding a pair, not touching the serializers.
const columns: [string, (transaction: TransactionResponseItem) => string][] = [
  ["date", (transaction) => formatDateForExport(transaction.modifiedAt)],
  ["description", (transaction) => transaction.description],
  ["sender", (transaction) => transaction.senderName],
  ["receiver", (transaction) => transaction.receiverName],
  ["amount", (transaction) => formatAmountForExport(transaction.amount)],
  ["status", (transaction) => transaction.status],
];

const headerRow = columns.map(([header]) => header);

export const serializeCsvRow = (cells: string[]): string =>
  cells.map((cell) => escapeCsvField(cell)).join(",");

// RFC 4180 separates records with CRLF, which is also what the readers split on.
export const serializeTransactionsCsv = (transactions: TransactionResponseItem[]): string => {
  const rows = transactions.map((transaction) => columns.map(([, read]) => read(transaction)));

  return [serializeCsvRow(headerRow), ...rows.map((row) => serializeCsvRow(row))].join("\r\n");
};
