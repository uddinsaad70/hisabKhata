// apps/mobile/components/CashbookTabView.tsx
import React, { useCallback, useState, useRef, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  DeviceEventEmitter,
  Platform,
  Alert,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { getDbAdapter } from "../db/client";
import { formatCurrency, formatSignedCurrency } from "../utils/formatCurrency";
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
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
const flashListRef = useRef<FlashListRef<CashbookEntryRow> | null>(null);
  const prevTopEntryIdRef = useRef<string | null>(null);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const isScrolledDownRef = useRef(false);

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
      const newestId = entries[0]?.id ?? null;
      const shouldScrollTop =
        prevTopEntryIdRef.current !== null &&
        newestId !== null &&
        newestId !== prevTopEntryIdRef.current;
      prevTopEntryIdRef.current = newestId;

      setAllEntries(entries);

      if (shouldScrollTop) {
        setTimeout(() => {
          flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 150);
      }

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

  const handleOpenDatePicker = (dateStr: string) => {
    const parsed = new Date(`${dateStr}T00:00:00`);
    setPickerDate(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    setShowCalendarPicker(true);
  };

// Prepend virtual sticky header item at index 0 so ENTRIES | OUT | IN sticks at the top while cards scroll away
  const listDataWithStickyHeader = useMemo<CashbookEntryRow[]>(() => {
    const stickyHeaderSentinel: CashbookEntryRow = {
      id: "__STICKY_TABLE_HEADER__",
      business_id: activeBusinessId || "",
      type: "IN",
      payment_mode: "CASH",
      amount: 0,
      details: null,
      entry_date: "",
      entry_time: "",
      timestamp: 0,
      is_deleted: 0,
      is_synced: 1,
      created_at: 0,
      updated_at: 0,
    };
    return [stickyHeaderSentinel, ...allEntries];
  }, [allEntries, activeBusinessId]);

  const handleDateSelected = (selectedDate: Date) => {
    setPickerDate(selectedDate);
    const targetDateStr = getLocalDateString(selectedDate);

    const foundIndex = allEntries.findIndex(
      (entry) => entry.entry_date === targetDateStr,
    );

    if (foundIndex !== -1 && flashListRef.current) {
      try {
        // +1 because index 0 is the sticky table header
        flashListRef.current.scrollToIndex({
          index: foundIndex + 1,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        // Ignore if layout measurement is still pending
      }
    } else {
      Alert.alert(
        language === "bn" ? "কোনো লেনদেন নেই" : "No Transactions",
        language === "bn"
          ? `${targetDateStr} তারিখে ক্যাশবুকে কোনো লেনদেন পাওয়া যায়নি।`
          : `No cashbook entries found on ${targetDateStr}.`,
      );
    }
  };

  return (
    <View style={styles.root}>
<View style={styles.scrollContent}>
        <FlashList
          ref={flashListRef}
          data={listDataWithStickyHeader}
          extraData={isScrolledDown}
          keyExtractor={(item) => item.id}
          stickyHeaderIndices={[0]}
          contentContainerStyle={{ paddingBottom: 70 }}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            if (y > 135 && !isScrolledDownRef.current) {
              isScrolledDownRef.current = true;
              setIsScrolledDown(true);
            } else if (y <= 115 && isScrolledDownRef.current) {
              isScrolledDownRef.current = false;
              setIsScrolledDown(false);
            }
          }}
          scrollEventThrottle={16}
          getItemType={(item) =>
            item.id === "__STICKY_TABLE_HEADER__" ? "stickyHeader" : "row"
          }
ListHeaderComponent={
            <View>
              {/* Side-by-Side Cards (Total & Today) — Enlarged to fill top void */}
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
                    style={[
                      styles.cardTitle,
                      { color: colors.secondaryMutedText },
                    ]}
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
                    {formatSignedCurrency(
                      summary?.total_balance || 0,
                      currency,
                    )}
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
                        style={[
                          styles.splitValue,
                          { color: colors.primaryTextDark },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatSignedCurrency(
                          summary?.total_cash || 0,
                          currency,
                        )}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.splitVerticalDivider,
                        { backgroundColor: colors.borderDivider },
                      ]}
                    />
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
                        style={[
                          styles.splitValue,
                          { color: colors.primaryTextDark },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatSignedCurrency(
                          summary?.total_online || 0,
                          currency,
                        )}
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
                    style={[
                      styles.cardTitle,
                      { color: colors.secondaryMutedText },
                    ]}
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
                    {formatSignedCurrency(
                      summary?.today_balance || 0,
                      currency,
                    )}
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
                        style={[
                          styles.splitValue,
                          { color: colors.primaryTextDark },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatSignedCurrency(
                          summary?.today_cash || 0,
                          currency,
                        )}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.splitVerticalDivider,
                        { backgroundColor: colors.borderDivider },
                      ]}
                    />
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
                        style={[
                          styles.splitValue,
                          { color: colors.primaryTextDark },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {formatSignedCurrency(
                          summary?.today_online || 0,
                          currency,
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => router.push("/cashbook/report" as never)}
                style={({ pressed }) => [
                  styles.reportBtnMain,
                  {
                    backgroundColor: colors.cardSurface,
                    borderColor: colors.borderDivider,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={17}
                  color={colors.primaryBlue}
                />
                <Text
                  style={[
                    styles.reportBtnMainText,
                    { color: colors.primaryBlue },
                  ]}
                >
                  {t.viewCashbookReport}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.primaryBlue}
                />
              </Pressable>
            </View>
          }
          renderItem={({ item, index }) => {
            // Index 0 renders the Sticky Header (Minimized Summary Bar when scrolled + 3-Column Table Header)
            if (item.id === "__STICKY_TABLE_HEADER__") {
              return (
                <View
                  style={{
                    backgroundColor: colors.pageBackgroundGrey,
                    paddingTop: isScrolledDown ? 4 : 0,
                    paddingBottom: 4,
                  }}
                >
                  {isScrolledDown && (
                    <View
                      style={[
                        styles.minimizedBarCard,
                        {
                          backgroundColor: colors.cardSurface,
                          borderColor: colors.borderDivider,
                        },
                      ]}
                    >
                      <Pressable
                        onPress={() =>
                          flashListRef.current?.scrollToOffset({
                            offset: 0,
                            animated: true,
                          })
                        }
                        style={styles.minimizedBalancesRow}
                      >
                        <View style={styles.minimizedItem}>
                          <Text
                            style={[
                              styles.minimizedLabel,
                              { color: colors.secondaryMutedText },
                            ]}
                            numberOfLines={1}
                          >
                            {t.totalBalance}:
                          </Text>
                          <Text
                            style={[
                              styles.minimizedValue,
                              {
                                color:
                                  (summary?.total_balance || 0) >= 0
                                    ? colors.primaryGreen
                                    : colors.primaryRed,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {formatSignedCurrency(
                              summary?.total_balance || 0,
                              currency,
                            )}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.minimizedDivider,
                            { backgroundColor: colors.borderDivider },
                          ]}
                        />

                        <View style={styles.minimizedItem}>
                          <Text
                            style={[
                              styles.minimizedLabel,
                              { color: colors.secondaryMutedText },
                            ]}
                            numberOfLines={1}
                          >
                            {t.todaysBalance}:
                          </Text>
                          <Text
                            style={[
                              styles.minimizedValue,
                              {
                                color:
                                  (summary?.today_balance || 0) >= 0
                                    ? colors.primaryGreen
                                    : colors.primaryRed,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {formatSignedCurrency(
                              summary?.today_balance || 0,
                              currency,
                            )}
                          </Text>
                        </View>
                      </Pressable>

                      <Pressable
                        onPress={() => router.push("/cashbook/report" as never)}
                        hitSlop={8}
                        style={[
                          styles.minimizedReportBtn,
                          {
                            backgroundColor: colors.pageBackgroundGrey,
                            borderColor: colors.borderDivider,
                          },
                        ]}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={13}
                          color={colors.primaryBlue}
                        />
                        <Text
                          style={[
                            styles.minimizedReportText,
                            { color: colors.primaryBlue },
                          ]}
                        >
                          {t.reportBtn}
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  <View
                    style={[
                      styles.columnHeader,
                      {
                        backgroundColor: colors.cardSurface,
                        borderColor: colors.borderDivider,
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
                </View>
              );
            }

// Regular Cashbook Entries (starting at index 1)
            const prevItem = listDataWithStickyHeader[index - 1];
            const nextItem = listDataWithStickyHeader[index + 1];
            const showDateHeader =
              index === 1 || prevItem.entry_date !== item.entry_date;
            const isLastOfDate =
              !nextItem || nextItem.entry_date !== item.entry_date;
            const dTotals = dailyTotals[item.entry_date];

            return (
              <View>
                {showDateHeader && (
                  <View
                    style={[
                      styles.dateHeaderRow,
                      { backgroundColor: colors.pageBackgroundGrey },
                    ]}
                  >
                    <View style={styles.colEntriesHeader}>
                      <View style={styles.datePillAndCountRow}>
                        <Pressable
                          onPress={() => handleOpenDatePicker(item.entry_date)}
                          style={({ pressed }) => [
                            styles.dateHeaderPill,
                            {
                              backgroundColor: colors.cardSurface,
                              borderColor: colors.borderDivider,
                              borderWidth: 1,
                              opacity: pressed ? 0.75 : 1,
                            },
                          ]}
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={12}
                            color={colors.primaryBlue}
                          />
                          <Text
                            style={[
                              styles.dateHeaderText,
                              { color: colors.primaryTextDark },
                            ]}
                          >
                            {item.entry_date}
                          </Text>
                        </Pressable>

                        <View
                          style={[
                            styles.dateCountBadge,
                            {
                              backgroundColor: colors.cardSurface,
                              borderColor: colors.borderDivider,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dateCountText,
                              { color: colors.secondaryMutedText },
                            ]}
                          >
                            {dTotals?.count || 0} {t.entriesCountLabel}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.colOutHeader}>
                      <View
                        style={[
                          styles.subtotalBadge,
                          {
                            backgroundColor: colors.lightPinkColumnTint,
                            borderColor: colors.primaryRed,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateTotalText,
                            { color: colors.primaryRed },
                          ]}
                          numberOfLines={1}
                        >
                          - {formatCurrency(dTotals?.out || 0, currency, true)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.colInHeader}>
                      <View
                        style={[
                          styles.subtotalBadge,
                          {
                            backgroundColor: colors.lightGreenBadgeTint,
                            borderColor: colors.primaryGreen,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateTotalText,
                            { color: colors.primaryGreen },
                          ]}
                          numberOfLines={1}
                        >
                          + {formatCurrency(dTotals?.in || 0, currency, true)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View
                  style={{
                    marginHorizontal: 0,
                    borderTopLeftRadius: showDateHeader ? 12 : 0,
                    borderTopRightRadius: showDateHeader ? 12 : 0,
                    borderBottomLeftRadius: isLastOfDate ? 12 : 0,
                    borderBottomRightRadius: isLastOfDate ? 12 : 0,
                    borderTopWidth: showDateHeader ? 1 : 0,
                    borderBottomWidth: isLastOfDate ? 1 : 0,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: colors.borderDivider,
                    marginBottom: isLastOfDate ? 6 : 0,
                    overflow: "hidden",
                  }}
                >
                  {/* Negative marginBottom (-1) on last item hides CashbookRowItem's internal straight bottom line */}
                  <View style={{ marginBottom: isLastOfDate ? -1 : 0 }}>
                    <CashbookRowItem
                      entry={item}
                      currency={currency}
                      onPress={() =>
                        router.push(`/cashbook/entry/${item.id}` as never)
                      }
                    />
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={() => null}
          ListFooterComponent={
            allEntries.length === 0 ? (
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
            ) : null
          }
        />
      </View>

      {showCalendarPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "inline"}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowCalendarPicker(false);
            if (event.type === "set" && selectedDate) {
              handleDateSelected(selectedDate);
            }
          }}
        />
      )}

      {/* Bottom Floating Action Buttons (snug against lower tab bar, zero wasted container box) */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push(`/cashbook/entry-form?type=OUT` as never)}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryRed, marginRight: 5 },
          ]}
        >
          <Text style={styles.actionBtnText}>{t.btnOut}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/cashbook/entry-form?type=IN` as never)}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryGreen, marginLeft: 5 },
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
  cardsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 8,
  },
  halfCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    textAlign: "center",
    paddingTop: 14,
    paddingBottom: 4,
  },
  mainAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    paddingHorizontal: 8,
    paddingBottom: 14,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  splitCol: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  splitVerticalDivider: { width: 1, height: "80%" },
  splitLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginBottom: 3,
  },
  splitValue: { fontFamily: "Inter_700Bold", fontSize: 13 },
  reportBtnMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  reportBtnMainText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  columnHeader: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
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
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  datePillAndCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  dateHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  dateHeaderText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  dateCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateCountText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  subtotalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.8,
  },
  dateTotalText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  minimizedBarCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  minimizedBalancesRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  minimizedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  minimizedLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 10,
  },
  minimizedValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  minimizedDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 8,
  },
  minimizedReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
  },
  minimizedReportText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  emptyState: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  bottomBar: {
    position: "absolute",
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
