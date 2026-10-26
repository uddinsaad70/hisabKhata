// apps/mobile/db/__tests__/cashbookQueries.test.ts
import { createInMemoryDatabaseAdapter } from "./testDbHelper";
import { runMigrations } from "../migrations";
import { createBusiness } from "../businessQueries";
import {
  addCashbookEntry,
  getCashbookDailyReport,
  getCashbookDashboardSummary,
  getCashbookEntriesByDate,
  softDeleteCashbookEntry,
  undoDeleteCashbookEntry,
  updateCashbookEntry,
} from "../cashbookQueries";

describe("cashbookQueries on real in-memory SQLite", () => {
  it("computes Cash in Hand vs Online splits and Today's Balance accurately", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Reza Cashbook Shop" });

      // Previous day (2026-10-17): CASH IN 5000, ONLINE OUT 1000 -> Net +4000
      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "IN",
        paymentMode: "CASH",
        amount: 5000,
        details: "Opening cash",
        entryDate: "2026-10-17",
        entryTime: "10:00 AM",
        timestamp: 1000,
      });

      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "OUT",
        paymentMode: "ONLINE",
        amount: 1000,
        details: "Supplier bKash",
        entryDate: "2026-10-17",
        entryTime: "04:00 PM",
        timestamp: 2000,
      });

      // Today (2026-10-18): CASH OUT 1200, ONLINE IN 3500 -> Today Net +2300
      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "OUT",
        paymentMode: "CASH",
        amount: 1200,
        details: "Shop rent",
        entryDate: "2026-10-18",
        entryTime: "11:00 AM",
        timestamp: 3000,
      });

      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "IN",
        paymentMode: "ONLINE",
        amount: 3500,
        details: "Customer Nagad",
        entryDate: "2026-10-18",
        entryTime: "06:50 PM",
        timestamp: 4000,
      });

      const summary = await getCashbookDashboardSummary(
        adapter,
        biz.id,
        "2026-10-18",
      );

      // Total Cash: 5000 - 1200 = 3800
      expect(summary.total_cash).toBe(3800);
      // Total Online: -1000 + 3500 = 2500
      expect(summary.total_online).toBe(2500);
      // Total Balance: 3800 + 2500 = 6300
      expect(summary.total_balance).toBe(6300);

      // Today (2026-10-18) splits
      expect(summary.today_cash).toBe(-1200);
      expect(summary.today_online).toBe(3500);
      expect(summary.today_balance).toBe(2300);
      expect(summary.today_in_total).toBe(3500);
      expect(summary.today_out_total).toBe(1200);
      expect(summary.today_entry_count).toBe(2);

      const todayEntries = await getCashbookEntriesByDate(
        adapter,
        biz.id,
        "2026-10-18",
      );
      expect(todayEntries).toHaveLength(2);
      expect(todayEntries[0].details).toBe("Customer Nagad");
    } finally {
      close();
    }
  });

  it("supports editing payment_mode/amount and soft-delete with 5s undo restore", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Main Store" });

      const entry = await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "IN",
        paymentMode: "CASH",
        amount: 1000.555, // rounds to 1000.56
        details: "Sale",
        entryDate: "2026-10-18",
        entryTime: "01:00 PM",
      });

      expect(entry.amount).toBe(1000.56);

      // Edit from CASH to ONLINE and change amount to 1500
      const updated = await updateCashbookEntry(adapter, {
        entryId: entry.id,
        businessId: biz.id,
        paymentMode: "ONLINE",
        amount: 1500,
      });
      expect(updated.payment_mode).toBe("ONLINE");
      expect(updated.amount).toBe(1500);

      let summary = await getCashbookDashboardSummary(
        adapter,
        biz.id,
        "2026-10-18",
      );
      expect(summary.total_cash).toBe(0);
      expect(summary.total_online).toBe(1500);

      // Soft-delete entry
      await softDeleteCashbookEntry(adapter, biz.id, entry.id);
      summary = await getCashbookDashboardSummary(
        adapter,
        biz.id,
        "2026-10-18",
      );
      expect(summary.total_balance).toBe(0);

      // Undo soft-delete
      await undoDeleteCashbookEntry(adapter, biz.id, entry.id);
      summary = await getCashbookDashboardSummary(
        adapter,
        biz.id,
        "2026-10-18",
      );
      expect(summary.total_balance).toBe(1500);
    } finally {
      close();
    }
  });

  it("calculates cumulative total_balance across dates even when filtered mid-month (CTE + Window Function)", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Report Store" });

      // Oct 05: IN 2000 -> Daily +2000, Cumulative 2000
      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "IN",
        amount: 2000,
        entryDate: "2026-10-05",
        entryTime: "09:00 AM",
      });

      // Oct 10: OUT 500 -> Daily -500, Cumulative 1500
      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "OUT",
        amount: 500,
        entryDate: "2026-10-10",
        entryTime: "10:00 AM",
      });

      // Oct 15: IN 1200, OUT 200 -> Daily +1000, Cumulative 2500
      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "IN",
        amount: 1200,
        entryDate: "2026-10-15",
        entryTime: "11:00 AM",
      });
      await addCashbookEntry(adapter, {
        businessId: biz.id,
        type: "OUT",
        amount: 200,
        entryDate: "2026-10-15",
        entryTime: "03:00 PM",
      });

      // Filter from Oct 10 to Oct 20 (excluding Oct 05 from rows, but Oct 05's +2000 MUST be in cumulative total_balance!)
      const report = await getCashbookDailyReport(
        adapter,
        biz.id,
        "2026-10-10",
        "2026-10-20",
      );

      expect(report).toHaveLength(2);
      // Newest date first (Oct 15, then Oct 10)
      expect(report[0]).toEqual({
        entry_date: "2026-10-15",
        daily_in: 1200,
        daily_out: 200,
        daily_balance: 1000,
        total_balance: 2500,
        entry_count: 2,
      });
      expect(report[1]).toEqual({
        entry_date: "2026-10-10",
        daily_in: 0,
        daily_out: 500,
        daily_balance: -500,
        total_balance: 1500,
        entry_count: 1,
      });
    } finally {
      close();
    }
  });
});
