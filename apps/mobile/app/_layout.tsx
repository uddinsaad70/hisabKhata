// apps/mobile/app/_layout.tsx
import "react-native-get-random-values";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";

export default function RootLayout() {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);

  // Load crisp Inter typography weights for fintech numbers and labels
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryBlue },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontFamily: "Inter_700Bold",
            fontWeight: "700",
          },
          contentStyle: { backgroundColor: colors.pageBackgroundGrey },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
