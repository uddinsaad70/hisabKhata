// apps/mobile/components/CalculatorKeypad.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";

export interface CalculatorKeypadProps {
  onKeyPress: (key: string) => void;
  onEvaluate: () => void;
  onDelete: () => void;
}

const KEYPAD_BUTTONS = [
  ["C", "%", "M+", "⌫"],
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "-"],
  [".", "0", "=", "+"],
];

export function CalculatorKeypad({
  onKeyPress,
  onEvaluate,
  onDelete,
}: CalculatorKeypadProps) {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);

  const handlePress = (key: string) => {
    if (key === "=") {
      onEvaluate();
    } else if (key === "⌫") {
      onDelete();
    } else {
      onKeyPress(key);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.pageBackgroundGrey,
          borderTopColor: colors.borderDivider,
        },
      ]}
    >
      {KEYPAD_BUTTONS.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((key) => {
            const isOperator = ["÷", "×", "-", "+", "="].includes(key);
            const isAction = ["C", "%", "M+", "⌫"].includes(key);
            const isDelete = key === "⌫";

            let btnBgColor = colors.cardSurface;
            let btnTextColor = colors.primaryTextDark;

            if (key === "=") {
              btnBgColor = colors.primaryBlue;
              btnTextColor = "#FFFFFF";
            } else if (isOperator) {
              btnBgColor = colors.lightPinkColumnTint;
              btnTextColor = colors.primaryRed;
            } else if (isAction) {
              btnBgColor = "#E2E8F0"; // slightly darker grey for action buttons
              btnTextColor = colors.primaryTextDark;
            }

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                onPress={() => handlePress(key)}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: btnBgColor },
                  pressed && { opacity: 0.7 },
                ]}
              >
                {isDelete ? (
                  <Ionicons
                    name="backspace-outline"
                    size={24}
                    color={btnTextColor}
                  />
                ) : (
                  <Text
                    style={[
                      styles.buttonText,
                      { color: btnTextColor },
                      (isOperator || isAction) && styles.operatorText,
                    ]}
                  >
                    {key}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
    borderTopWidth: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  button: {
    flex: 1,
    aspectRatio: 1.25, // Make buttons slightly wider than tall
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
  },
  operatorText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
});
