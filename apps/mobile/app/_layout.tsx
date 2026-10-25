// apps/mobile/app/_layout.tsx
import "react-native-get-random-values";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
import { initializeAppDatabase } from "../db/client";

export default function RootLayout() {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);

  // Load crisp Inter typography weights for fintech numbers and labels
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [dbInitialized, setDbInitialized] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    initializeAppDatabase()
      .then(() => {
        if (isMounted) {
          setDbInitialized(true);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message =
            err instanceof Error
              ? err.message
              : "Unknown database initialization error";
          setDbError(message);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (dbError) {
    return (
      <View
        style={[
          styles.centerScreen,
          { backgroundColor: colors.pageBackgroundGrey },
        ]}
      >
        <Text style={[styles.errorTitle, { color: colors.primaryRed }]}>
          Database Migration Error
        </Text>
        <Text style={[styles.errorBody, { color: colors.primaryTextDark }]}>
          {dbError}
        </Text>
      </View>
    );
  }

  if ((!fontsLoaded && !fontError) || !dbInitialized) {
    return (
      <View
        style={[styles.centerScreen, { backgroundColor: colors.primaryBlue }]}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryBlue },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontFamily: "Inter_700Bold",
          },
          contentStyle: { backgroundColor: colors.pageBackgroundGrey },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
