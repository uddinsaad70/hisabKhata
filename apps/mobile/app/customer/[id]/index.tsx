// apps/mobile/app/customer/[id]/index.tsx
import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  DeviceEventEmitter,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import DateTimePicker from "@react-native-community/datetimepicker";

import { UndoSnackbar } from "../../../components/UndoSnackbar";
import { useUiStore } from "../../../store/uiStore";
import { getThemeColors } from "../../../constants/theme";
import {
  formatCurrency,
  isSettled,
  formatSignedCurrency,
} from "../../../utils/formatCurrency";
import { getDbAdapter } from "../../../db/client";
import {
  getCustomerById,
  getCustomerLedgerEntries,
  type CustomerRow,
  type CustomerLedgerEntryRow,
} from "../../../db/customerQueries";
import { getStrings } from "../../../constants/translations";
import { getLocalDateString } from "../../../utils/dateUtils";

export default function CustomerLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [entries, setEntries] = useState<CustomerLedgerEntryRow[]>([]);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const flashListRef = useRef<FlashListRef<CustomerLedgerEntryRow> | null>(
    null,
  );
  const prevTopEntryIdRef = useRef<string | null>(null);
  // Load customer and entries data from SQLite
  const loadData = useCallback(async () => {
    if (!activeBusinessId || !id || Platform.OS === "web") return;
    try {
      const db = await getDbAdapter();
      const custData = await getCustomerById(db, activeBusinessId, id);
      setCustomer(custData);

      if (custData) {
        const ledgerData = await getCustomerLedgerEntries(
          db,
          activeBusinessId,
          id,
        );
        const newestId = ledgerData[0]?.id ?? null;
        const shouldScrollTop =
          prevTopEntryIdRef.current !== null &&
          newestId !== null &&
          newestId !== prevTopEntryIdRef.current;
        prevTopEntryIdRef.current = newestId;

        setEntries(ledgerData);

        if (shouldScrollTop) {
          setTimeout(() => {
            flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 150);
        }
      }
    } catch (error) {
      console.error("Failed to load ledger:", error);
    }
  }, [activeBusinessId, id]);

  // Refresh data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("REFRESH_LEDGER", () => {
      void loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  // Opens the standard calendar popup initialized at the tapped pill's date
  const handleOpenDatePicker = (dateStr: string) => {
    const parsed = new Date(`${dateStr}T00:00:00`);
    setPickerDate(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    setShowCalendarPicker(true);
  };

  // Jumps to the first transaction matching the selected date
  const handleDateSelected = (selectedDate: Date) => {
    setPickerDate(selectedDate);
    const targetDateStr = getLocalDateString(selectedDate);

    const targetIndex = entries.findIndex(
      (entry) => entry.entry_date === targetDateStr,
    );

    if (targetIndex !== -1 && flashListRef.current) {
      try {
        flashListRef.current.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        // Ignore if layout measurement is still pending
      }
    } else {
      Alert.alert(
      t.noTransactionsOnDateTitle,
      `${t.noCustomerTransactionsOnDateMsg} ${targetDateStr}`,
    );
    }
  };

  const dailyTotals = useMemo(() => {
    const totals: Record<string, { gave: number; got: number; count: number }> =
      {};
    entries.forEach((e) => {
      if (!totals[e.entry_date]) {
        totals[e.entry_date] = { gave: 0, got: 0, count: 0 };
      }
      totals[e.entry_date].count += 1;
      if (e.type === "GAVE") totals[e.entry_date].gave += e.amount;
      else totals[e.entry_date].got += e.amount;
    });
    return totals;
  }, [entries]);

  if (!customer) return null;

  const settled = isSettled(customer.net_balance);
  const isYouWillGive = !settled && customer.net_balance > 0;
  const balanceColor = settled
    ? colors.primaryGreen
    : isYouWillGive
      ? colors.primaryGreen
      : colors.primaryRed;

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      {/* Top Header Section */}
      <View
        style={[
          styles.headerContainer,
          { backgroundColor: colors.primaryBlue },
        ]}
      >
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backBtn}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {customer.avatar_initials}
              </Text>
            </View>
            <View>
              <Text style={styles.headerName} numberOfLines={1}>
                {customer.name}
              </Text>
              <Pressable
                onPress={() =>
                  router.push(`/customer/${customer.id}/settings` as never)
                }
              >
                <Text style={styles.settingsLink}>{t.viewSettings}</Text>
              </Pressable>
            </View>
          </View>
          {customer.phone && (
            <Pressable onPress={handleCall} style={styles.callBtn} hitSlop={10}>
              <Ionicons name="call" size={20} color={colors.primaryBlue} />
            </Pressable>
          )}
        </View>

        {/* Balance Status Card */}
        <View
          style={[styles.balanceCard, { backgroundColor: colors.cardSurface }]}
        >
          <View style={styles.balanceRow}>
            {settled ? (
              <View style={styles.settledRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.primaryGreen}
                />
                <Text
                  style={[
                    styles.balanceLabel,
                    { color: colors.primaryTextDark, marginLeft: 6 },
                  ]}
                >
                  {t.settledUp}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.balanceLabel,
                  { color: colors.secondaryMutedText },
                ]}
              >
                {isYouWillGive ? t.youWillGive : t.youWillGet}
              </Text>
            )}
            <Text style={[styles.balanceAmount, { color: balanceColor }]}>
              {formatSignedCurrency(
                customer.net_balance,
                activeBusinessCurrency,
              )}
            </Text>
          </View>
          <View
            style={[
              styles.reportBtnBorder,
              { borderTopColor: colors.borderDivider },
            ]}
          />
          <Pressable
            onPress={() =>
              router.push(`/customer/report?customerId=${id}` as never)
            }
            style={[styles.reportBtn, { borderTopColor: colors.borderDivider }]}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={colors.primaryBlue}
            />
            <Text style={[styles.reportBtnText, { color: colors.primaryBlue }]}>
              {t.reportBtn}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 3-Column Sticky Header (Rounded Card matching Cashbook) */}
      <View
        style={[
          styles.columnHeader,
          {
            backgroundColor: colors.cardSurface,
            borderColor: colors.borderDivider,
          },
        ]}
      >
        <View style={styles.colEntries}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.entriesHeader}
          </Text>
        </View>
        <View
          style={[
            styles.colGave,
            { backgroundColor: colors.lightPinkColumnTint },
          ]}
        >
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.youGaveCol}
          </Text>
        </View>
        <View style={styles.colGot}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.youGotCol}
          </Text>
        </View>
      </View>

      {/* Entries List */}
      <View style={styles.listContainer}>
        <FlashList
          ref={flashListRef}
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 74 }}
          renderItem={({ item, index }) => {
            const showDateHeader =
              index === 0 || entries[index - 1].entry_date !== item.entry_date;
            const nextItem = entries[index + 1];
            const isLastOfDate =
              !nextItem || nextItem.entry_date !== item.entry_date;
            const dTotals = dailyTotals[item.entry_date];

            return (
              <View>
                {showDateHeader && (
                  <View style={styles.dateHeaderRow}>
                    <View style={styles.colEntries}>
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

                    <View style={styles.colGave}>
                      {dTotals && dTotals.gave > 0 ? (
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
                            -{" "}
                            {formatCurrency(
                              dTotals.gave,
                              activeBusinessCurrency,
                              true,
                            )}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.colGot}>
                      {dTotals && dTotals.got > 0 ? (
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
                            +{" "}
                            {formatCurrency(
                              dTotals.got,
                              activeBusinessCurrency,
                              true,
                            )}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                )}

                <View
                  style={{
                    borderTopLeftRadius: showDateHeader ? 12 : 0,
                    borderTopRightRadius: showDateHeader ? 12 : 0,
                    borderBottomLeftRadius: isLastOfDate ? 12 : 0,
                    borderBottomRightRadius: isLastOfDate ? 12 : 0,
                    borderTopWidth: showDateHeader ? 1 : 0,
                    borderBottomWidth: isLastOfDate ? 1 : 0,
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: colors.borderDivider,
                    marginBottom: isLastOfDate ? 8 : 0,
                    overflow: "hidden",
                  }}
                >
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/customer/${customer.id}/entry/${item.id}` as never,
                      )
                    }
                    style={({ pressed }) => [
                      styles.entryRow,
                      {
                        backgroundColor: colors.cardSurface,
                        borderBottomColor: colors.borderDivider,
                        borderBottomWidth: isLastOfDate ? 0 : 1,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={styles.colEntriesData}>
                      <Text
                        style={[
                          styles.entryTime,
                          { color: colors.secondaryMutedText },
                        ]}
                      >
                        {item.entry_time}
                      </Text>

                      {/* Enlarged Running Balance Pill (+2px larger on the final/latest transaction of each day) */}
                      <View
                        style={[
                          styles.runningBalancePill,
                          showDateHeader && {
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderWidth: 0.8,
                            borderColor:
                              item.running_balance >= 0
                                ? colors.primaryGreen
                                : colors.primaryRed,
                          },
                          {
                            backgroundColor:
                              item.running_balance >= 0
                                ? colors.lightGreenBadgeTint
                                : colors.lightPinkColumnTint,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.runningBalanceText,
                            showDateHeader && { fontSize: 14 },
                            {
                              color:
                                item.running_balance >= 0
                                  ? colors.primaryGreen
                                  : colors.primaryRed,
                            },
                          ]}
                        >
                          {t.balPrefix}{" "}
                          {formatSignedCurrency(
                            item.running_balance,
                            activeBusinessCurrency,
                          )}
                        </Text>
                      </View>  

                      {item.details ? (
                        <Text
                          style={[
                            styles.entryDetails,
                            { color: colors.primaryTextDark },
                          ]}
                          numberOfLines={1}
                        >
                          {item.details}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.colGaveData,
                        { backgroundColor: colors.lightPinkColumnTint },
                      ]}
                    >
                      {item.type === "GAVE" ? (
                        <Text
                          style={[
                            styles.entryAmount,
                            { color: colors.primaryRed },
                          ]}
                        >
                          {formatCurrency(
                            item.amount,
                            activeBusinessCurrency,
                            true,
                          )}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.colGotData}>
                      {item.type === "GOT" ? (
                        <Text
                          style={[
                            styles.entryAmount,
                            { color: colors.primaryGreen },
                          ]}
                        >
                          {formatCurrency(
                            item.amount,
                            activeBusinessCurrency,
                            true,
                          )}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                </View>
              </View>
            );
          }}
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

{/* Bottom Floating Action Buttons (matching Cashbook) */}
      <View style={styles.bottomBar} pointerEvents="box-none">
        <Pressable
          onPress={() =>
            router.push(
              `/customer/${customer.id}/entry-form?type=GAVE` as never,
            )
          }
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryRed, marginRight: 5 },
          ]}
        >
          <Text style={styles.actionBtnText}>
            {t.youGaveCol} {activeBusinessCurrency === "BDT" ? "৳" : "₹"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push(`/customer/${customer.id}/entry-form?type=GOT` as never)
          }
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryGreen, marginLeft: 5 },
          ]}
        >
          <Text style={styles.actionBtnText}>
            {t.youGotCol} {activeBusinessCurrency === "BDT" ? "৳" : "₹"}
          </Text>
        </Pressable>
      </View>
      <UndoSnackbar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerContainer: {
    paddingTop: Platform.OS === "android" ? 40 : 50,
    paddingHorizontal: 16,
    paddingBottom: 60, // Space for the overlapping card
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  topLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  backBtn: { marginRight: 12 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerAvatarText: {
    color: "#1E40AF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  headerName: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 16 },
  settingsLink: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceCard: {
    position: "absolute",
    bottom: -24,
    left: 12,
    right: 12,
    borderRadius: 12,
    paddingTop: 14,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  settledRow: { flexDirection: "row", alignItems: "center" },
  balanceLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 22 },
  reportBtnBorder: { borderTopWidth: 1 },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    gap: 6,
  },
  reportBtnText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  columnHeader: {
    flexDirection: "row",
    marginTop: 34,
    marginHorizontal: 12,
    marginBottom: 4,
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
  colEntries: { flex: 2, alignItems: "flex-start" },
  colGave: { flex: 1, alignItems: "flex-end" },
  colGot: { flex: 1, alignItems: "flex-end" },
  listContainer: { flex: 1 },
  dateHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 2,
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
  dateHeaderText: { fontFamily: "Inter_700Bold", fontSize: 11 },
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
    fontSize: 11,
  },
  entryRow: { flexDirection: "row", minHeight: 62 },
  colEntriesData: {
    flex: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  colGaveData: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  colGotData: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  entryTime: { fontFamily: "Inter_500Medium", fontSize: 12, marginBottom: 5 },
  runningBalancePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  runningBalanceText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  entryDetails: { fontFamily: "Inter_500Medium", fontSize: 13 },
  entryAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  bottomBar: {
    position: "absolute",
    bottom: 10,
    left: 12,
    right: 12,
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