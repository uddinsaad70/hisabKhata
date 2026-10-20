// apps/mobile/app/(tabs)/more.tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, getThemeColors } from "../../constants/theme";
import { useUiStore } from "../../store/uiStore";

export default function MoreSettingsScreen() {
  const insets = useSafeAreaInsets();
  const themeMode = useUiStore((state) => state.themeMode);
  const toggleThemeMode = useUiStore((state) => state.toggleThemeMode);
  const theme = getThemeColors(themeMode);

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.pageBackgroundGrey }]}
    >
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.primaryBlue,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <Text style={styles.headerTitle}>More & Settings</Text>
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardSurface,
              borderColor: theme.borderDivider,
            },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingTextCol}>
              <Text
                style={[styles.settingTitle, { color: theme.primaryTextDark }]}
              >
                Appearance Theme
              </Text>
              <Text
                style={[
                  styles.settingSubtitle,
                  { color: theme.secondaryMutedText },
                ]}
              >
                Current mode:{" "}
                {themeMode === "dark" ? "Dark Mode" : "Light Mode"}
              </Text>
            </View>

            <Pressable
              style={styles.toggleButton}
              onPress={toggleThemeMode}
              accessibilityRole="button"
              accessibilityLabel="Toggle dark or light theme"
            >
              <Text style={styles.toggleButtonText}>
                Switch to {themeMode === "dark" ? "Light" : "Dark"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    color: COLORS.cardSurface,
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingTextCol: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 13,
  },
  toggleButton: {
    backgroundColor: COLORS.primaryBlue,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: COLORS.cardSurface,
    fontSize: 13,
    fontWeight: "600",
  },
});
