// apps/mobile/utils/pdfGenerator.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import {
  type CashbookDailyReportRow,
  type CashbookEntryRow,
} from "../db/cashbookQueries";
import { type CustomerReportEntryRow } from "../db/customerQueries";
import { formatCurrency, type CurrencyCode } from "./formatCurrency";

export interface CashbookPdfReportParams {
  businessName: string;
  currency: CurrencyCode;
  startDate: string;
  endDate: string;
  totalIn: number;
  totalOut: number;
  netBalance: number;
  rows: CashbookDailyReportRow[];
  entries?: CashbookEntryRow[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatFullDateDisplay(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = SHORT_MONTHS[monthIdx] || parts[1];
  return `${day} ${monthName} ${year}`;
}

function formatShortDateDisplay(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = SHORT_MONTHS[monthIdx] || parts[1];
  return `${day} ${monthName}`;
}

function getBusinessInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "HK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getSharedStatementStyles(): string {
  return `
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #141413;
      margin: 0;
      padding: 0;
      background-color: #F9F5EB;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-wrap {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .top-banner {
      background-color: #133A2E;
      color: #FFFFFF;
      padding: 16px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .biz-brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .biz-avatar {
      width: 38px;
      height: 38px;
      border-radius: 19px;
      background-color: #C9A227;
      border: 2px solid rgba(255,255,255,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
      color: #FFFFFF;
    }
    .biz-title {
      font-size: 16px;
      font-weight: 600;
      color: #F9F5EB;
      margin: 0;
    }
    .app-brand {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 15px;
      font-weight: 700;
      color: #FFFFFF;
    }
    .app-book-icon {
      display: inline-block;
      width: 15px;
      height: 18px;
      background-color: #FFFFFF;
      border-radius: 2px;
      border-left: 3px solid #C9A227;
    }
    .content-area {
      padding: 22px 28px 28px 28px;
      flex: 1;
    }
    .statement-heading {
      text-align: center;
      margin-bottom: 18px;
    }
    .statement-heading h2 {
      font-size: 18px;
      font-weight: 700;
      color: #141413;
      margin: 0 0 6px 0;
    }
    .statement-heading p {
      font-size: 13px;
      color: #6B6350;
      margin: 0;
      font-weight: 500;
    }
    .summary-card {
      border: 1px solid #DCD3BE;
      border-radius: 4px;
      padding: 16px 22px;
      margin-bottom: 22px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      background-color: #F2ECDB;
    }
    .sum-col {
      flex: 1;
    }
    .sum-op {
      font-size: 18px;
      font-weight: 700;
      color: #8A8068;
      padding: 16px 18px 0 18px;
    }
    .sum-label {
      font-size: 12px;
      font-weight: 700;
      color: #3D3829;
      margin-bottom: 6px;
    }
    .sum-main-val {
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .sum-sub-line {
      font-size: 11px;
      color: #6B6350;
      margin-top: 3px;
      font-weight: 500;
    }
    table.statement-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      border: 1px solid #DCD3BE;
    }
    table.statement-table th {
      background-color: #EAE0C8;
      color: #141413;
      font-size: 11.5px;
      font-weight: 700;
      padding: 10px 10px;
      border-top: 1px solid #DCD3BE;
      border-bottom: 1.5px solid #133A2E;
      text-align: right;
    }
    table.statement-table th:first-child {
      text-align: left;
    }
    table.statement-table td {
      padding: 9px 10px;
      border: 1px solid #DCD3BE;
      vertical-align: middle;
    }
    .col-date {
      width: 24%;
      background-color: #F9F5EB;
    }
    .col-in {
      width: 19%;
      text-align: right;
      background-color: #F1F5E9;
      font-weight: 700;
      color: #166534;
    }
    .col-out {
      width: 19%;
      text-align: right;
      background-color: #FBF0E6;
      font-weight: 700;
      color: #9A3412;
    }
    .col-daily-bal {
      width: 19%;
      text-align: right;
      background-color: #F9F5EB;
      font-weight: 700;
    }
    .col-total-bal {
      width: 19%;
      text-align: right;
      background-color: #F9F5EB;
      font-weight: 700;
    }
    /* Single-date summary row */
    .date-summary-row td {
      background-color: #EAE0C8;
      font-weight: 700;
    }
    .date-summary-row td.col-out,
    .date-summary-row td.col-daily-bal,
    .date-summary-row td.col-total-bal {
      background-color: #EAE0C8;
    }
    /* Multi-date distinct highlighted header row */
    .date-summary-multi td {
      background-color: #EAE0C8 !important;
      border-top: 2px solid #133A2E !important;
      border-bottom: 1px solid #DCD3BE !important;
      font-weight: 700;
      padding-top: 11px;
      padding-bottom: 11px;
    }
    .date-summary-multi td.col-date {
      background-color: #EAE0C8 !important;
      border-left: 4px solid #133A2E !important;
    }
    .date-summary-multi td.col-in {
      background-color: #EAE0C8 !important;
    }
    .customer-date-group-row td {
      background-color: #EAE0C8 !important;
      border-top: 2px solid #133A2E !important;
      border-bottom: 1px solid #DCD3BE !important;
      border-left: 4px solid #133A2E !important;
      color: #133A2E;
      font-weight: 700;
      font-size: 12px;
      padding: 8px 10px;
    }
    .primary-cell-title {
      font-size: 12px;
      font-weight: 700;
      color: #141413;
      margin-bottom: 3px;
    }
    .secondary-cell-note {
      font-size: 10.5px;
      color: #6B6350;
      font-weight: 500;
      line-height: 1.35;
      word-break: break-word;
    }
    .grand-total-row td {
      background-color: #E2D6B8 !important;
      border-top: 3px double #133A2E !important;
      font-weight: 700;
      font-size: 12.5px;
      color: #141413;
      padding: 11px 10px;
    }
    .bottom-banner {
      background-color: #133A2E;
      color: #FFFFFF;
      padding: 12px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      margin-top: auto;
    }
    .bottom-badge {
      background-color: #F9F5EB;
      color: #133A2E;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 3px;
      margin-left: 8px;
      font-size: 10.5px;
    }
  `;
}

/**
 * Generates an HTML template for the Cashbook Statement PDF matching the Khatabook statement layout.
 */
function buildCashbookReportHtml(params: CashbookPdfReportParams): string {
  const {
    businessName,
    currency,
    startDate,
    endDate,
    totalIn,
    totalOut,
    netBalance,
    rows,
    entries = [],
  } = params;

  const initials = getBusinessInitials(businessName);
  const startDisplay = formatFullDateDisplay(startDate);
  const endDisplay = formatFullDateDisplay(endDate);

  // Calculate Cash vs Online breakdown if detailed entries are available
  let cashIn = 0;
  let onlineIn = 0;
  let cashOut = 0;
  let onlineOut = 0;

  if (entries.length > 0) {
    for (const e of entries) {
      if (e.type === "IN") {
        if (e.payment_mode === "ONLINE") onlineIn += e.amount;
        else cashIn += e.amount;
      } else {
        if (e.payment_mode === "ONLINE") onlineOut += e.amount;
        else cashOut += e.amount;
      }
    }
  } else {
    cashIn = totalIn;
    cashOut = totalOut;
  }

// Group individual entries by entry_date (sorted oldest-to-newest time within each date)
  const sortedEntriesAsc = [...entries].sort(
    (a, b) =>
      a.entry_date.localeCompare(b.entry_date) ||
      (a.timestamp || 0) - (b.timestamp || 0),
  );
  const entriesByDate = new Map<string, CashbookEntryRow[]>();
  for (const e of sortedEntriesAsc) {
    const list = entriesByDate.get(e.entry_date) ?? [];
    list.push(e);
    entriesByDate.set(e.entry_date, list);
  }

  // Chronological oldest-to-newest (1 -> 15)
  const sortedAsc = [...rows].sort((a, b) =>
    a.entry_date.localeCompare(b.entry_date),
  );
  const firstDay = sortedAsc[0];
  const lastDay = sortedAsc[sortedAsc.length - 1];
  const openingBalance = firstDay
    ? firstDay.total_balance - firstDay.daily_balance
    : 0;
  const closingBalance = lastDay ? lastDay.total_balance : netBalance;

const netColor = netBalance >= 0 ? "#166534" : "#B91C1C";
  const netSign = netBalance < 0 ? "- " : netBalance > 0 ? "+ " : "";
  const netSuffix = netBalance < 0 ? " Dr" : netBalance > 0 ? " Cr" : "";
  const isMultiDate = sortedAsc.length > 1;

  const tableRowsHtml =
    sortedAsc.length === 0
      ? `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #6B6350; background-color: #F9F5EB;">No entries found in this date range.</td></tr>`
      : sortedAsc
          .map((row) => {
            const dailyBalColor =
              row.daily_balance < 0 ? "#9A3412" : "#166534";
            const totalBalColor =
              row.total_balance < 0 ? "#9A3412" : "#166534";
            const dailySign = row.daily_balance < 0 ? "- " : "";
            const totalSign = row.total_balance < 0 ? "- " : "";
            const dayEntries = entriesByDate.get(row.entry_date) ?? [];
            const rowClass = isMultiDate
              ? "date-summary-row date-summary-multi"
              : "date-summary-row";

            const dayHeaderHtml = `
              <tr class="${rowClass}">
                <td class="col-date">
                  <div class="primary-cell-title" style="color: ${isMultiDate ? "#133A2E" : "#141413"}; font-size: ${isMultiDate ? "13px" : "12px"};">
                    ${escapeHtml(formatShortDateDisplay(row.entry_date))}
                  </div>
                  <div class="secondary-cell-note" style="color: ${isMultiDate ? "#3D3829" : "#6B6350"}; font-weight: 600;">
                    ${row.entry_count} ${row.entry_count === 1 ? "Entry" : "Entries"}
                  </div>
                </td>
                <td class="col-in">
                  ${formatCurrency(row.daily_in, currency, true)}
                </td>
                <td class="col-out">
                  ${formatCurrency(row.daily_out, currency, true)}
                </td>
                <td class="col-daily-bal" style="color: ${dailyBalColor};">
                  ${dailySign}${formatCurrency(Math.abs(row.daily_balance), currency, true)}
                </td>
                <td class="col-total-bal" style="color: ${totalBalColor};">
                  ${totalSign}${formatCurrency(Math.abs(row.total_balance), currency, true)}
                </td>
              </tr>
            `;

            const entryRowsHtml = dayEntries
              .map((entry) => {
                const noteText =
                  entry.details && entry.details.trim().length > 0
                    ? escapeHtml(entry.details.trim())
                    : entry.payment_mode === "ONLINE"
                      ? "Online entry"
                      : "Cash entry";
                return `
                  <tr>
                    <td class="col-date">
                      <div class="primary-cell-title">${escapeHtml(entry.entry_time || "")}</div>
                      <div class="secondary-cell-note">${noteText}</div>
                    </td>
                    <td class="col-in">
                      ${entry.type === "IN" ? formatCurrency(entry.amount, currency, true) : ""}
                    </td>
                    <td class="col-out">
                      ${entry.type === "OUT" ? formatCurrency(entry.amount, currency, true) : ""}
                    </td>
                    <td class="col-daily-bal"></td>
                    <td class="col-total-bal"></td>
                  </tr>
                `;
              })
              .join("");

            return dayHeaderHtml + entryRowsHtml;
          })
          .join("");

const closingSign =
    closingBalance < 0 ? "- " : closingBalance > 0 ? "+ " : "";
  const grandTotalHtml =
    sortedAsc.length > 0
      ? `
        <tr class="grand-total-row">
          <td>Grand Total</td>
          <td style="text-align: right;">${formatCurrency(totalIn, currency, true)}</td>
          <td style="text-align: right;">${formatCurrency(totalOut, currency, true)}</td>
          <td></td>
          <td style="text-align: right;">${closingSign}${formatCurrency(Math.abs(closingBalance), currency, true)}</td>
        </tr>
      `
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${getSharedStatementStyles()}</style>
      </head>
      <body>
        <div class="page-wrap">
          <div class="top-banner">
            <div class="biz-brand">
              <div class="biz-avatar">${escapeHtml(initials)}</div>
              <p class="biz-title">${escapeHtml(businessName)}</p>
            </div>
            <div class="app-brand">
              <span class="app-book-icon"></span>
              <span>HisabKhata</span>
            </div>
          </div>

          <div class="content-area">
            <div class="statement-heading">
              <h2>Cashbook Statement</h2>
              <p>${escapeHtml(startDisplay)} - ${escapeHtml(endDisplay)} (Date Range)</p>
            </div>

            <div class="summary-card">
              <div class="sum-col">
                <div class="sum-label">Total IN (+)</div>
                <div class="sum-main-val" style="color: #166534;">
                  ${formatCurrency(totalIn, currency, true)}
                </div>
                <div class="sum-sub-line">Cash : ${formatCurrency(cashIn, currency, true)}</div>
                <div class="sum-sub-line">Online : ${formatCurrency(onlineIn, currency, true)}</div>
              </div>

              <div class="sum-op">-</div>

              <div class="sum-col">
                <div class="sum-label">Total OUT (-)</div>
                <div class="sum-main-val" style="color: #9A3412;">
                  ${formatCurrency(totalOut, currency, true)}
                </div>
                <div class="sum-sub-line">Cash : ${formatCurrency(cashOut, currency, true)}</div>
                <div class="sum-sub-line">Online : ${formatCurrency(onlineOut, currency, true)}</div>
              </div>

              <div class="sum-op">=</div>

              <div class="sum-col">
                <div class="sum-label">Net Balance</div>
                <div class="sum-main-val" style="color: ${netColor};">
                  ${netSign}${formatCurrency(Math.abs(netBalance), currency, true)}${netSuffix}
                </div>
                <div class="sum-sub-line">
                  Opening balance (${escapeHtml(formatShortDateDisplay(startDate))}) :
                  <span style="color: ${openingBalance < 0 ? "#9A3412" : "#166534"}; font-weight: 700;">
                    ${openingBalance < 0 ? "- " : ""}${formatCurrency(Math.abs(openingBalance), currency, true)}
                  </span>
                </div>
                <div class="sum-sub-line">
                  Closing balance (${escapeHtml(formatShortDateDisplay(endDate))}) :
                  <span style="color: ${closingBalance < 0 ? "#9A3412" : "#166534"}; font-weight: 700;">
                    ${closingSign}${formatCurrency(Math.abs(closingBalance), currency, true)}
                  </span>
                </div>
              </div>
            </div>

            <table class="statement-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total IN</th>
                  <th>Total OUT</th>
                  <th>Daily Balance</th>
                  <th>Total Balance</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
                ${grandTotalHtml}
              </tbody>
            </table>
          </div>

          <div class="bottom-banner">
            <div>
              <span>Start Using HisabKhata Now</span>
              <span class="bottom-badge">HisabKhata</span>
            </div>
            <div style="text-align: right;">
              <div>100% Safe &amp; Automatic Cloud Backup</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function generateAndShareCashbookPdf(
  params: CashbookPdfReportParams,
): Promise<void> {
  const html = buildCashbookReportHtml(params);

  const { uri, base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  const safeStart = params.startDate.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeEnd = params.endDate.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Cashbook_Report_${safeStart}_to_${safeEnd}.pdf`;
  const baseDir =
    FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  let targetUri = uri;

  if (baseDir && base64) {
    targetUri = `${baseDir}${fileName}`;
    await FileSystem.writeAsStringAsync(targetUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(targetUri, {
      mimeType: "application/pdf",
      dialogTitle: `Share Cashbook Report (${params.startDate} to ${params.endDate})`,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}

export async function printOrSaveCashbookPdf(
  params: CashbookPdfReportParams,
): Promise<void> {
  const html = buildCashbookReportHtml(params);
  await Print.printAsync({ html });
}

export interface CustomerPdfReportParams {
  businessName: string;
  reportTitle: string;
  currency: CurrencyCode;
  startDate: string;
  endDate: string;
  totalGave: number;
  totalGot: number;
  netBalance: number;
  rows: CustomerReportEntryRow[];
  showCustomerName: boolean;
}

/**
 * Generates HTML markup for Customer Ledger / All Customers PDF Report in the same Khatabook statement style.
 */
function buildCustomerReportHtml(params: CustomerPdfReportParams): string {
  const {
    businessName,
    reportTitle,
    currency,
    startDate,
    endDate,
    totalGave,
    totalGot,
    netBalance,
    rows,
    showCustomerName,
  } = params;

  const initials = getBusinessInitials(businessName);
  const startDisplay = formatFullDateDisplay(startDate);
  const endDisplay = formatFullDateDisplay(endDate);

  const netColor =
    netBalance < 0 ? "#9A3412" : netBalance > 0 ? "#166534" : "#374151";
  const netSign = netBalance < 0 ? "- " : netBalance > 0 ? "+ " : "";
  const netLabel =
    netBalance < 0
      ? "You will get (Dr)"
      : netBalance > 0
        ? "You will give (Cr)"
        : "Settled";

  const gaveCount = rows.filter((r) => r.type === "GAVE").length;
  const gotCount = rows.filter((r) => r.type === "GOT").length;

  // Sort oldest-to-newest (1 -> 15) for statement reading
  const sortedCustomerRowsAsc = [...rows].sort((a, b) =>
    a.entry_date.localeCompare(b.entry_date),
  );
  const uniqueDates = new Set(sortedCustomerRowsAsc.map((r) => r.entry_date));
  const isMultiDate = uniqueDates.size > 1;

  const tableRowsHtml =
    sortedCustomerRowsAsc.length === 0
      ? `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #6B6350; background-color: #F9F5EB;">No transactions found in this date range.</td></tr>`
      : sortedCustomerRowsAsc
          .map((row, idx) => {
            const isNewDateGroup =
              isMultiDate &&
              (idx === 0 ||
                sortedCustomerRowsAsc[idx - 1].entry_date !== row.entry_date);

            const dateGroupBanner = isNewDateGroup
              ? `
                <tr class="customer-date-group-row">
                  <td colspan="4">${escapeHtml(formatFullDateDisplay(row.entry_date))}</td>
                </tr>
              `
              : "";

            const balColor = row.running_balance < 0 ? "#9A3412" : "#166534";
            const balSign = row.running_balance < 0 ? "- " : "";
            const noteParts: string[] = [];
            if (showCustomerName && row.customer_name) {
              noteParts.push(escapeHtml(row.customer_name));
            }
            if (row.details && row.details.trim().length > 0) {
              noteParts.push(escapeHtml(row.details.trim()));
            }
            const noteHtml =
              noteParts.length > 0
                ? noteParts.join(" • ")
                : row.type === "GAVE"
                  ? "Credit given"
                  : "Payment received";

            return (
              dateGroupBanner +
              `
              <tr>
                <td class="col-date" style="width: 34%;">
                  <div class="primary-cell-title">${escapeHtml(formatShortDateDisplay(row.entry_date))} • ${escapeHtml(row.entry_time || "")}</div>
                  <div class="secondary-cell-note">${noteHtml}</div>
                </td>
                <td class="col-out" style="width: 22%;">
                  ${row.type === "GAVE" ? formatCurrency(row.amount, currency, true) : ""}
                </td>
                <td class="col-in" style="width: 22%;">
                  ${row.type === "GOT" ? formatCurrency(row.amount, currency, true) : ""}
                </td>
                <td class="col-total-bal" style="width: 22%; color: ${balColor};">
                  ${balSign}${formatCurrency(Math.abs(row.running_balance), currency, true)}
                </td>
              </tr>
            `
            );
          })
          .join("");

  const grandTotalHtml =
    sortedCustomerRowsAsc.length > 0
      ? `
        <tr class="grand-total-row">
          <td>Grand Total (${sortedCustomerRowsAsc.length} Entries)</td>
          <td style="text-align: right;">${formatCurrency(totalGave, currency, true)}</td>
          <td style="text-align: right;">${formatCurrency(totalGot, currency, true)}</td>
          <td style="text-align: right; color: ${netColor};">${netSign}${formatCurrency(Math.abs(netBalance), currency, true)}</td>
        </tr>
      `
      : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${getSharedStatementStyles()}</style>
      </head>
      <body>
        <div class="page-wrap">
          <div class="top-banner">
            <div class="biz-brand">
              <div class="biz-avatar">${escapeHtml(initials)}</div>
              <p class="biz-title">${escapeHtml(businessName)}</p>
            </div>
            <div class="app-brand">
              <span class="app-book-icon"></span>
              <span>HisabKhata</span>
            </div>
          </div>

          <div class="content-area">
            <div class="statement-heading">
              <h2>${escapeHtml(reportTitle)}</h2>
              <p>${escapeHtml(startDisplay)} - ${escapeHtml(endDisplay)} (Date Range)</p>
            </div>

            <div class="summary-card">
              <div class="sum-col">
                <div class="sum-label">Total You Gave (-)</div>
                <div class="sum-main-val" style="color: #9A3412;">
                  ${formatCurrency(totalGave, currency, true)}
                </div>
                <div class="sum-sub-line">Entries : ${gaveCount}</div>
              </div>

              <div class="sum-op">-</div>

              <div class="sum-col">
                <div class="sum-label">Total You Got (+)</div>
                <div class="sum-main-val" style="color: #166534;">
                  ${formatCurrency(totalGot, currency, true)}
                </div>
                <div class="sum-sub-line">Entries : ${gotCount}</div>
              </div>

              <div class="sum-op">=</div>

              <div class="sum-col">
                <div class="sum-label">Net Balance</div>
                <div class="sum-main-val" style="color: ${netColor};">
                  ${netSign}${formatCurrency(Math.abs(netBalance), currency, true)}
                </div>
                <div class="sum-sub-line">Status : <strong>${netLabel}</strong></div>
              </div>
            </div>

            <table class="statement-table">
              <thead>
                <tr>
                  <th>Date &amp; Details</th>
                  <th>You Gave</th>
                  <th>You Got</th>
                  <th>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
                ${grandTotalHtml}
              </tbody>
            </table>
          </div>

          <div class="bottom-banner">
            <div>
              <span>Start Using HisabKhata Now</span>
              <span class="bottom-badge">HisabKhata</span>
            </div>
            <div style="text-align: right;">
              <div>100% Safe &amp; Automatic Cloud Backup</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function generateAndShareCustomerPdf(
  params: CustomerPdfReportParams,
): Promise<void> {
  const html = buildCustomerReportHtml(params);

  const { uri, base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  const safeTitle = params.reportTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeStart = params.startDate.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeEnd = params.endDate.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${safeTitle}_${safeStart}_to_${safeEnd}.pdf`;
  const baseDir =
    FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  let targetUri = uri;

  if (baseDir && base64) {
    targetUri = `${baseDir}${fileName}`;
    await FileSystem.writeAsStringAsync(targetUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(targetUri, {
      mimeType: "application/pdf",
      dialogTitle: `Share ${params.reportTitle}`,
      UTI: "com.adobe.pdf",
    });
  } else {
    await Print.printAsync({ html });
  }
}

export async function printOrSaveCustomerPdf(
  params: CustomerPdfReportParams,
): Promise<void> {
  const html = buildCustomerReportHtml(params);
  await Print.printAsync({ html });
}