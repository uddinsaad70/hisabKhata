// apps/mobile/app/_layout.tsx
import "react-native-get-random-values";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primaryBlue },
          headerTintColor: COLORS.cardSurface,
          headerTitleStyle: { fontWeight: "700" },
        }}
      >
        {/* Main bottom-tab workspace (renders its own custom Royal Blue header) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
