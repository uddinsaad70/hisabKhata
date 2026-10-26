// apps/mobile/components/CustomerFilterModal.tsx
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useUiStore,
  type CustomerFilter,
  type CustomerSort,
} from "../store/uiStore";
import { getThemeColors } from "../constants/theme";

export interface CustomerFilterModalProps {
  visible: boolean;
  onClose: () => void;
}

const FILTER_OPTIONS: { value: CustomerFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "YOU_WILL_GET", label: "You will get" },
  { value: "YOU_WILL_GIVE", label: "You will give" },
  { value: "SETTLED", label: "Settled" },
];

const SORT_OPTIONS: { value: CustomerSort; label: string }[] = [
  { value: "MOST_RECENT", label: "Most Recent" },
  { value: "OLDEST", label: "Oldest" },
  { value: "HIGHEST_AMOUNT", label: "Highest Amount" },
  { value: "NAME_AZ", label: "Name (A-Z)" },
];

export function CustomerFilterModal({
  visible,
  onClose,
}: CustomerFilterModalProps) {
  const customerFilter = useUiStore((state) => state.customerFilter);
  const customerSort = useUiStore((state) => state.customerSort);
  const setCustomerFilter = useUiStore((state) => state.setCustomerFilter);
  const setCustomerSort = useUiStore((state) => state.setCustomerSort);
  const resetCustomerFilters = useUiStore(
    (state) => state.resetCustomerFilters,
  );
  const themeMode = useUiStore((state) => state.themeMode);

  const colors = getThemeColors(themeMode);

  const handleReset = () => {
    resetCustomerFilters();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismissArea} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
            },
          ]}
        >
          {/* Header Row */}
          <View
            style={[
              styles.headerRow,
              { borderBottomColor: colors.borderDivider },
            ]}
          >
            <Text
              style={[styles.headerTitle, { color: colors.primaryTextDark }]}
            >
              Filter & Sort Customers
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close filter modal"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons
                name="close"
                size={22}
                color={colors.secondaryMutedText}
              />
            </Pressable>
          </View>

          {/* Filter by Balance Status */}
          <Text
            style={[styles.sectionTitle, { color: colors.secondaryMutedText }]}
          >
            FILTER BY STATUS
          </Text>
          <View style={styles.chipsRow}>
            {FILTER_OPTIONS.map((opt) => {
              const selected = customerFilter === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setCustomerFilter(opt.value)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected
                        ? colors.primaryBlue
                        : colors.pageBackgroundGrey,
                      borderColor: selected
                        ? colors.primaryBlue
                        : colors.borderDivider,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      {
                        color: selected ? "#FFFFFF" : colors.primaryTextDark,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sort By Order */}
          <Text
            style={[
              styles.sectionTitle,
              styles.sortSectionTitle,
              { color: colors.secondaryMutedText },
            ]}
          >
            SORT BY
          </Text>
          <View style={styles.sortList}>
            {SORT_OPTIONS.map((opt) => {
              const selected = customerSort === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setCustomerSort(opt.value)}
                  style={[
                    styles.sortOptionRow,
                    { borderBottomColor: colors.borderDivider },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortOptionLabel,
                      {
                        color: selected
                          ? colors.primaryBlue
                          : colors.primaryTextDark,
                        fontFamily: selected
                          ? "Inter_700Bold"
                          : "Inter_500Medium",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <Ionicons
                    name={selected ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={
                      selected ? colors.primaryBlue : colors.secondaryMutedText
                    }
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Footer Buttons */}
          <View style={styles.footerRow}>
            <Pressable
              accessibilityRole="button"
              onPress={handleReset}
              style={[
                styles.resetButton,
                { borderColor: colors.borderDivider },
              ]}
            >
              <Text
                style={[
                  styles.resetButtonText,
                  { color: colors.secondaryMutedText },
                ]}
              >
                CLEAR ALL
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.applyButton,
                { backgroundColor: colors.primaryBlue },
              ]}
            >
              <Text style={styles.applyButtonText}>VIEW RESULTS</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  backdropDismissArea: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  closeBtn: {
    padding: 4,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 10,
  },
  sortSectionTitle: {
    marginTop: 18,
    marginBottom: 4,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  sortList: {
    marginBottom: 16,
  },
  sortOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortOptionLabel: {
    fontSize: 14,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  applyButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
