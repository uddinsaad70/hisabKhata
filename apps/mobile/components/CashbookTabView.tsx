// apps/mobile/components/CashbookTabView.tsx
import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  DeviceEventEmitter,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { getDbAdapter } from "../db/client";
import { formatCurrency } from "../utils/formatCurrency";
import { getLocalDateString } from "../utils/dateUtils";
import {
  getCashbookDashboardSummary,
  getAllCashbookEntries,
  type CashbookDashboardSummary,
  type CashbookEntryRow,
} from "../db/cashbookQueries";
import { CashbookRowItem } from "./CashbookRowItem";
import { UndoSnackbar } from "./UndoSnackbar";
import { getStrings } from "../constants/translations";

export function CashbookTabView() {
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const currency = useUiStore((state) => state.activeBusinessCurrency);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  const [summary, setSummary] = useState<CashbookDashboardSummary | null>(null);
  const [allEntries, setAllEntries] = useState<CashbookEntryRow[]>([]);
  const [dailyTotals, setDailyTotals] = useState<
    Record<string, { in: number; out: number; count: number }>
  >({});

  const loadDashboard = useCallback(async () => {
    if (!activeBusinessId) return;
    try {
      const db = await getDbAdapter();
      const today = getLocalDateString(new Date());

      const dashSummary = await getCashbookDashboardSummary(
        db,
        activeBusinessId,
        today,
      );
      setSummary(dashSummary);

      const entries = await getAllCashbookEntries(db, activeBusinessId);
      setAllEntries(entries);

      // Calculate daily groupings
      const totals: Record<string, { in: number; out: number; count: number }> =
        {};
      entries.forEach((e) => {
        if (!totals[e.entry_date])
          totals[e.entry_date] = { in: 0, out: 0, count: 0 };
        totals[e.entry_date].count += 1;
        if (e.type === "IN") totals[e.entry_date].in += e.amount;
        else totals[e.entry_date].out += e.amount;
      });
      setDailyTotals(totals);
    } catch (err) {
      console.error("Failed to load cashbook dashboard:", err);
    }
  }, [activeBusinessId]);

  // Add Refresh Listener
  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
      const sub1 = DeviceEventEmitter.addListener("REFRESH_CASHBOOK", () => {
        void loadDashboard();
      });
      const sub2 = DeviceEventEmitter.addListener("SYNC_COMPLETED", () => {
        void loadDashboard();
      });
      const sub3 = DeviceEventEmitter.addListener("WORKSPACE_RESET", () => {
        void loadDashboard();
      });
      return () => {
        sub1.remove();
        sub2.remove();
        sub3.remove();
      };
    }, [loadDashboard]),
  );

  return (
    <View style={styles.root}>
      <View style={styles.scrollContent}>
        {/* Side-by-Side Cards (Total & Today) */}
        <View style={styles.cardsRow}>
          {/* Total Balance Card */}
          <View
            style={[
              styles.halfCard,
              {
                backgroundColor: colors.cardSurface,
                borderColor: colors.borderDivider,
              },
            ]}
          >
            <Text
              style={[styles.cardTitle, { color: colors.secondaryMutedText }]}
            >
              {t.totalBalance}
            </Text>
            <Text
              style={[
                styles.mainAmount,
                {
                  color:
                    (summary?.total_balance || 0) >= 0
                      ? colors.primaryGreen
                      : colors.primaryRed,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(summary?.total_balance || 0, currency, true)}
            </Text>
            <View
              style={[
                styles.splitRow,
                { borderTopColor: colors.borderDivider },
              ]}
            >
              <View style={styles.splitCol}>
                <Text
                  style={[
                    styles.splitLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.cashInHand}
                </Text>
                <Text
                  style={[styles.splitValue, { color: colors.primaryTextDark }]}
                >
                  {formatCurrency(summary?.total_cash || 0, currency, false)}
                </Text>
              </View>
              <View style={styles.splitCol}>
                <Text
                  style={[
                    styles.splitLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.online}
                </Text>
                <Text
                  style={[styles.splitValue, { color: colors.primaryTextDark }]}
                >
                  {formatCurrency(summary?.total_online || 0, currency, false)}
                </Text>
              </View>
            </View>
          </View>

          {/* Today's Balance Card */}
          <View
            style={[
              styles.halfCard,
              {
                backgroundColor: colors.cardSurface,
                borderColor: colors.borderDivider,
              },
            ]}
          >
            <Text
              style={[styles.cardTitle, { color: colors.secondaryMutedText }]}
            >
              {t.todaysBalance}
            </Text>
            <Text
              style={[
                styles.mainAmount,
                {
                  color:
                    (summary?.today_balance || 0) >= 0
                      ? colors.primaryGreen
                      : colors.primaryRed,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(summary?.today_balance || 0, currency, true)}
            </Text>
            <View
              style={[
                styles.splitRow,
                { borderTopColor: colors.borderDivider },
              ]}
            >
              <View style={styles.splitCol}>
                <Text
                  style={[
                    styles.splitLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.cashInHand}
                </Text>
                <Text
                  style={[styles.splitValue, { color: colors.primaryTextDark }]}
                >
                  {formatCurrency(summary?.today_cash || 0, currency, false)}
                </Text>
              </View>
              <View style={styles.splitCol}>
                <Text
                  style={[
                    styles.splitLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.online}
                </Text>
                <Text
                  style={[styles.splitValue, { color: colors.primaryTextDark }]}
                >
                  {formatCurrency(summary?.today_online || 0, currency, false)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => router.push("/cashbook/report" as never)}
          style={styles.reportBtnMain}
        >
          <Ionicons
            name="document-text-outline"
            size={16}
            color={colors.primaryBlue}
          />
          <Text
            style={[styles.reportBtnMainText, { color: colors.primaryBlue }]}
          >
            {t.viewCashbookReport}
          </Text>
        </Pressable>

        {/* 3-Column Sticky Header */}
        <View
          style={[
            styles.columnHeader,
            {
              backgroundColor: colors.cardSurface,
              borderBottomColor: colors.borderDivider,
            },
          ]}
        >
          <View style={styles.colEntriesHeader}>
            <Text
              style={[
                styles.colHeaderText,
                { color: colors.secondaryMutedText },
              ]}
            >
              {t.entriesHeader}
            </Text>
          </View>
          <View
            style={[
              styles.colOutHeader,
              { backgroundColor: colors.lightPinkColumnTint },
            ]}
          >
            <Text
              style={[
                styles.colHeaderText,
                { color: colors.secondaryMutedText },
              ]}
            >
              {t.outHeader}
            </Text>
          </View>
          <View style={styles.colInHeader}>
            <Text
              style={[
                styles.colHeaderText,
                { color: colors.secondaryMutedText },
              ]}
            >
              {t.inHeader}
            </Text>
          </View>
        </View>

        {/* Entries List */}
        <View style={{ flex: 1 }}>
          <FlashList
            data={allEntries}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => {
              const showDateHeader =
                index === 0 ||
                allEntries[index - 1].entry_date !== item.entry_date;
              const dTotals = dailyTotals[item.entry_date];

              return (
                <View>
                  {showDateHeader && (
                    <View
                      style={[
                        styles.dateHeaderRow,
                        {
                          backgroundColor: colors.pageBackgroundGrey,
                          borderBottomColor: colors.borderDivider,
                        },
                      ]}
                    >
                      <View style={styles.colEntriesHeader}>
                        <Text
                          style={[
                            styles.dateHeaderText,
                            { color: colors.primaryTextDark },
                          ]}
                        >
                          {item.entry_date}
                        </Text>
                        <Text
                          style={[
                            styles.dateCountText,
                            { color: colors.secondaryMutedText },
                          ]}
                        >
                          {dTotals?.count || 0} {t.entriesCountLabel}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.colOutHeader,
                          { backgroundColor: colors.pageBackgroundGrey },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateTotalText,
                            { color: colors.primaryRed },
                          ]}
                        >
                          {formatCurrency(dTotals?.out || 0, currency, true)}
                        </Text>
                      </View>
                      <View style={styles.colInHeader}>
                        <Text
                          style={[
                            styles.dateTotalText,
                            { color: colors.primaryGreen },
                          ]}
                        >
                          {formatCurrency(dTotals?.in || 0, currency, true)}
                        </Text>
                      </View>
                    </View>
                  )}
                  <CashbookRowItem
                    entry={item}
                    currency={currency}
                    onPress={() =>
                      router.push(`/cashbook/entry/${item.id}` as never)
                    }
                  />
                </View>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text
                  style={[
                    styles.emptyText,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.noEntriesFound}
                </Text>
              </View>
            )}
          />
        </View>
      </View>

      {/* Bottom Sticky Action Buttons */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.cardSurface,
            borderTopColor: colors.borderDivider,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push(`/cashbook/entry-form?type=OUT` as never)}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryRed, marginRight: 6 },
          ]}
        >
          <Text style={styles.actionBtnText}>{t.btnOut}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/cashbook/entry-form?type=IN` as never)}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryGreen, marginLeft: 6 },
          ]}
        >
          <Text style={styles.actionBtnText}>{t.btnIn}</Text>
        </Pressable>
      </View>
      <UndoSnackbar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flex: 1 },
  cardsRow: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 0 },
  halfCard: { flex: 1, borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  cardTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    textAlign: "center",
    paddingTop: 12,
    paddingBottom: 4,
  },
  mainAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    textAlign: "center",
    paddingBottom: 12,
  },
  splitRow: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 8 },
  splitCol: { flex: 1, alignItems: "center" },
  splitLabel: { fontFamily: "Inter_400Regular", fontSize: 9, marginBottom: 2 },
  splitValue: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  reportBtnMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 12,
    gap: 6,
  },
  reportBtnMainText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  columnHeader: { flexDirection: "row", borderBottomWidth: 1 },
  colHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    textAlign: "right",
  },
  colEntriesHeader: { flex: 2, alignItems: "flex-start" },
  colOutHeader: { flex: 1, alignItems: "flex-end" },
  colInHeader: { flex: 1, alignItems: "flex-end" },
  dateHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  dateHeaderText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    marginBottom: 2,
  },
  dateCountText: { fontFamily: "Inter_500Medium", fontSize: 10 },
  dateTotalText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  bottomBar: { flexDirection: "row", padding: 12, borderTopWidth: 1 },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
