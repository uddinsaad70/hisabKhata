// apps/mobile/app/_layout.tsx
import "react-native-get-random-values";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
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
import { getDbAdapter, initializeAppDatabase } from "../db/client";
import {
  getAllBusinesses,
  getOrInitDeviceSyncState,
} from "../db/businessQueries";
import { AppLockGate } from "../components/AppLockGate";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const setActiveBusiness = useUiStore((state) => state.setActiveBusiness);
  const colors = getThemeColors(themeMode);

  // Load crisp Inter typography weights for fintech numbers and labels
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [dbInitialized, setDbInitialized] = useState<boolean>(false);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function setupDbAndBusiness() {
      try {
        await initializeAppDatabase();
        const db = await getDbAdapter();
        await getOrInitDeviceSyncState(db);
        const businesses = await getAllBusinesses(db);

        if (!isMounted) return;

        if (businesses.length === 0) {
          setNeedsOnboarding(true);
        } else {
          const current =
            businesses.find((b) => b.id === activeBusinessId) ?? businesses[0];
          setActiveBusiness(current.id, current.name, current.currency);
          setNeedsOnboarding(false);
        }
        setDbInitialized(true);
      } catch (err: unknown) {
        if (isMounted) {
          const message =
            err instanceof Error
              ? err.message
              : "Unknown database initialization error";
          setDbError(message);
        }
      }
    }

    setupDbAndBusiness();

    return () => {
      isMounted = false;
    };
  }, []);

useEffect(() => {
    if ((!fontsLoaded && !fontError) || !dbInitialized) return;

    const currentRoute = segments[0] as string;
    const inOnboarding = currentRoute === "onboarding";
    const inGoogleAuth = currentRoute === "google-auth";

    if (inGoogleAuth) return;

    if ((needsOnboarding || !activeBusinessId) && !inOnboarding) {
      router.replace("/onboarding" as any);
    } else if (activeBusinessId && inOnboarding) {
      setNeedsOnboarding(false);
      router.replace("/(tabs)");
    }
  }, [
    fontsLoaded,
    fontError,
    dbInitialized,
    needsOnboarding,
    activeBusinessId,
    segments,
  ]);

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
    <AppLockGate>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.primaryBlue },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontFamily: "Inter_700Bold",
          },
          contentStyle: { backgroundColor: colors.pageBackgroundGrey },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="google-auth" options={{ headerShown: false }} />
      </Stack>
    </AppLockGate>
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
