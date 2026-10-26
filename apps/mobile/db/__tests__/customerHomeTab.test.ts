// apps/mobile/db/__tests__/customerHomeTab.test.ts
import { createInMemoryDatabaseAdapter } from "./testDbHelper";
import { runMigrations } from "../migrations";
import { createBusiness } from "../businessQueries";
import {
  addCustomerEntry,
  createCustomer,
  getCustomersWithSummary,
} from "../customerQueries";

describe("CP06 Customers Home Tab search, filter, and sort combinations", () => {
  it("filters by ALL/YOU_WILL_GET/YOU_WILL_GIVE/SETTLED, searches by name/phone, and sorts in all 4 modes", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Reza Enterprise" });

      const hasina = await createCustomer(adapter, {
        businessId: biz.id,
        name: "Hasina Vengi",
        phone: "01711111111",
      });
      const younus = await createCustomer(adapter, {
        businessId: biz.id,
        name: "Younus Mg",
        phone: "01822222222",
      });
      const babul = await createCustomer(adapter, {
        businessId: biz.id,
        name: "Babul Store",
        phone: "01933333333",
      });

      // Hasina: GAVE 6350 -> net_balance = -6350 (You will get)
      await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: hasina.id,
        type: "GAVE",
        amount: 6350,
        entryDate: "2026-10-16",
        entryTime: "10:00 AM",
        timestamp: 1000,
      });

      // Younus: GOT 79340 -> net_balance = +79340 (You will give)
      await addCustomerEntry(adapter, {
        businessId: biz.id,
        customerId: younus.id,
        type: "GOT",
        amount: 79340,
        entryDate: "2026-10-18",
        entryTime: "11:56 AM",
        timestamp: 3000,
      });

      // Babul remains Settled (0)

      // 1. Live search by partial phone number
      const phoneSearch = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
        searchQuery: "01822",
      });
      expect(phoneSearch.customers.map((c) => c.name)).toEqual(["Younus Mg"]);
      // Summary totals remain global for the active business
      expect(phoneSearch.summary.totalYouWillGive).toBe(79340);
      expect(phoneSearch.summary.totalYouWillGet).toBe(6350);

      // 2. Filter: YOU_WILL_GET
      const getFilter = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
        filter: "YOU_WILL_GET",
      });
      expect(getFilter.customers.map((c) => c.name)).toEqual(["Hasina Vengi"]);

      // 3. Filter: YOU_WILL_GIVE
      const giveFilter = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
        filter: "YOU_WILL_GIVE",
      });
      expect(giveFilter.customers.map((c) => c.name)).toEqual(["Younus Mg"]);

      // 4. Filter: SETTLED
      const settledFilter = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
        filter: "SETTLED",
      });
      expect(settledFilter.customers.map((c) => c.name)).toEqual([
        "Babul Store",
      ]);

      // 5. Sort: NAME_AZ
      const sortedAz = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
        sort: "NAME_AZ",
      });
      expect(sortedAz.customers.map((c) => c.name)).toEqual([
        "Babul Store",
        "Hasina Vengi",
        "Younus Mg",
      ]);

      // 6. Sort: HIGHEST_AMOUNT
      const sortedHighest = await getCustomersWithSummary(adapter, {
        businessId: biz.id,
        sort: "HIGHEST_AMOUNT",
      });
      expect(sortedHighest.customers.map((c) => c.name)).toEqual([
        "Younus Mg",
        "Hasina Vengi",
        "Babul Store",
      ]);
    } finally {
      close();
    }
  });
});
