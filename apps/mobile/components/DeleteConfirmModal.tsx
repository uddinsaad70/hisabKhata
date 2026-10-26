// apps/mobile/components/DeleteConfirmModal.tsx
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";

export interface DeleteConfirmModalProps {
  visible: boolean;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  visible,
  title = "Delete Entry?",
  description = "Are you sure you want to delete this? This action can be undone within 5 seconds.",
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.dialogBox, { backgroundColor: colors.cardSurface }]}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: colors.lightPinkColumnTint },
            ]}
          >
            <Ionicons
              name="trash-outline"
              size={28}
              color={colors.primaryRed}
            />
          </View>
          <Text style={[styles.title, { color: colors.primaryTextDark }]}>
            {title}
          </Text>
          <Text
            style={[styles.description, { color: colors.secondaryMutedText }]}
          >
            {description}
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={[styles.button, styles.cancelButton]}
            >
              <Text
                style={[styles.buttonText, { color: colors.primaryTextDark }]}
              >
                CANCEL
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: colors.primaryRed },
              ]}
            >
              <Text style={[styles.buttonText, { color: "#FFFFFF" }]}>
                DELETE
              </Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dialogBox: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "transparent",
  },
  confirmButton: {},
  buttonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
