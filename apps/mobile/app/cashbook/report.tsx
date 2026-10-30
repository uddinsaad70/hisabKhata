// apps/mobile/app/cashbook/report.tsx
import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import {
  generateAndShareCashbookPdf,
  printOrSaveCashbookPdf,
} from "../../utils/pdfGenerator";
import { useRouter, useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { getDbAdapter } from "../../db/client";
import { formatCurrency } from "../../utils/formatCurrency";
import { getLocalDateString } from "../../utils/dateUtils";
import {
  getCashbookDailyReport,
  type CashbookDailyReportRow,
} from "../../db/cashbookQueries";
import { getStrings } from "../../constants/translations";

export default function CashbookReportScreen() {
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessName = useUiStore((state) => state.activeBusinessName);
  const currency = useUiStore((state) => state.activeBusinessCurrency);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);
  const [isExporting, setIsExporting] = useState(false);

  // Default date range: 1st day of the current month to Today
  const [startDate, setStartDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [rows, setRows] = useState<CashbookDailyReportRow[]>([]);

  // Fetch date-wise daily report from SQLite
  const loadReport = useCallback(async () => {
    if (!activeBusinessId || Platform.OS === "web") return;
    try {
      const db = await getDbAdapter();
      const startStr = getLocalDateString(startDate);
      const endStr = getLocalDateString(endDate);
      const data = await getCashbookDailyReport(
        db,
        activeBusinessId,
        startStr,
        endStr,
      );
      setRows(data);
    } catch (error) {
      console.error("Failed to load cashbook daily report:", error);
    }
  }, [activeBusinessId, startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      void loadReport();
    }, [loadReport]),
  );

  // Compute aggregated totals for the selected date range
  const rangeSummary = rows.reduce(
    (acc, row) => {
      acc.totalIn += row.daily_in;
      acc.totalOut += row.daily_out;
      acc.netBalance += row.daily_balance;
      acc.totalEntries += row.entry_count;
      return acc;
    },
    { totalIn: 0, totalOut: 0, netBalance: 0, totalEntries: 0 },
  );

  const handleSharePdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await generateAndShareCashbookPdf({
        businessName: activeBusinessName || "My Business",
        currency,
        startDate: getLocalDateString(startDate),
        endDate: getLocalDateString(endDate),
        totalIn: rangeSummary.totalIn,
        totalOut: rangeSummary.totalOut,
        netBalance: rangeSummary.netBalance,
        rows,
      });
    } catch (error) {
      console.error("Failed to share PDF:", error);
      Alert.alert(
        "Export Error",
        "Could not generate or share the PDF report.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveOrPrintPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await printOrSaveCashbookPdf({
        businessName: activeBusinessName || "My Business",
        currency,
        startDate: getLocalDateString(startDate),
        endDate: getLocalDateString(endDate),
        totalIn: rangeSummary.totalIn,
        totalOut: rangeSummary.totalOut,
        netBalance: rangeSummary.netBalance,
        rows,
      });
    } catch (error) {
      console.error("Failed to save/print PDF:", error);
      Alert.alert("Print Error", "Could not open PDF save dialog.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: colors.primaryBlue }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t.cashbookReportTitle}</Text>
      </View>

      {/* Date Range Selector Bar */}
      <View
        style={[
          styles.filterBar,
          {
            backgroundColor: colors.cardSurface,
            borderBottomColor: colors.borderDivider,
          },
        ]}
      >
        <Pressable
          onPress={() => setShowStartPicker(true)}
          style={[
            styles.dateSelector,
            {
              borderColor: colors.borderDivider,
              backgroundColor: colors.pageBackgroundGrey,
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.primaryBlue}
          />
          <View>
            <Text
              style={[styles.dateLabel, { color: colors.secondaryMutedText }]}
            >
              {t.startDateLabel}
            </Text>
            <Text style={[styles.dateValue, { color: colors.primaryTextDark }]}>
              {getLocalDateString(startDate)}
            </Text>
          </View>
        </Pressable>

        <Ionicons
          name="arrow-forward"
          size={16}
          color={colors.secondaryMutedText}
        />

        <Pressable
          onPress={() => setShowEndPicker(true)}
          style={[
            styles.dateSelector,
            {
              borderColor: colors.borderDivider,
              backgroundColor: colors.pageBackgroundGrey,
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={colors.primaryBlue}
          />
          <View>
            <Text
              style={[styles.dateLabel, { color: colors.secondaryMutedText }]}
            >
              {t.endDateLabel}
            </Text>
            <Text style={[styles.dateValue, { color: colors.primaryTextDark }]}>
              {getLocalDateString(endDate)}
            </Text>
          </View>
        </Pressable>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          maximumDate={endDate}
          onChange={(_e, date) => {
            setShowStartPicker(Platform.OS === "ios");
            if (date) setStartDate(date);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          minimumDate={startDate}
          maximumDate={new Date()}
          onChange={(_e, date) => {
            setShowEndPicker(Platform.OS === "ios");
            if (date) setEndDate(date);
          }}
        />
      )}

      {/* Period Summary Strip */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: colors.cardSurface,
            borderColor: colors.borderDivider,
          },
        ]}
      >
        <View style={styles.summaryBox}>
          <Text
            style={[styles.summaryLabel, { color: colors.secondaryMutedText }]}
          >
            {t.totalInLabel}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.primaryGreen }]}>
            {formatCurrency(rangeSummary.totalIn, currency, true)}
          </Text>
        </View>
        <View
          style={[
            styles.summaryDivider,
            { backgroundColor: colors.borderDivider },
          ]}
        />
        <View style={styles.summaryBox}>
          <Text
            style={[styles.summaryLabel, { color: colors.secondaryMutedText }]}
          >
            {t.totalOutLabel}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.primaryRed }]}>
            {formatCurrency(rangeSummary.totalOut, currency, true)}
          </Text>
        </View>
        <View
          style={[
            styles.summaryDivider,
            { backgroundColor: colors.borderDivider },
          ]}
        />
        <View style={styles.summaryBox}>
          <Text
            style={[styles.summaryLabel, { color: colors.secondaryMutedText }]}
          >
            {t.netBalanceLabel}
          </Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  rangeSummary.netBalance >= 0
                    ? colors.primaryGreen
                    : colors.primaryRed,
              },
            ]}
          >
            {formatCurrency(rangeSummary.netBalance, currency, true)}
          </Text>
        </View>
      </View>

      {/* 4-Column Table Header */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: colors.cardSurface,
            borderBottomColor: colors.borderDivider,
          },
        ]}
      >
        <View style={styles.colDate}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.dateCol}
          </Text>
        </View>
        <View style={styles.colAmount}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.dailyInCol}
          </Text>
        </View>
        <View
          style={[
            styles.colAmount,
            { backgroundColor: colors.lightPinkColumnTint },
          ]}
        >
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.dailyOutCol}
          </Text>
        </View>
        <View style={styles.colAmount}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.totalBalCol}
          </Text>
        </View>
      </View>

      {/* Daily Summary Rows */}
      <View style={{ flex: 1 }}>
        <FlashList
          data={rows}
          keyExtractor={(item) => item.entry_date}
          renderItem={({ item }) => (
            <View
              style={[
                styles.tableRow,
                {
                  backgroundColor: colors.cardSurface,
                  borderBottomColor: colors.borderDivider,
                },
              ]}
            >
              <View style={styles.colDateData}>
                <Text
                  style={[styles.dateText, { color: colors.primaryTextDark }]}
                >
                  {item.entry_date}
                </Text>
                <Text
                  style={[
                    styles.entryCountText,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {item.entry_count} {t.entriesCountLabel}
                </Text>
              </View>

              <View style={styles.colAmountData}>
                <Text
                  style={[styles.amountText, { color: colors.primaryGreen }]}
                >
                  {formatCurrency(item.daily_in, currency, false)}
                </Text>
              </View>

              <View
                style={[
                  styles.colAmountData,
                  { backgroundColor: colors.lightPinkColumnTint },
                ]}
              >
                <Text style={[styles.amountText, { color: colors.primaryRed }]}>
                  {formatCurrency(item.daily_out, currency, false)}
                </Text>
              </View>

              <View style={styles.colAmountData}>
                <Text
                  style={[
                    styles.amountText,
                    {
                      color:
                        item.total_balance >= 0
                          ? colors.primaryGreen
                          : colors.primaryRed,
                    },
                  ]}
                >
                  {formatCurrency(item.total_balance, currency, true)}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text
                style={[styles.emptyText, { color: colors.secondaryMutedText }]}
              >
                {t.noCashbookInRange}
              </Text>
            </View>
          )}
        />
      </View>

      {/* Bottom Sticky Action Bar for Save & Share PDF */}
      <View
        style={[
          styles.footerBar,
          {
            backgroundColor: colors.cardSurface,
            borderTopColor: colors.borderDivider,
          },
        ]}
      >
        <Pressable
          onPress={handleSaveOrPrintPdf}
          disabled={isExporting}
          style={({ pressed }) => [
            styles.outlineBtn,
            { borderColor: colors.primaryBlue },
            (pressed || isExporting) && { opacity: 0.7 },
          ]}
        >
          <Ionicons
            name="download-outline"
            size={20}
            color={colors.primaryBlue}
          />
          <Text style={[styles.outlineBtnText, { color: colors.primaryBlue }]}>
            {t.savePdfBtn}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleSharePdf}
          disabled={isExporting}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primaryBlue },
            (pressed || isExporting) && { opacity: 0.8 },
          ]}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>{t.sharePdfBtn}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 42 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 18 },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  dateSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  dateLabel: { fontFamily: "Inter_600SemiBold", fontSize: 9 },
  dateValue: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  summaryCard: {
    flexDirection: "row",
    margin: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
  },
  summaryBox: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, height: "100%" },
  summaryLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginBottom: 4,
  },
  summaryValue: { fontFamily: "Inter_700Bold", fontSize: 14 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1 },
  colHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  colDate: { flex: 1.3, alignItems: "flex-start" },
  colAmount: { flex: 1, alignItems: "flex-end" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, minHeight: 54 },
  colDateData: { flex: 1.3, padding: 10, justifyContent: "center" },
  colAmountData: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  dateText: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 2 },
  entryCountText: { fontFamily: "Inter_400Regular", fontSize: 10 },
  amountText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  emptyState: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  footerBar: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  outlineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
