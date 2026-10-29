// apps/mobile/components/AppLockGate.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import {
  getAppLockConfig,
  promptBiometricUnlock,
  verifyAppLockPin,
} from "../utils/appLockService";

interface Props {
  children: React.ReactNode;
}

export function AppLockGate({ children }: Props) {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);

  const [isLocked, setIsLocked] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const appStateRef = useRef<string>(AppState.currentState ?? "active");
  const handleBiometricAttempt = useCallback(async () => {
    const success = await promptBiometricUnlock();
    if (success) {
      setIsLocked(false);
      setPinInput("");
      setErrorText(null);
    }
  }, []);

  const checkLockStatus = useCallback(
    async (triggerBio: boolean) => {
      const config = await getAppLockConfig();
      if (config.isPinEnabled) {
        setIsLocked(true);
        setCanUseBiometric(config.isBiometricEnabled);
        setPinInput("");
        setErrorText(null);
        if (triggerBio && config.isBiometricEnabled) {
          void handleBiometricAttempt();
        }
      } else {
        setIsLocked(false);
      }
    },
    [handleBiometricAttempt],
  );

  // Check lock on initial app mount
  useEffect(() => {
    void checkLockStatus(true);
  }, [checkLockStatus]);

  // Re-lock whenever the app returns from background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current === "background" && nextState === "active") {
        void checkLockStatus(true);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [checkLockStatus]);

  const handleDigitPress = async (digit: string) => {
    if (pinInput.length >= 4) return;
    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setErrorText(null);

    if (nextPin.length === 4) {
      const valid = await verifyAppLockPin(nextPin);
      if (valid) {
        setIsLocked(false);
        setPinInput("");
      } else {
        setErrorText("Incorrect PIN. Please try again.");
        setPinInput("");
      }
    }
  };

  const handleBackspace = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorText(null);
  };

  return (
    <View style={{ flex: 1 }}>
      {children}

      {isLocked && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.lockOverlay,
            { backgroundColor: colors.primaryBlue },
          ]}
        >
          <View style={styles.topSection}>
            <View style={styles.iconBadge}>
              <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.lockTitle}>HisabKhata Locked</Text>
            <Text style={styles.lockSubtitle}>
              Enter your 4-digit security PIN
            </Text>

            {/* 4 PIN Dots */}
            <View style={styles.dotsRow}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = idx < pinInput.length;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinDot,
                      filled ? styles.pinDotFilled : styles.pinDotEmpty,
                    ]}
                  />
                );
              })}
            </View>

            {errorText ? (
              <Text style={styles.errorLabel}>{errorText}</Text>
            ) : null}
          </View>

          {/* Numeric PIN Pad */}
          <View style={styles.keypadGrid}>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <Pressable
                key={digit}
                onPress={() => void handleDigitPress(digit)}
                style={({ pressed }) => [
                  styles.keyButton,
                  pressed && styles.keyButtonPressed,
                ]}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </Pressable>
            ))}

            {/* Bottom Row: Biometric, 0, Backspace */}
            <Pressable
              onPress={() => {
                if (canUseBiometric) void handleBiometricAttempt();
              }}
              style={styles.keyButton}
            >
              {canUseBiometric ? (
                <Ionicons name="finger-print" size={28} color="#FFFFFF" />
              ) : null}
            </Pressable>

            <Pressable
              onPress={() => void handleDigitPress("0")}
              style={({ pressed }) => [
                styles.keyButton,
                pressed && styles.keyButtonPressed,
              ]}
            >
              <Text style={styles.keyText}>0</Text>
            </Pressable>

            <Pressable onPress={handleBackspace} style={styles.keyButton}>
              <Ionicons name="backspace-outline" size={26} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lockOverlay: {
    zIndex: 9999,
    justifyContent: "space-between",
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  topSection: {
    alignItems: "center",
    marginTop: 24,
  },
  iconBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  lockTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginBottom: 6,
  },
  lockSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 16,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinDotEmpty: {
    backgroundColor: "transparent",
  },
  pinDotFilled: {
    backgroundColor: "#FFFFFF",
  },
  errorLabel: {
    color: "#FCA5A5",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginTop: 8,
  },
  keypadGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: 320,
    alignSelf: "center",
    rowGap: 16,
    columnGap: 24,
  },
  keyButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  keyButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  keyText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
});
