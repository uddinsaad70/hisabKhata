// apps/mobile/components/ThemedAlertModal.tsx
import React, { useState, useCallback } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";

export interface ThemedAlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface AlertState {
  visible: boolean;
  title: string;
  message: string;
  buttons: ThemedAlertButton[];
}

export function useThemedAlert() {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);

  const [state, setState] = useState<AlertState>({
    visible: false,
    title: "",
    message: "",
    buttons: [],
  });

  const showAlert = useCallback(
    (title: string, message: string, buttons?: ThemedAlertButton[]) => {
      setState({
        visible: true,
        title,
        message,
        buttons:
          buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
      });
    },
    [],
  );

  const closeAlert = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const hasDestructive = state.buttons.some((b) => b.style === "destructive");

  const alertElement = state.visible ? (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeAlert}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: hasDestructive
                  ? colors.lightPinkColumnTint
                  : "#DBEAFE",
              },
            ]}
          >
            <Ionicons
              name={
                hasDestructive
                  ? "warning-outline"
                  : "information-circle-outline"
              }
              size={28}
              color={hasDestructive ? colors.primaryRed : colors.primaryBlue}
            />
          </View>

          <Text style={[styles.title, { color: colors.primaryTextDark }]}>
            {state.title}
          </Text>
          <Text style={[styles.message, { color: colors.secondaryMutedText }]}>
            {state.message}
          </Text>

          <View style={styles.buttonRow}>
            {state.buttons.map((btn, idx) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";
              const isSingle = state.buttons.length === 1;

              return (
                <Pressable
                  key={idx}
                  onPress={() => {
                    closeAlert();
                    if (btn.onPress) {
                      setTimeout(() => btn.onPress?.(), 60);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.button,
                    isCancel
                      ? {
                          backgroundColor: colors.pageBackgroundGrey,
                          borderWidth: 1,
                          borderColor: colors.borderDivider,
                        }
                      : {
                          backgroundColor: isDestructive
                            ? colors.primaryRed
                            : colors.primaryBlue,
                        },
                    isSingle && { flex: 1 },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: isCancel ? colors.primaryTextDark : "#FFFFFF",
                      },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  ) : null;

  return { showAlert, alertElement };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontFamily: "Inter_400Regular",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
});