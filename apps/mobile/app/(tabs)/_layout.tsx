// apps/mobile/app/(tabs)/_layout.tsx
import React from "react";
import { Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";

export default function TabLayout() {
  const themeMode = useUiStore((state) => state.themeMode);
  const colors = getThemeColors(themeMode);
  const insets = useSafeAreaInsets();

  const bottomPadding = Math.max(insets.bottom, 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:
          themeMode === "dark" ? colors.activeTabIndicator : colors.primaryBlue,
        tabBarInactiveTintColor: colors.secondaryMutedText,
        tabBarStyle: {
          backgroundColor: colors.cardSurface,
          borderTopColor: colors.borderDivider,
          borderTopWidth: 1,
          height: 58 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
              Home
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "book" : "book-outline"}
              size={22}
              color={typeof color === "string" ? color : colors.primaryBlue}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarLabel: ({ color }) => (
            <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
              More
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "settings" : "settings-outline"}
              size={22}
              color={
                typeof color === "string" ? color : colors.secondaryMutedText
              }
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    width: "100%",
    textAlign: "center",
    marginTop: 2,
  },
});
