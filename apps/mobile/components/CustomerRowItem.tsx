// apps/mobile/components/CustomerRowItem.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type CustomerRow } from "../db/customerQueries";
import {
  formatSignedCurrency,
  isSettled,
  type CurrencyCode,
} from "../utils/formatCurrency";
import { formatRelativeTime } from "../utils/dateUtils";
import { getThemeColors, type ThemeMode } from "../constants/theme";
import { useUiStore } from "../store/uiStore";
import { getStrings } from "../constants/translations";

export interface CustomerRowItemProps {
  customer: CustomerRow;
  currency: CurrencyCode;
  themeMode: ThemeMode;
  isLastItem?: boolean;
  onPress: (customer: CustomerRow) => void;
}

const AVATAR_PALETTES: readonly { bg: string; text: string }[] = [
  { bg: "#DBEAFE", text: "#1E40AF" },
  { bg: "#FCE7F3", text: "#9D174D" },
  { bg: "#DCFCE7", text: "#166534" },
  { bg: "#FEF3C7", text: "#92400E" },
  { bg: "#EDE9FE", text: "#5B21B6" },
  { bg: "#E0F2FE", text: "#075985" },
];

function getAvatarPalette(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function CustomerRowItem({
  customer,
  currency,
  themeMode,
  isLastItem = false,
  onPress,
}: CustomerRowItemProps) {
  const colors = getThemeColors(themeMode);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const avatarPalette = getAvatarPalette(customer.id);

  const settled = isSettled(customer.net_balance);
  const isYouWillGive = !settled && customer.net_balance > 0;

  const balanceColor = settled
    ? colors.secondaryMutedText
    : isYouWillGive
      ? colors.primaryGreen
      : colors.primaryRed;

  const balanceSubtitle = settled
    ? null
    : isYouWillGive
      ? t.youWillGive
      : t.youWillGet;

  const activityTimestamp = customer.last_transaction_at ?? customer.created_at;
  const relativeTimeStr = formatRelativeTime(activityTimestamp);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ledger for ${customer.name}`}
      onPress={() => onPress(customer)}
      style={({ pressed }) => [
        styles.rowContainer,
        {
          backgroundColor: colors.cardSurface,
          borderBottomColor: colors.borderDivider,
          borderBottomWidth: isLastItem ? 0 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {/* Left: Circular Pastel Avatar with Initials (Section 2.1.5) */}
      <View
        style={[styles.avatarCircle, { backgroundColor: avatarPalette.bg }]}
      >
        <Text style={[styles.avatarText, { color: avatarPalette.text }]}>
          {customer.avatar_initials}
        </Text>
      </View>

      {/* Middle: Bold Customer Name & Relative Time */}
      <View style={styles.middleColumn}>
        <Text
          numberOfLines={1}
          style={[styles.customerName, { color: colors.primaryTextDark }]}
        >
          {customer.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.timeSubtitle, { color: colors.secondaryMutedText }]}
        >
          {relativeTimeStr}
        </Text>
      </View>

      {/* Right: Signed Net Balance (Grey if 0, Green + if You will give, Red - if You will get) */}
      <View style={styles.rightColumn}>
        <Text style={[styles.balanceAmount, { color: balanceColor }]}>
          {formatSignedCurrency(customer.net_balance, currency)}
        </Text>
        {balanceSubtitle && (
          <Text
            style={[
              styles.balanceDirectionLabel,
              { color: colors.secondaryMutedText },
            ]}
          >
            {balanceSubtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  middleColumn: {
    flex: 1,
    marginRight: 8,
  },
  customerName: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    marginBottom: 2,
  },
  timeSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  rightColumn: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  balanceAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
  },
  balanceDirectionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
});
