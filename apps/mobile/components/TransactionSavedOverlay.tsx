// apps/mobile/components/TransactionSavedOverlay.tsx
import React, { useEffect, useRef } from "react";
import { Animated, Modal, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { formatCurrency } from "../utils/formatCurrency";
import { animationDuration } from "../utils/animation";

export interface TransactionSavedOverlayProps {
  visible: boolean;
  amount: number;
  title: string;
  accentColor: string;
  badgeText?: string;
  subtitle?: string | null;
  dateText?: string;
  isNegative?: boolean;
}

export function TransactionSavedOverlay({
  visible,
  amount,
  title,
  accentColor,
  badgeText,
  subtitle,
  dateText,
  isNegative = false,
}: TransactionSavedOverlayProps) {
  const themeMode = useUiStore((state) => state.themeMode);
  const currency = useUiStore((state) => state.activeBusinessCurrency);
  const colors = getThemeColors(themeMode);

  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ringScaleAnim = useRef(new Animated.Value(0.8)).current;
  const ringOpacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0);
      ringScaleAnim.setValue(0.8);
      ringOpacityAnim.setValue(0.65);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 95,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
// Expanding halo ripple around the checkmark
        Animated.timing(ringScaleAnim, {
          toValue: 1.75,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacityAnim, {
          toValue: 0,
          duration: animationDuration,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim, ringScaleAnim, ringOpacityAnim]);

  if (!visible) return null;

  const signPrefix = isNegative ? "- " : "+ ";

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Checkmark + Expanding Pulse Ring */}
          <View style={styles.iconWrapper}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  borderColor: accentColor,
                  opacity: ringOpacityAnim,
                  transform: [{ scale: ringScaleAnim }],
                },
              ]}
            />
            <View style={[styles.iconCircle, { backgroundColor: accentColor }]}>
              <Ionicons name="checkmark-sharp" size={36} color="#FFFFFF" />
            </View>
          </View>

          {/* Dynamic Transaction Type Pill Badge */}
          {badgeText ? (
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: isNegative
                    ? colors.lightPinkColumnTint
                    : colors.lightGreenBadgeTint,
                },
              ]}
            >
              <Ionicons
                name={isNegative ? "arrow-up-circle" : "arrow-down-circle"}
                size={14}
                color={accentColor}
              />
              <Text style={[styles.typeBadgeText, { color: accentColor }]}>
                {badgeText}
              </Text>
            </View>
          ) : null}

          {/* Signed Formatted Amount */}
          <Text
            style={[styles.amountText, { color: accentColor }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {signPrefix}
            {formatCurrency(amount, currency, true)}
          </Text>

          {/* Status Title */}
          <Text style={[styles.titleText, { color: colors.primaryTextDark }]}>
            {title}
          </Text>

          {/* Optional Note/Details & Date Receipt Footer */}
          {subtitle || dateText ? (
            <View
              style={[
                styles.metaBox,
                {
                  backgroundColor: colors.pageBackgroundGrey,
                  borderColor: colors.borderDivider,
                },
              ]}
            >
              {subtitle ? (
                <Text
                  style={[styles.subtitleText, { color: colors.primaryTextDark }]}
                  numberOfLines={1}
                >
                  “{subtitle}”
                </Text>
              ) : null}
              {dateText ? (
                <Text
                  style={[
                    styles.dateMetaText,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {dateText}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: 265,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pulseRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
    marginBottom: 8,
  },
  typeBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  amountText: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    marginBottom: 4,
  },
  titleText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
  metaBox: {
    marginTop: 12,
    width: "100%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
  subtitleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textAlign: "center",
  },
  dateMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
});