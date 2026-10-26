// apps/mobile/db/__tests__/customerQueries.test.ts
import { createInMemoryDatabaseAdapter } from "./testDbHelper";
import { runMigrations } from "../migrations";
import { createBusiness } from "../businessQueries";
import {
  addCustomerEntry,
  checkDuplicatePhone,
  createCustomer,
  getAvatarInitials,
  getCustomerById,
  getCustomerEntryById,
  getCustomerLedgerEntries,
  getCustomersWithSummary,
  softDeleteCustomerCascade,
  softDeleteCustomerEntry,
  undoDeleteCustomerEntry,
  updateCustomer,
  updateCustomerEntry,
} from "../customerQueries";

describe("customerQueries on real in-memory SQLite", () => {
  it("computes avatar initials, checks duplicate phones, and isolates businesses", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const bizA = await createBusiness(adapter, { name: "Shop A" });
      const bizB = await createBusiness(adapter, { name: "Shop B" });

      expect(getAvatarInitials("Younus Mg")).toBe("YM");
      expect(getAvatarInitials("Hasina")).toBe("HA");

      const cust1 = await createCustomer(adapter, {
        businessId: bizA.id,
        name: "  Younus Mg  ",
        phone: " 01700000000 ",
      });

      expect(cust1.name).toBe("Younus Mg");
      expect(cust1.phone).toBe("01700000000");
      expect(cust1.avatar_initials).toBe("YM");
      expect(cust1.net_balance).toBe(0);
      expect(cust1.is_synced).toBe(0);

      // Duplicate phone inside the same business is detected
      const dupInSameBiz = await checkDuplicatePhone(
        adapter,
        bizA.id,
        "01700000000",
      );
      expect(dupInSameBiz?.id).toBe(cust1.id);

      // Excluding the customer's own ID (during edit) returns null
      const dupExcludingSelf = await checkDuplicatePhone(
        adapter,
        bizA.id,
        "01700000000",
        cust1.id,
      );
      expect(dupExcludingSelf).toBeNull();

      // Same phone in a different business is NOT a duplicate
      const dupInOtherBiz = await checkDuplicatePhone(
        adapter,
        bizB.id,
        "01700000000",
      );
      expect(dupInOtherBiz).toBeNull();

      // Update customer profile
      const updated = await updateCustomer(adapter, {
        id: cust1.id,
        businessId: bizA.id,
        name: "Green Ration",
        phone: "01811111111",
      });
      expect(updated.name).toBe("Green Ration");
      expect(updated.avatar_initials).toBe("GR");
      expect(updated.phone).toBe("01811111111");
    } finally {
      close();
    }
  });

  it("handles backdated entries and edits with exact Window Function running_balance (Spec Section 6.5.5)", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Reza Enterprise" });
      const customer = await createCustomer(adapter, {
        businessId: biz.id,
        name: "Younus Mg",
      });

      // Mark customer as synced = 1 and record updated_at to verify recomputeBalance() never touches them
      await adapter.runAsync(
        `UPDATE customers SET is_synced = 1, updated_at = 123456789 WHERE id = ?;`,
        [customer.id],
      );

      // 1. Oct 10: GAVE 1000 -> Bal. -1000
      const entryOct10 = await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: customer.id,
        type: "GAVE",
        amount: 1000,
        details: "Initial credit",
        entryDate: "2026-10-10",
        entryTime: "10:00 AM",
        timestamp: 1000,
      });

      // 2. Oct 15: GOT 400 -> Bal. -600
      await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: customer.id,
        type: "GOT",
        amount: 400,
        details: "Partial payment",
        entryDate: "2026-10-15",
        entryTime: "02:00 PM",
        timestamp: 2000,
      });

      // 3. Insert Backdated Entry for Oct 12: GOT 300
      // Expected chronological running balances: Oct 10 (-1000) -> Oct 12 (-700) -> Oct 15 (-300)
      await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: customer.id,
        type: "GOT",
        amount: 300,
        details: "Backdated payment",
        entryDate: "2026-10-12",
        entryTime: "11:30 AM",
        timestamp: 3000,
      });

      const entriesAfterBackdate = await getCustomerLedgerEntries(
        adapter,
        biz.id,
        customer.id,
      );
      // Returned in descending order (Oct 15, Oct 12, Oct 10)
      expect(entriesAfterBackdate.map((e) => e.entry_date)).toEqual([
        "2026-10-15",
        "2026-10-12",
        "2026-10-10",
      ]);
      expect(entriesAfterBackdate.map((e) => e.running_balance)).toEqual([
        -300, -700, -1000,
      ]);

      // Verify recomputeBalance updated net_balance & last_transaction_at WITHOUT touching updated_at or is_synced
      const custAfterBackdate = await getCustomerById(
        adapter,
        biz.id,
        customer.id,
      );
      expect(custAfterBackdate?.net_balance).toBe(-300);
      expect(custAfterBackdate?.last_transaction_at).toBe(3000);
      expect(custAfterBackdate?.updated_at).toBe(123456789);
      expect(custAfterBackdate?.is_synced).toBe(1);

      // 4. Edit Oct 10 entry from GAVE 1000 to GAVE 800
      // Expected chronological running balances: Oct 10 (-800) -> Oct 12 (-500) -> Oct 15 (-100)
      await updateCustomerEntry(adapter, {
        entryId: entryOct10.id,
        businessId: biz.id,
        customerId: customer.id,
        amount: 800,
      });

      const entriesAfterEdit = await getCustomerLedgerEntries(
        adapter,
        biz.id,
        customer.id,
      );
      expect(entriesAfterEdit.map((e) => e.running_balance)).toEqual([
        -100, -500, -800,
      ]);

      const custAfterEdit = await getCustomerById(adapter, biz.id, customer.id);
      expect(custAfterEdit?.net_balance).toBe(-100);
    } finally {
      close();
    }
  });

  it("supports entry soft-delete, 5s undo restore, home summary filters, and cascade customer delete", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Main Shop" });

      const custGet = await createCustomer(adapter, {
        businessId: biz.id,
        name: "Buyer One",
      });
      const custGive = await createCustomer(adapter, {
        businessId: biz.id,
        name: "Depositor Two",
      });

      // Buyer One: GAVE 500 -> net_balance = -500 (You will get 500)
      const e1 = await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: custGet.id,
        type: "GAVE",
        amount: 500,
        entryDate: "2026-10-18",
        entryTime: "09:00 AM",
        timestamp: 1000,
      });

      // Depositor Two: GOT 1200 -> net_balance = +1200 (You will give 1200)
      const oldDeletedEntry = await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: custGive.id,
        type: "GAVE",
        amount: 200,
        entryDate: "2026-09-01",
        entryTime: "10:00 AM",
        timestamp: 500,
      });
      // Soft-delete oldDeletedEntry and freeze its updated_at to 99999
      await softDeleteCustomerEntry(
        adapter,
        biz.id,
        custGive.id,
        oldDeletedEntry.id,
      );
      await adapter.runAsync(
        `UPDATE customer_entries SET updated_at = 99999 WHERE id = ?;`,
        [oldDeletedEntry.id],
      );

      await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: custGive.id,
        type: "GOT",
        amount: 1200,
        entryDate: "2026-10-18",
        entryTime: "11:00 AM",
        timestamp: 2000,
      });

      // Check Home Summary Totals
      const homeData = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
      });
      expect(homeData.summary.totalYouWillGet).toBe(500);
      expect(homeData.summary.totalYouWillGive).toBe(1200);
      expect(homeData.summary.activeCustomerCount).toBe(2);

      // Soft-delete Buyer One's entry and then UNDO it
      await softDeleteCustomerEntry(adapter, biz.id, custGet.id, e1.id);
      let afterDelete = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
        filter: "SETTLED",
      });
      expect(afterDelete.customers.map((c) => c.id)).toContain(custGet.id);

      await undoDeleteCustomerEntry(adapter, biz.id, custGet.id, e1.id);
      const afterUndo = await getCustomerById(adapter, biz.id, custGet.id);
      expect(afterUndo?.net_balance).toBe(-500);

      // Cascade soft-delete Depositor Two
      await softDeleteCustomerCascade(adapter, biz.id, custGive.id);

      const summaryAfterCascade = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
      });
      expect(summaryAfterCascade.summary.totalYouWillGive).toBe(0);
      expect(summaryAfterCascade.summary.activeCustomerCount).toBe(1);

      // Verify previously deleted entry's updated_at (99999) was NOT overwritten by cascade delete (Spec 0.2)
      const preservedOldTombstone = await getCustomerEntryById(
        adapter,
        biz.id,
        oldDeletedEntry.id,
        true,
      );
      expect(preservedOldTombstone?.updated_at).toBe(99999);
    } finally {
      close();
    }
  });
});
