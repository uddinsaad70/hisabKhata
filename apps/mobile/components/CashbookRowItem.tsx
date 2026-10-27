// apps/mobile/components/CashbookRowItem.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type CashbookEntryRow } from "../db/cashbookQueries";
import { formatCurrency, type CurrencyCode } from "../utils/formatCurrency";
import { getThemeColors } from "../constants/theme";
import { useUiStore } from "../store/uiStore";

interface Props {
  entry: CashbookEntryRow;
  currency: CurrencyCode;
  onPress: () => void;
}

export function CashbookRowItem({ entry, currency, onPress }: Props) {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);

  const isOut = entry.type === "OUT";
  const amountColor = isOut ? colors.primaryRed : colors.primaryGreen;
  const isOnline = entry.payment_mode === "ONLINE";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.cardSurface,
          borderBottomColor: colors.borderDivider,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {/* Column 1: Time, Details, Mode */}
      <View style={styles.colEntriesData}>
        <View style={styles.timeModeRow}>
          <Text style={[styles.timeText, { color: colors.secondaryMutedText }]}>
            {entry.entry_time}
          </Text>
          <View
            style={[
              styles.modeBadge,
              { backgroundColor: isOnline ? "#DBEAFE" : "#F3F4F6" },
            ]}
          >
            <Text
              style={[
                styles.modeText,
                { color: isOnline ? "#1D4ED8" : "#4B5563" },
              ]}
            >
              {entry.payment_mode}
            </Text>
          </View>
        </View>
        {entry.details ? (
          <Text
            style={[styles.detailsText, { color: colors.primaryTextDark }]}
            numberOfLines={1}
          >
            {entry.details}
          </Text>
        ) : null}
      </View>

      {/* Column 2: OUT (Pink Background) */}
      <View
        style={[
          styles.colOutData,
          { backgroundColor: colors.lightPinkColumnTint },
        ]}
      >
        {isOut ? (
          <Text style={[styles.amountText, { color: colors.primaryRed }]}>
            {formatCurrency(entry.amount, currency, true)}
          </Text>
        ) : null}
      </View>

      {/* Column 3: IN (White Background) */}
      <View style={styles.colInData}>
        {!isOut ? (
          <Text style={[styles.amountText, { color: colors.primaryGreen }]}>
            {formatCurrency(entry.amount, currency, true)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 1 },
  colEntriesData: {
    flex: 2,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  colOutData: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  colInData: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  timeModeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 6,
  },
  timeText: { fontFamily: "Inter_400Regular", fontSize: 11 },
  modeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  modeText: { fontFamily: "Inter_600SemiBold", fontSize: 9 },
  detailsText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  amountText: { fontFamily: "Inter_700Bold", fontSize: 14 },
});
