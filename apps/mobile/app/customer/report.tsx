// apps/mobile/app/customer/report.tsx
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { CustomCalendarModal } from "../../components/CustomCalendarModal";

import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { getDbAdapter } from "../../db/client";
import { formatCurrency } from "../../utils/formatCurrency";
import { getLocalDateString } from "../../utils/dateUtils";
import {
  getCustomerById,
  getCustomerReportEntries,
  type CustomerReportEntryRow,
} from "../../db/customerQueries";
import {
  generateAndShareCustomerPdf,
  printOrSaveCustomerPdf,
} from "../../utils/pdfGenerator";
import { getStrings } from "../../constants/translations";

export default function CustomerReportScreen() {
  const { customerId } = useLocalSearchParams<{ customerId?: string }>();
  const router = useRouter();

  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessName = useUiStore((state) => state.activeBusinessName);
  const currency = useUiStore((state) => state.activeBusinessCurrency);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  // Default date range: 1st day of the current month to Today
  const [startDate, setStartDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => new Date());

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerReportEntryRow[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const loadReport = useCallback(async () => {
    if (!activeBusinessId || Platform.OS === "web") return;
    try {
      const db = await getDbAdapter();
      if (customerId) {
        const cust = await getCustomerById(db, activeBusinessId, customerId);
        setCustomerName(cust?.name ?? "Customer");
      } else {
        setCustomerName(null);
      }

      const startStr = getLocalDateString(startDate);
      const endStr = getLocalDateString(endDate);
      const data = await getCustomerReportEntries(
        db,
        activeBusinessId,
        startStr,
        endStr,
        customerId,
      );
      setRows(data);
    } catch (error) {
      console.error("Failed to load customer report:", error);
    }
  }, [activeBusinessId, customerId, startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      void loadReport();
    }, [loadReport]),
  );

  // Compute summary totals for the selected date range
  const summary = rows.reduce(
    (acc, row) => {
      if (row.type === "GAVE") {
        acc.totalGave += row.amount;
        acc.netBalance -= row.amount;
      } else {
        acc.totalGot += row.amount;
        acc.netBalance += row.amount;
      }
      return acc;
    },
    { totalGave: 0, totalGot: 0, netBalance: 0 },
  );

  const reportTitle = customerId
    ? `${customerName ?? t.customerSingular} - ${t.statementSuffix}`
    : t.allCustomersReportTitle;

  const handleSharePdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await generateAndShareCustomerPdf({
        businessName: activeBusinessName || "My Business",
        reportTitle,
        currency,
        startDate: getLocalDateString(startDate),
        endDate: getLocalDateString(endDate),
        totalGave: summary.totalGave,
        totalGot: summary.totalGot,
        netBalance: summary.netBalance,
        rows,
        showCustomerName: !customerId,
      });
    } catch (error) {
      console.error("Failed to share customer PDF:", error);
      Alert.alert(
        "Export Error",
        "Could not generate or share the PDF report.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleSavePdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await printOrSaveCustomerPdf({
        businessName: activeBusinessName || "My Business",
        reportTitle,
        currency,
        startDate: getLocalDateString(startDate),
        endDate: getLocalDateString(endDate),
        totalGave: summary.totalGave,
        totalGot: summary.totalGot,
        netBalance: summary.netBalance,
        rows,
        showCustomerName: !customerId,
      });
    } catch (error) {
      console.error("Failed to save customer PDF:", error);
      Alert.alert("Print Error", "Could not open PDF save dialog.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primaryBlue }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {reportTitle}
        </Text>
      </View>

      {/* Date Range Filter Bar */}
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

      <CustomCalendarModal
        visible={showStartPicker}
        initialDate={startDate}
        maximumDate={endDate}
        onClose={() => setShowStartPicker(false)}
        onSelectDate={(date) => {
          setShowStartPicker(false);
          setStartDate(date);
        }}
      />

      <CustomCalendarModal
        visible={showEndPicker}
        initialDate={endDate}
        minimumDate={startDate}
        maximumDate={new Date()}
        onClose={() => setShowEndPicker(false)}
        onSelectDate={(date) => {
          setShowEndPicker(false);
          setEndDate(date);
        }}
      />

      {/* Period Summary Card */}
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
            {t.youGaveLabel}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.primaryRed }]}>
            {formatCurrency(summary.totalGave, currency, true)}
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
            {t.youGotLabel}
          </Text>
          <Text style={[styles.summaryValue, { color: colors.primaryGreen }]}>
            {formatCurrency(summary.totalGot, currency, true)}
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
                  summary.netBalance < 0
                    ? colors.primaryRed
                    : colors.primaryGreen,
              },
            ]}
          >
            {formatCurrency(Math.abs(summary.netBalance), currency, true)}
          </Text>
        </View>
      </View>

      {/* 3-Column Table Header */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: colors.cardSurface,
            borderBottomColor: colors.borderDivider,
          },
        ]}
      >
        <View style={styles.colDetails}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.entriesHeader} ({rows.length})
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
            {t.youGaveCol}
          </Text>
        </View>
        <View style={styles.colAmount}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            {t.youGotCol}
          </Text>
        </View>
      </View>

      {/* Entries List */}
      <View style={{ flex: 1 }}>
        <FlashList
          data={rows}
          keyExtractor={(item) => item.id}
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
              <View style={styles.colDetailsData}>
                <Text
                  style={[
                    styles.dateText,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {item.entry_date} • {item.entry_time}
                </Text>
                {!customerId && (
                  <Text
                    style={[styles.custNameText, { color: colors.primaryBlue }]}
                    numberOfLines={1}
                  >
                    {item.customer_name}
                  </Text>
                )}
                {item.details ? (
                  <Text
                    style={[
                      styles.detailsText,
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
                  styles.colAmountData,
                  { backgroundColor: colors.lightPinkColumnTint },
                ]}
              >
                {item.type === "GAVE" ? (
                  <Text
                    style={[styles.amountText, { color: colors.primaryRed }]}
                  >
                    {formatCurrency(item.amount, currency, true)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.colAmountData}>
                {item.type === "GOT" ? (
                  <Text
                    style={[styles.amountText, { color: colors.primaryGreen }]}
                  >
                    {formatCurrency(item.amount, currency, true)}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Text
                style={[styles.emptyText, { color: colors.secondaryMutedText }]}
              >
                {t.noTransactionsInRange}
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
          onPress={handleSavePdf}
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
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    flex: 1,
  },
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
    paddingHorizontal: 12,
  },
  colDetails: { flex: 2, alignItems: "flex-start" },
  colAmount: { flex: 1, alignItems: "flex-end" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, minHeight: 56 },
  colDetailsData: { flex: 2, padding: 12, justifyContent: "center" },
  colAmountData: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  dateText: { fontFamily: "Inter_400Regular", fontSize: 11, marginBottom: 2 },
  custNameText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginBottom: 2,
  },
  detailsText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  amountText: { fontFamily: "Inter_700Bold", fontSize: 14 },
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
  outlineBtnText: { fontFamily: "Inter_700Bold", fontSize: 14 },
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
