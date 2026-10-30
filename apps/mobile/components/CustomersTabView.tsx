// apps/mobile/components/CustomersTabView.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { formatCurrency } from "../utils/formatCurrency";
import { getDbAdapter } from "../db/client";
import {
  getCustomersWithSummary,
  type CustomerRow,
  type CustomersHomeSummary,
} from "../db/customerQueries";
import { CustomerRowItem } from "./CustomerRowItem";
import { CustomerFilterModal } from "./CustomerFilterModal";
import { getStrings } from "../constants/translations";

export function CustomersTabView() {
  const router = useRouter();

  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const customerSearchQuery = useUiStore((state) => state.customerSearchQuery);
  const customerFilter = useUiStore((state) => state.customerFilter);
  const customerSort = useUiStore((state) => state.customerSort);
  const setCustomerSearchQuery = useUiStore(
    (state) => state.setCustomerSearchQuery,
  );
  const themeMode = useUiStore((state) => state.themeMode);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);

  const colors = getThemeColors(themeMode);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [summary, setSummary] = useState<CustomersHomeSummary>({
    totalYouWillGive: 0,
    totalYouWillGet: 0,
    activeCustomerCount: 0,
  });
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);

  const loadCustomersData = useCallback(async () => {
    if (!activeBusinessId || Platform.OS === "web") {
      setCustomers([]);
      setSummary({
        totalYouWillGive: 0,
        totalYouWillGet: 0,
        activeCustomerCount: 0,
      });
      return;
    }

    try {
      const db = getDbAdapter();
      const result = await getCustomersWithSummary(db, {
        businessId: activeBusinessId,
        searchQuery: customerSearchQuery,
        filter: customerFilter,
        sort: customerSort,
      });
      setCustomers(result.customers);
      setSummary(result.summary);
    } catch {
      // Ignore transient query errors before DB initialization completes
    }
  }, [activeBusinessId, customerSearchQuery, customerFilter, customerSort]);

  useEffect(() => {
    void loadCustomersData();
  }, [loadCustomersData]);

  useFocusEffect(
    useCallback(() => {
      void loadCustomersData();
    }, [loadCustomersData]),
  );

  const hasActiveFilterOrSort =
    customerFilter !== "ALL" || customerSort !== "MOST_RECENT";

  const handleOpenCustomer = (customer: CustomerRow) => {
    router.push(`/customer/${customer.id}` as never);
  };

  const handleAddCustomer = () => {
    router.push("/customer/add" as never);
  };

  const handleViewAllReports = () => {
    router.push("/customer/report" as never);
  };

  return (
    <View style={styles.container}>
      {/* 1. Top Floating White Summary Card (Specification Section 2.1.3) */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.cardSurface,
            borderColor: colors.borderDivider,
          },
        ]}
      >
        <View style={styles.summaryTopColumns}>
          {/* Left Column: You will give (Green #108944) */}
          <View style={styles.summaryColumn}>
            <Text
              style={[
                styles.summaryLabel,
                { color: colors.secondaryMutedText },
              ]}
            >
              {t.youWillGive}
            </Text>
            <Text
              style={[styles.summaryAmount, { color: colors.primaryGreen }]}
            >
              {formatCurrency(summary.totalYouWillGive, activeBusinessCurrency)}
            </Text>
          </View>

          <View
            style={[
              styles.verticalDivider,
              { backgroundColor: colors.borderDivider },
            ]}
          />

          {/* Right Column: You will get (Red #C91C42) */}
          <View style={styles.summaryColumn}>
            <Text
              style={[
                styles.summaryLabel,
                { color: colors.secondaryMutedText },
              ]}
            >
              {t.youWillGet}
            </Text>
            <Text style={[styles.summaryAmount, { color: colors.primaryRed }]}>
              {formatCurrency(summary.totalYouWillGet, activeBusinessCurrency)}
            </Text>
          </View>
        </View>

        {/* Bottom Horizontal Divider + View Reports Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all customers report"
          onPress={handleViewAllReports}
          style={[
            styles.viewReportsRow,
            { borderTopColor: colors.borderDivider },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={colors.primaryBlue}
          />
          <Text style={[styles.viewReportsText, { color: colors.primaryBlue }]}>
            {t.viewReports}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={15}
            color={colors.primaryBlue}
          />
        </Pressable>
      </View>

      {/* 2. Search (~75%) & Filter (~25%) Row (Specification Section 2.1.4) */}
      <View style={styles.searchFilterRow}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.cardSurface,
              borderColor: searchFocused
                ? colors.primaryBlue
                : colors.borderDivider,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={
              searchFocused ? colors.primaryBlue : colors.secondaryMutedText
            }
          />
          <TextInput
            value={customerSearchQuery}
            onChangeText={setCustomerSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={
              searchFocused ? t.searchFocusedPlaceholder : t.searchCustomer
            }
            placeholderTextColor={colors.secondaryMutedText}
            style={[styles.searchInput, { color: colors.primaryTextDark }]}
          />
          {customerSearchQuery.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear customer search"
              onPress={() => setCustomerSearchQuery("")}
              hitSlop={8}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.secondaryMutedText}
              />
            </Pressable>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open customer filters"
          onPress={() => setFilterModalVisible(true)}
          style={[
            styles.filterButton,
            {
              backgroundColor: hasActiveFilterOrSort
                ? colors.primaryBlue
                : colors.cardSurface,
              borderColor: hasActiveFilterOrSort
                ? colors.primaryBlue
                : colors.borderDivider,
            },
          ]}
        >
          <Ionicons
            name="filter-outline"
            size={16}
            color={hasActiveFilterOrSort ? "#FFFFFF" : colors.primaryBlue}
          />
          <Text
            style={[
              styles.filterButtonText,
              {
                color: hasActiveFilterOrSort ? "#FFFFFF" : colors.primaryBlue,
              },
            ]}
          >
            {t.filters}
          </Text>
        </Pressable>
      </View>

      {/* 3. Customer List using @shopify/flash-list or Visual Empty State */}
      <View
        style={[
          styles.listCardWrapper,
          {
            backgroundColor: colors.cardSurface,
            borderColor: colors.borderDivider,
          },
        ]}
      >
        {customers.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.pageBackgroundGrey },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={34}
                color={colors.primaryBlue}
              />
            </View>
            <Text
              style={[styles.emptyTitle, { color: colors.primaryTextDark }]}
            >
              {summary.activeCustomerCount === 0
                ? t.noCustomersYetTitle
                : t.noMatchingCustomersTitle}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.secondaryMutedText },
              ]}
            >
              {summary.activeCustomerCount === 0
                ? t.noCustomersYetSubtitle
                : t.noMatchingCustomersSubtitle}
            </Text>
          </View>
        ) : (
          <FlashList
            data={customers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContentContainer}
            renderItem={({ item }) => (
              <CustomerRowItem
                customer={item}
                currency={activeBusinessCurrency}
                themeMode={themeMode}
                onPress={handleOpenCustomer}
              />
            )}
          />
        )}
      </View>

      {/* 4. Floating Action Button: + ADD CUSTOMER (#B8144D) (Specification Section 2.1.6) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add Customer"
        onPress={handleAddCustomer}
        style={({ pressed }) => [
          styles.fabButton,
          {
            backgroundColor: colors.fabMagenta,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Ionicons name="person-add" size={18} color="#FFFFFF" />
        <Text style={styles.fabButtonText}>{t.addCustomerBtn}</Text>
      </Pressable>
      {/* Filter & Sort Bottom Sheet Modal */}
      <CustomerFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingTop: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  summaryTopColumns: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  summaryColumn: {
    flex: 1,
    alignItems: "center",
  },
  verticalDivider: {
    width: 1,
    height: 38,
  },
  summaryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginBottom: 4,
  },
  summaryAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  viewReportsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  viewReportsText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchBox: {
    flex: 3,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 0,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  filterButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  listCardWrapper: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  listContentContainer: {
    paddingBottom: 84,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  fabButton: {
    position: "absolute",
    right: 4,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 28,
    gap: 8,
    elevation: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
  fabButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
