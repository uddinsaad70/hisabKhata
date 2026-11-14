// apps/mobile/app/google-auth.tsx
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";

export default function GoogleAuthCallbackScreen() {
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const colors = getThemeColors(themeMode);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeBusinessId) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding" as any);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [activeBusinessId, router]);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.pageBackgroundGrey }]}
    >
      <ActivityIndicator size="large" color={colors.primaryBlue} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});