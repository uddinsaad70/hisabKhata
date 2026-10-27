// apps/mobile/app/cashbook/entry/[entryId].tsx
import React, { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useUiStore } from "../../../store/uiStore";
import { getThemeColors } from "../../../constants/theme";
import { getDbAdapter } from "../../../db/client";
import { formatCurrency } from "../../../utils/formatCurrency";
import {
  getCashbookEntryById,
  softDeleteCashbookEntry,
  type CashbookEntryRow,
} from "../../../db/cashbookQueries";
import { DeleteConfirmModal } from "../../../components/DeleteConfirmModal";

export default function CashbookEntryDetailsScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const showUndoSnackbar = useUiStore((state) => state.showUndoSnackbar);
  const colors = getThemeColors(themeMode);

  const [entry, setEntry] = useState<CashbookEntryRow | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadEntry() {
        if (!activeBusinessId || !entryId) return;
        const db = await getDbAdapter();
        const data = await getCashbookEntryById(db, activeBusinessId, entryId);
        setEntry(data);
      }
      void loadEntry();
    }, [activeBusinessId, entryId]),
  );

  if (!entry) return null;

  const isOut = entry.type === "OUT";
  const headerColor = isOut ? colors.primaryRed : colors.primaryGreen;

  const handleDelete = async () => {
    if (!activeBusinessId || !entryId) return;
    try {
      const db = await getDbAdapter();
      await softDeleteCashbookEntry(db, activeBusinessId, entryId);
      setDeleteModalVisible(false);

      // Show Snackbar for Undo
      showUndoSnackbar({
        entryId,
        entryDomain: "cashbook",
        message: "Cashbook Entry Deleted",
      });

      router.back();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Entry Details</Text>
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
            },
          ]}
        >
          <View style={styles.amountHeader}>
            <Text
              style={[styles.amountLabel, { color: colors.secondaryMutedText }]}
            >
              {isOut ? "CASH OUT [-]" : "CASH IN [+]"}
            </Text>
            <Text style={[styles.amountValue, { color: headerColor }]}>
              {formatCurrency(entry.amount, activeBusinessCurrency, true)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Ionicons
              name="calendar-outline"
              size={20}
              color={colors.secondaryMutedText}
            />
            <Text
              style={[styles.detailText, { color: colors.primaryTextDark }]}
            >
              {entry.entry_date} • {entry.entry_time}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons
              name={
                entry.payment_mode === "ONLINE"
                  ? "globe-outline"
                  : "cash-outline"
              }
              size={20}
              color={colors.secondaryMutedText}
            />
            <Text
              style={[styles.detailText, { color: colors.primaryTextDark }]}
            >
              Payment Mode:{" "}
              <Text style={{ fontFamily: "Inter_600SemiBold" }}>
                {entry.payment_mode === "ONLINE" ? "Online" : "Cash"}
              </Text>
            </Text>
          </View>

          {entry.details && (
            <View style={styles.detailRow}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.secondaryMutedText}
              />
              <Text
                style={[styles.detailText, { color: colors.primaryTextDark }]}
              >
                {entry.details}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons
              name={entry.is_synced ? "cloud-done-outline" : "sync-outline"}
              size={20}
              color={
                entry.is_synced
                  ? colors.primaryGreen
                  : colors.secondaryMutedText
              }
            />
            <Text
              style={[
                styles.detailText,
                {
                  color: entry.is_synced
                    ? colors.primaryGreen
                    : colors.secondaryMutedText,
                },
              ]}
            >
              {entry.is_synced
                ? "Entry is backed up"
                : "Entry is not backed up"}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.cardSurface,
            borderTopColor: colors.borderDivider,
          },
        ]}
      >
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.borderDivider }]}
          onPress={() => setDeleteModalVisible(true)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.primaryRed} />
          <Text style={[styles.actionBtnText, { color: colors.primaryRed }]}>
            DELETE
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.primaryBlue,
              borderWidth: 1,
              borderColor: colors.primaryBlue,
            },
          ]}
          onPress={() =>
            router.push(
              `/cashbook/entry-form?type=${entry.type}&entryId=${entry.id}` as never,
            )
          }
        >
          <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
          <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
            EDIT ENTRY
          </Text>
        </Pressable>
      </View>

      <DeleteConfirmModal
        visible={deleteModalVisible}
        title="Delete this cashbook entry?"
        description="Are you sure? This action can be undone within 5 seconds."
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 16 : 30,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 18 },
  content: { flex: 1, padding: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, elevation: 1 },
  amountHeader: { alignItems: "center", marginBottom: 16 },
  amountLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  amountValue: { fontFamily: "Inter_700Bold", fontSize: 32 },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginBottom: 16 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  detailText: { fontFamily: "Inter_500Medium", fontSize: 15, flex: 1 },
  footer: { flexDirection: "row", padding: 16, borderTopWidth: 1, gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  actionBtnText: { fontFamily: "Inter_700Bold", fontSize: 14 },
});
