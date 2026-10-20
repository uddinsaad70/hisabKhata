// apps/mobile/app/(tabs)/index.tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, getThemeColors } from "../../constants/theme";
import { useUiStore } from "../../store/uiStore";
import { formatCurrency } from "../../utils/formatCurrency";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const activeBusinessName = useUiStore((state) => state.activeBusinessName);
  const activeHomeTab = useUiStore((state) => state.activeHomeTab);
  const setActiveHomeTab = useUiStore((state) => state.setActiveHomeTab);
  const themeMode = useUiStore((state) => state.themeMode);
  const theme = getThemeColors(themeMode);

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.pageBackgroundGrey }]}
    >
      {/* Top App Bar & Header Tabs (Section 2.1.1 & 2.1.2) */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: theme.primaryBlue,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        {/* Top Row: Ledger Icon + Business Switcher Pill on Left, Sync Status Icon on Right */}
        <View style={styles.topAppBarRow}>
          <Pressable
            style={styles.businessSelectorPill}
            accessibilityRole="button"
            accessibilityLabel="Switch business"
          >
            <Text style={styles.bookIcon}>📒</Text>
            <Text style={styles.businessNameText} numberOfLines={1}>
              {activeBusinessName}
            </Text>
            <Text style={styles.dropdownChevron}>⌄</Text>
          </Pressable>

          <View style={styles.syncStatusBadge}>
            <Text style={styles.syncStatusIcon}>☁️✓</Text>
          </View>
        </View>

        {/* Main Header Tabs: CUSTOMERS | CASHBOOK with #FFC107 Active Indicator */}
        <View style={styles.headerTabsRow}>
          <Pressable
            style={[
              styles.headerTabButton,
              activeHomeTab === "customers" && styles.headerTabButtonActive,
            ]}
            onPress={() => setActiveHomeTab("customers")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeHomeTab === "customers" }}
          >
            <Text
              style={[
                styles.headerTabText,
                activeHomeTab === "customers" && styles.headerTabTextActive,
              ]}
            >
              CUSTOMERS
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.headerTabButton,
              activeHomeTab === "cashbook" && styles.headerTabButtonActive,
            ]}
            onPress={() => setActiveHomeTab("cashbook")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeHomeTab === "cashbook" }}
          >
            <Text
              style={[
                styles.headerTabText,
                activeHomeTab === "cashbook" && styles.headerTabTextActive,
              ]}
            >
              CASHBOOK
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Content Area: Switches instantly between CUSTOMERS and CASHBOOK views */}
      <View style={styles.contentArea}>
        {activeHomeTab === "customers" ? (
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.cardSurface,
                borderColor: theme.borderDivider,
              },
            ]}
          >
            <Text
              style={[styles.previewTitle, { color: theme.primaryTextDark }]}
            >
              Customers Ledger View
            </Text>
            <Text
              style={[
                styles.previewSubtitle,
                { color: theme.secondaryMutedText },
              ]}
            >
              Summary card, live search, filters, and customer list will connect
              here in CP06.
            </Text>
            <View style={styles.sampleBalanceRow}>
              <View style={styles.sampleBalanceCol}>
                <Text
                  style={[
                    styles.sampleLabel,
                    { color: theme.secondaryMutedText },
                  ]}
                >
                  You will give
                </Text>
                <Text
                  style={[styles.sampleAmount, { color: COLORS.primaryGreen }]}
                >
                  {formatCurrency(0, "BDT")}
                </Text>
              </View>
              <View
                style={[
                  styles.verticalDivider,
                  { backgroundColor: theme.borderDivider },
                ]}
              />
              <View style={styles.sampleBalanceCol}>
                <Text
                  style={[
                    styles.sampleLabel,
                    { color: theme.secondaryMutedText },
                  ]}
                >
                  You will get
                </Text>
                <Text
                  style={[styles.sampleAmount, { color: COLORS.primaryRed }]}
                >
                  {formatCurrency(0, "BDT")}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.cardSurface,
                borderColor: theme.borderDivider,
              },
            ]}
          >
            <Text
              style={[styles.previewTitle, { color: theme.primaryTextDark }]}
            >
              Cashbook View
            </Text>
            <Text
              style={[
                styles.previewSubtitle,
                { color: theme.secondaryMutedText },
              ]}
            >
              Daily Cash in Hand, Online balance split, and IN/OUT entries will
              connect here in CP11.
            </Text>
            <View style={styles.sampleBalanceRow}>
              <View style={styles.sampleBalanceCol}>
                <Text
                  style={[
                    styles.sampleLabel,
                    { color: theme.secondaryMutedText },
                  ]}
                >
                  Total Balance
                </Text>
                <Text
                  style={[
                    styles.sampleAmount,
                    { color: theme.primaryTextDark },
                  ]}
                >
                  {formatCurrency(0, "BDT")}
                </Text>
              </View>
              <View
                style={[
                  styles.verticalDivider,
                  { backgroundColor: theme.borderDivider },
                ]}
              />
              <View style={styles.sampleBalanceCol}>
                <Text
                  style={[
                    styles.sampleLabel,
                    { color: theme.secondaryMutedText },
                  ]}
                >
                  {"Today's Balance"}
                </Text>
                <Text
                  style={[styles.sampleAmount, { color: COLORS.primaryGreen }]}
                >
                  {formatCurrency(0, "BDT")}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  topAppBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  businessSelectorPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.darkHeaderAccent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    maxWidth: "78%",
  },
  bookIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  businessNameText: {
    color: COLORS.cardSurface,
    fontSize: 15,
    fontWeight: "700",
    marginRight: 6,
  },
  dropdownChevron: {
    color: COLORS.cardSurface,
    fontSize: 14,
    fontWeight: "700",
  },
  syncStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.darkHeaderAccent,
  },
  syncStatusIcon: {
    color: COLORS.cardSurface,
    fontSize: 13,
    fontWeight: "600",
  },
  headerTabsRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  headerTabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  headerTabButtonActive: {
    borderBottomColor: COLORS.activeTabIndicator,
  },
  headerTabText: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  headerTabTextActive: {
    color: COLORS.cardSurface,
  },
  contentArea: {
    flex: 1,
    padding: 16,
  },
  previewCard: {
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  previewSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  sampleBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(107, 114, 128, 0.2)",
  },
  sampleBalanceCol: {
    flex: 1,
    alignItems: "center",
  },
  verticalDivider: {
    width: 1,
    height: 36,
  },
  sampleLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  sampleAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
});
