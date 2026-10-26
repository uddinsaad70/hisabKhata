// apps/mobile/app/(tabs)/index.tsx
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { formatCurrency } from "../../utils/formatCurrency";
import { initializeAppDatabase } from "../../db/client";
import { type DatabaseHealthSummary } from "../../db/migrations";
import { BusinessSwitcherModal } from "../../components/BusinessSwitcherModal";

export default function HomeScreen() {
  const activeBusinessName = useUiStore((state) => state.activeBusinessName);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const activeHomeTab = useUiStore((state) => state.activeHomeTab);
  const setActiveHomeTab = useUiStore((state) => state.setActiveHomeTab);
  const themeMode = useUiStore((state) => state.themeMode);

  const colors = getThemeColors(themeMode);

  const [dbHealth, setDbHealth] = useState<DatabaseHealthSummary | null>(null);
  const [switcherVisible, setSwitcherVisible] = useState<boolean>(false);

  useEffect(() => {
    initializeAppDatabase()
      .then((summary) => setDbHealth(summary))
      .catch(() => setDbHealth(null));
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      {/* Top Royal Blue Header Container */}
      <SafeAreaView
        style={[styles.headerSafeArea, { backgroundColor: colors.primaryBlue }]}
      >
        <View style={[styles.topBar, { backgroundColor: colors.primaryBlue }]}>
          {/* Left: Business Switcher Pill Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch business"
            onPress={() => setSwitcherVisible(true)}
            style={[
              styles.businessSelector,
              { backgroundColor: colors.darkHeaderAccent },
            ]}
          >
            <View style={styles.businessIconBadge}>
              <Ionicons
                name="storefront-outline"
                size={16}
                color={colors.activeTabIndicator}
              />
            </View>
            <Text style={styles.businessNameText} numberOfLines={1}>
              {activeBusinessName}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color="#FFFFFF"
              style={styles.dropdownChevron}
            />
          </Pressable>

          {/* Right: Cloud Sync Status Indicator */}
          <View
            style={[
              styles.syncStatusPill,
              { backgroundColor: colors.darkHeaderAccent },
            ]}
          >
            <Ionicons name="cloud-done-outline" size={18} color="#FFFFFF" />
          </View>
        </View>

        {/* Header Tabs: CUSTOMERS | CASHBOOK */}
        <View
          style={[
            styles.headerTabsRow,
            { backgroundColor: colors.primaryBlue },
          ]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeHomeTab === "customers" }}
            onPress={() => setActiveHomeTab("customers")}
            style={[
              styles.headerTabButton,
              activeHomeTab === "customers" && {
                borderBottomColor: colors.activeTabIndicator,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.headerTabText,
                activeHomeTab === "customers" && styles.headerTabTextActive,
              ]}
            >
              CUSTOMERS
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeHomeTab === "cashbook" }}
            onPress={() => setActiveHomeTab("cashbook")}
            style={[
              styles.headerTabButton,
              activeHomeTab === "cashbook" && {
                borderBottomColor: colors.activeTabIndicator,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.headerTabText,
                activeHomeTab === "cashbook" && styles.headerTabTextActive,
              ]}
            >
              CASHBOOK
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {dbHealth && (
          <View
            style={[
              styles.dbStatusBadge,
              {
                backgroundColor: dbHealth.isReady
                  ? colors.lightGreenBadgeTint
                  : colors.lightPinkColumnTint,
                borderColor: dbHealth.isReady
                  ? colors.primaryGreen
                  : colors.primaryRed,
              },
            ]}
          >
            <Ionicons
              name={dbHealth.isReady ? "checkmark-circle" : "alert-circle"}
              size={16}
              color={dbHealth.isReady ? colors.primaryGreen : colors.primaryRed}
            />
            <Text
              style={[
                styles.dbStatusText,
                {
                  color: dbHealth.isReady
                    ? colors.primaryGreen
                    : colors.primaryRed,
                },
              ]}
            >
              {`SQLite v${dbHealth.userVersion} Ready • ${dbHealth.tableCount} Tables • ${dbHealth.indexCount} Indexes Active`}
            </Text>
          </View>
        )}

        {activeHomeTab === "customers" ? (
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.cardSurface,
                borderColor: colors.borderDivider,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons
                name="people-outline"
                size={20}
                color={colors.primaryBlue}
              />
              <Text
                style={[styles.sectionTitle, { color: colors.primaryTextDark }]}
              >
                Customers Ledger View
              </Text>
            </View>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: colors.secondaryMutedText },
              ]}
            >
              Summary card, live search, filters, and customer list will connect
              here in CP06.
            </Text>

            <View
              style={[
                styles.summaryPreviewRow,
                { borderTopColor: colors.borderDivider },
              ]}
            >
              <View style={styles.summaryColumn}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  You will give
                </Text>
                <Text
                  style={[styles.summaryAmount, { color: colors.primaryGreen }]}
                >
                  {formatCurrency(0, activeBusinessCurrency)}
                </Text>
              </View>

              <View
                style={[
                  styles.verticalDivider,
                  { backgroundColor: colors.borderDivider },
                ]}
              />

              <View style={styles.summaryColumn}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  You will get
                </Text>
                <Text
                  style={[styles.summaryAmount, { color: colors.primaryRed }]}
                >
                  {formatCurrency(0, activeBusinessCurrency)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.cardSurface,
                borderColor: colors.borderDivider,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons
                name="wallet-outline"
                size={20}
                color={colors.primaryBlue}
              />
              <Text
                style={[styles.sectionTitle, { color: colors.primaryTextDark }]}
              >
                Cashbook View
              </Text>
            </View>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: colors.secondaryMutedText },
              ]}
            >
              Total Balance, Today&apos;s Balance, Cash in Hand / Online split,
              and daily entries will connect here in CP11.
            </Text>

            <View
              style={[
                styles.summaryPreviewRow,
                { borderTopColor: colors.borderDivider },
              ]}
            >
              <View style={styles.summaryColumn}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  Total Balance
                </Text>
                <Text
                  style={[
                    styles.summaryAmount,
                    { color: colors.primaryTextDark },
                  ]}
                >
                  {formatCurrency(0, activeBusinessCurrency)}
                </Text>
              </View>

              <View
                style={[
                  styles.verticalDivider,
                  { backgroundColor: colors.borderDivider },
                ]}
              />

              <View style={styles.summaryColumn}>
                <Text
                  style={[
                    styles.summaryLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  Today&apos;s Balance
                </Text>
                <Text
                  style={[styles.summaryAmount, { color: colors.primaryGreen }]}
                >
                  {formatCurrency(0, activeBusinessCurrency)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
      <BusinessSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafeArea: {
    paddingTop:
      Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) : 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  businessSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: "78%",
  },
  businessIconBadge: {
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  businessNameText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    paddingRight: 2,
  },
  dropdownChevron: {
    marginLeft: 4,
  },
  syncStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTabsRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  headerTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  headerTabText: {
    width: "100%",
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.72)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  headerTabTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  dbStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  dbStatusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
  },
  summaryPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  summaryColumn: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  verticalDivider: {
    width: 1,
    height: 40,
  },
  summaryLabel: {
    width: "100%",
    textAlign: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginBottom: 4,
  },
  summaryAmount: {
    width: "100%",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    fontSize: 19,
  },
});
