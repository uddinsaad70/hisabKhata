// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { COLORS, getThemeColors } from "../../constants/theme";
import { useUiStore } from "../../store/uiStore";

export default function TabsLayout() {
  const themeMode = useUiStore((state) => state.themeMode);
  const theme = getThemeColors(themeMode);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:
          themeMode === "dark" ? COLORS.activeTabIndicator : COLORS.primaryBlue,
        tabBarInactiveTintColor: theme.secondaryMutedText,
        tabBarStyle: {
          backgroundColor: theme.cardSurface,
          borderTopColor: theme.borderDivider,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18, color }} accessibilityElementsHidden>
              📒
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 18, color }} accessibilityElementsHidden>
              ⚙️
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
