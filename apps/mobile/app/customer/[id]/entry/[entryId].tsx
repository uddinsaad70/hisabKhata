// apps/mobile/app/customer/[id]/entry/[entryId].tsx
import React, { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useUiStore } from "../../../../store/uiStore";
import { getThemeColors } from "../../../../constants/theme";
import { getDbAdapter } from "../../../../db/client";
import { formatCurrency } from "../../../../utils/formatCurrency";
import {
  getCustomerEntryById,
  softDeleteCustomerEntry,
  type CustomerEntryRow,
} from "../../../../db/customerQueries";
import { DeleteConfirmModal } from "../../../../components/DeleteConfirmModal";
import { getStrings } from "../../../../constants/translations";

export default function CustomerEntryDetailsScreen() {
  const { id, entryId } = useLocalSearchParams<{
    id: string;
    entryId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const showUndoSnackbar = useUiStore((state) => state.showUndoSnackbar);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  const [entry, setEntry] = useState<CustomerEntryRow | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function loadEntry() {
        if (!activeBusinessId || !entryId) return;
        const db = await getDbAdapter();
        const data = await getCustomerEntryById(db, activeBusinessId, entryId);
        setEntry(data);
      }
      void loadEntry();
    }, [activeBusinessId, entryId]),
  );

  if (!entry) return null;

  const isGave = entry.type === "GAVE";
  const headerColor = isGave ? colors.primaryRed : colors.primaryGreen;

  const handleDelete = async () => {
    if (!activeBusinessId || !id || !entryId) return;
    try {
      const db = await getDbAdapter();
      await softDeleteCustomerEntry(db, activeBusinessId, id, entryId);
      setDeleteModalVisible(false);

      // Show Snackbar for Undo
      showUndoSnackbar({
        entryId,
        entryDomain: "customer",
        customerId: id,
        message: t.entryDeletedToast,
      });

      router.back();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: headerColor,
            paddingTop:
              Math.max(insets.top, Platform.OS === "android" ? 28 : 44) + 12,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t.entryDetailsTitle}</Text>
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
              {isGave ? t.youGaveLabel : t.youGotLabel}
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

          {entry.details ? (
            <View style={[styles.detailRow, { alignItems: "flex-start" }]}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.secondaryMutedText}
                style={{ marginTop: 2 }}
              />
              <Text
                style={[
                  styles.detailText,
                  { color: colors.primaryTextDark, lineHeight: 22 },
                ]}
              >
                {entry.details.replace(
                  /([0-9.)])\s*([+\-×÷=])\s*(?=[0-9.(])/g,
                  "$1 $2 ",
                )}
              </Text>
            </View>
          ) : null}

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
              {entry.is_synced ? t.entryBackedUp : t.entryNotBackedUp}
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
            paddingBottom: 16 + insets.bottom,
          },
        ]}
      >
        <Pressable
          style={[styles.actionBtn, { borderColor: colors.borderDivider }]}
          onPress={() => setDeleteModalVisible(true)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.primaryRed} />
          <Text style={[styles.actionBtnText, { color: colors.primaryRed }]}>
            {t.deleteBtn}
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
              `/customer/${id}/entry-form?type=${entry.type}&entryId=${entry.id}` as never,
            )
          }
        >
          <Ionicons name="pencil-outline" size={20} color="#FFFFFF" />
          <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>
            {t.editEntryBtn}
          </Text>
        </Pressable>
      </View>

      <DeleteConfirmModal
        visible={deleteModalVisible}
        title={t.deleteEntryConfirmTitle}
        description={t.deleteEntryConfirmDesc}
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
    paddingTop: Platform.OS === "android" ? 40 : 50,
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