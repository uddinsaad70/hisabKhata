// apps/mobile/utils/pdfGenerator.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { type CashbookDailyReportRow } from "../db/cashbookQueries";
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
}

/**
 * Helper to escape HTML special characters safely.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generates an HTML template for the Cashbook Daily Report PDF.
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
  } = params;

  const netColor = netBalance >= 0 ? "#16A34A" : "#DC2626";
  const generatedAt = new Date().toLocaleString();

  const tableRowsHtml =
    rows.length === 0
      ? `<tr><td colspan="4" style="text-align: center; padding: 24px; color: #6B7280;">No entries found in this date range.</td></tr>`
      : rows
          .map((row) => {
            const balColor = row.total_balance >= 0 ? "#16A34A" : "#DC2626";
            return `
              <tr>
                <td>
                  <div style="font-weight: 600; color: #111827;">${escapeHtml(row.entry_date)}</div>
                  <div style="font-size: 11px; color: #6B7280;">${row.entry_count} ${row.entry_count === 1 ? "Entry" : "Entries"}</div>
                </td>
                <td style="text-align: right; color: #16A34A; font-weight: 600;">
                  ${formatCurrency(row.daily_in, currency, false)}
                </td>
                <td style="text-align: right; color: #DC2626; font-weight: 600; background-color: #FFF1F2;">
                  ${formatCurrency(row.daily_out, currency, false)}
                </td>
                <td style="text-align: right; color: ${balColor}; font-weight: 700;">
                  ${formatCurrency(row.total_balance, currency, true)}
                </td>
              </tr>
            `;
          })
          .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1F2937;
            margin: 0;
            padding: 24px;
          }
          .header {
            border-bottom: 2px solid #1E40AF;
            padding-bottom: 12px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .biz-name {
            font-size: 22px;
            font-weight: 700;
            color: #1E40AF;
            margin: 0 0 4px 0;
          }
          .report-title {
            font-size: 14px;
            font-weight: 600;
            color: #4B5563;
            margin: 0;
          }
          .date-range {
            text-align: right;
            font-size: 12px;
            color: #374151;
          }
          .summary-box {
            display: flex;
            border: 1px solid #E5E7EB;
            border-radius: 8px;
            margin-bottom: 20px;
            background-color: #F9FAFB;
            overflow: hidden;
          }
          .summary-item {
            flex: 1;
            padding: 12px;
            text-align: center;
            border-right: 1px solid #E5E7EB;
          }
          .summary-item:last-child {
            border-right: none;
          }
          .summary-label {
            font-size: 11px;
            color: #6B7280;
            text-transform: uppercase;
            margin-bottom: 4px;
            font-weight: 600;
          }
          .summary-val {
            font-size: 16px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th {
            background-color: #F3F4F6;
            color: #4B5563;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 10px 8px;
            border-bottom: 1px solid #D1D5DB;
            text-align: right;
          }
          th:first-child {
            text-align: left;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #E5E7EB;
          }
          .footer {
            margin-top: 28px;
            text-align: center;
            font-size: 11px;
            color: #9CA3AF;
            border-top: 1px solid #E5E7EB;
            padding-top: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="biz-name">${escapeHtml(businessName)}</h1>
            <p class="report-title">Cashbook Daily Report</p>
          </div>
          <div class="date-range">
            <div><strong>Period:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)}</div>
            <div style="color: #6B7280; margin-top: 2px;">Generated: ${escapeHtml(generatedAt)}</div>
          </div>
        </div>

        <div class="summary-box">
          <div class="summary-item">
            <div class="summary-label">Total IN</div>
            <div class="summary-val" style="color: #16A34A;">${formatCurrency(totalIn, currency, true)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total OUT</div>
            <div class="summary-val" style="color: #DC2626;">${formatCurrency(totalOut, currency, true)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Net Balance</div>
            <div class="summary-val" style="color: ${netColor};">${formatCurrency(netBalance, currency, true)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Daily IN</th>
              <th>Daily OUT</th>
              <th>Total Bal.</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <div class="footer">
          Generated by HisabKhata App
        </div>
      </body>
    </html>
  `;
}

/**
 * Generates a PDF file for the Cashbook Report and opens the native share sheet
 * (allowing WhatsApp send, Drive upload, or saving locally via Share/Print).
 */
export async function generateAndShareCashbookPdf(
  params: CashbookPdfReportParams,
): Promise<void> {
  const html = buildCashbookReportHtml(params);

  // 1. Generate PDF and get base64 content directly in memory
  // This bypasses Expo Go's file read restriction on global cache/Print directory
  const { uri, base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  // 2. Write the base64 PDF directly into the app's own allowed directory with a clean filename
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

  // 3. Trigger native share sheet (WhatsApp, Telegram, Save to Device, etc.)
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(targetUri, {
      mimeType: "application/pdf",
      dialogTitle: `Share Cashbook Report (${params.startDate} to ${params.endDate})`,
      UTI: "com.adobe.pdf",
    });
  } else {
    // Fallback to native print/save dialog if sharing is unavailable
    await Print.printAsync({ html });
  }
}

/**
 * Opens the native system print/save-as-PDF preview dialog directly.
 */
export async function printOrSaveCashbookPdf(
  params: CashbookPdfReportParams,
): Promise<void> {
  const html = buildCashbookReportHtml(params);
  await Print.printAsync({ html });
}
