// apps/mobile/app/customer/[id]/index.tsx
import React, { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";

import { useUiStore } from "../../../store/uiStore";
import { getThemeColors } from "../../../constants/theme";
import { formatCurrency, isSettled } from "../../../utils/formatCurrency";
import { getDbAdapter } from "../../../db/client";
import {
  getCustomerById,
  getCustomerLedgerEntries,
  type CustomerRow,
  type CustomerLedgerEntryRow,
} from "../../../db/customerQueries";

export default function CustomerLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const colors = getThemeColors(themeMode);

  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [entries, setEntries] = useState<CustomerLedgerEntryRow[]>([]);

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
        setEntries(ledgerData);
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

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

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
                <Text style={styles.settingsLink}>View settings</Text>
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
                  Settled Up
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.balanceLabel,
                  { color: colors.secondaryMutedText },
                ]}
              >
                {isYouWillGive ? "You will give" : "You will get"}
              </Text>
            )}
            <Text style={[styles.balanceAmount, { color: balanceColor }]}>
              {formatCurrency(
                customer.net_balance,
                activeBusinessCurrency,
                true,
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
            style={styles.reportBtn}
            onPress={() =>
              router.push(`/customer/${customer.id}/report` as never)
            }
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={colors.primaryBlue}
            />
            <Text style={[styles.reportBtnText, { color: colors.primaryBlue }]}>
              Report
            </Text>
          </Pressable>
        </View>
      </View>

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
        <View style={styles.colEntries}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            ENTRIES
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
            YOU GAVE
          </Text>
        </View>
        <View style={styles.colGot}>
          <Text
            style={[styles.colHeaderText, { color: colors.secondaryMutedText }]}
          >
            YOU GOT
          </Text>
        </View>
      </View>

      {/* Entries List */}
      <View style={styles.listContainer}>
        <FlashList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            // Check if date header should be shown (if previous item has a different date)
            const showDateHeader =
              index === 0 || entries[index - 1].entry_date !== item.entry_date;

            return (
              <View>
                {showDateHeader && (
                  <View style={styles.dateHeaderContainer}>
                    <View
                      style={[
                        styles.dateHeaderPill,
                        { backgroundColor: "#E5E7EB" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateHeaderText,
                          { color: colors.primaryTextDark },
                        ]}
                      >
                        {item.entry_date}
                      </Text>
                    </View>
                  </View>
                )}

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
                      {item.entry_date} • {item.entry_time}
                    </Text>

                    <View
                      style={[
                        styles.runningBalancePill,
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
                          {
                            color:
                              item.running_balance >= 0
                                ? colors.primaryGreen
                                : colors.primaryRed,
                          },
                        ]}
                      >
                        Bal.{" "}
                        {formatCurrency(
                          item.running_balance,
                          activeBusinessCurrency,
                          true,
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
            );
          }}
        />
      </View>

      {/* Bottom Action Buttons */}
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
          onPress={() =>
            router.push(
              `/customer/${customer.id}/entry-form?type=GAVE` as never,
            )
          }
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryRed, marginRight: 6 },
          ]}
        >
          <Text style={styles.actionBtnText}>
            YOU GAVE {activeBusinessCurrency === "BDT" ? "৳" : "₹"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push(`/customer/${customer.id}/entry-form?type=GOT` as never)
          }
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primaryGreen, marginLeft: 6 },
          ]}
        >
          <Text style={styles.actionBtnText}>
            YOU GOT {activeBusinessCurrency === "BDT" ? "৳" : "₹"}
          </Text>
        </Pressable>
      </View>
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
    left: 16,
    right: 16,
    borderRadius: 8,
    paddingTop: 16,
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
    paddingBottom: 16,
  },
  settledRow: { flexDirection: "row", alignItems: "center" },
  balanceLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 18 },
  reportBtnBorder: { borderTopWidth: 1 },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
  },
  reportBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  columnHeader: { flexDirection: "row", marginTop: 36, borderBottomWidth: 1 },
  colHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: "right",
  },
  colEntries: { flex: 2, alignItems: "flex-start" },
  colGave: { flex: 1, alignItems: "flex-end" },
  colGot: { flex: 1, alignItems: "flex-end" },
  listContainer: { flex: 1 },
  dateHeaderContainer: { alignItems: "center", marginVertical: 12 },
  dateHeaderPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateHeaderText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  entryRow: { flexDirection: "row", borderBottomWidth: 1 },
  colEntriesData: {
    flex: 2,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  colGaveData: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  colGotData: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  entryTime: { fontFamily: "Inter_400Regular", fontSize: 11, marginBottom: 6 },
  runningBalancePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  runningBalanceText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  entryDetails: { fontFamily: "Inter_400Regular", fontSize: 12 },
  entryAmount: { fontFamily: "Inter_700Bold", fontSize: 14 },
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
    fontSize: 14,
  },
});
