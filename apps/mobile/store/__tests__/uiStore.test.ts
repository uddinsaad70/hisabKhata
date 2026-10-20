// apps/mobile/store/__tests__/uiStore.test.ts
import { useUiStore } from "../uiStore";

describe("Zustand UI Store (store/uiStore.ts)", () => {
  beforeEach(() => {
    // Reset store to initial clean state before each test
    useUiStore.setState({
      activeBusinessId: null,
      activeBusinessName: "My Business",
      activeHomeTab: "customers",
      customerSearchQuery: "",
      customerFilter: "ALL",
      customerSort: "MOST_RECENT",
      themeMode: "light",
      undoSnackbar: {
        visible: false,
        entryId: null,
        entryDomain: null,
        customerId: null,
        message: "Entry Deleted",
      },
    });
  });

  it("switches activeHomeTab between customers and cashbook", () => {
    expect(useUiStore.getState().activeHomeTab).toBe("customers");

    useUiStore.getState().setActiveHomeTab("cashbook");
    expect(useUiStore.getState().activeHomeTab).toBe("cashbook");

    useUiStore.getState().setActiveHomeTab("customers");
    expect(useUiStore.getState().activeHomeTab).toBe("customers");
  });

  it("updates and resets customer search, filter, and sort states", () => {
    const store = useUiStore.getState();
    store.setCustomerSearchQuery("Younus");
    store.setCustomerFilter("YOU_WILL_GET");
    store.setCustomerSort("HIGHEST_AMOUNT");

    expect(useUiStore.getState().customerSearchQuery).toBe("Younus");
    expect(useUiStore.getState().customerFilter).toBe("YOU_WILL_GET");
    expect(useUiStore.getState().customerSort).toBe("HIGHEST_AMOUNT");

    useUiStore.getState().resetCustomerFilters();
    expect(useUiStore.getState().customerSearchQuery).toBe("");
    expect(useUiStore.getState().customerFilter).toBe("ALL");
    expect(useUiStore.getState().customerSort).toBe("MOST_RECENT");
  });

  it("triggers and hides the 5-second undo snackbar state", () => {
    useUiStore.getState().showUndoSnackbar({
      entryId: "0192a8b3-3333-7000-8000-000000000003",
      entryDomain: "customer",
      customerId: "0192a8b2-2222-7000-8000-000000000002",
    });

    const activeSnack = useUiStore.getState().undoSnackbar;
    expect(activeSnack.visible).toBe(true);
    expect(activeSnack.entryId).toBe("0192a8b3-3333-7000-8000-000000000003");
    expect(activeSnack.entryDomain).toBe("customer");
    expect(activeSnack.customerId).toBe("0192a8b2-2222-7000-8000-000000000002");

    useUiStore.getState().hideUndoSnackbar();
    expect(useUiStore.getState().undoSnackbar.visible).toBe(false);
    expect(useUiStore.getState().undoSnackbar.entryId).toBeNull();
  });

  it("toggles themeMode between light and dark", () => {
    expect(useUiStore.getState().themeMode).toBe("light");

    useUiStore.getState().toggleThemeMode();
    expect(useUiStore.getState().themeMode).toBe("dark");

    useUiStore.getState().toggleThemeMode();
    expect(useUiStore.getState().themeMode).toBe("light");
  });
});
