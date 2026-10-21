// apps/mobile/app/(tabs)/more.tsx
import React from "react";
import {
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";

export default function MoreSettingsScreen() {
  const themeMode = useUiStore((state) => state.themeMode);
  const toggleThemeMode = useUiStore((state) => state.toggleThemeMode);
  const activeBusinessName = useUiStore((state) => state.activeBusinessName);

  const colors = getThemeColors(themeMode);
  const isDark = themeMode === "dark";

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      <SafeAreaView
        style={[styles.headerSafeArea, { backgroundColor: colors.primaryBlue }]}
      >
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>More & Settings</Text>
          <Text style={styles.headerSubtitle}>{activeBusinessName}</Text>
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        {/* Appearance Card: Light / Dark Theme Toggle */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
            },
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <Ionicons
                name={isDark ? "moon-outline" : "sunny-outline"}
                size={22}
                color={colors.primaryBlue}
                style={styles.rowIcon}
              />
              <View style={styles.textColumn}>
                <Text
                  style={[
                    styles.settingTitle,
                    { color: colors.primaryTextDark },
                  ]}
                >
                  Dark Theme
                </Text>
                <Text
                  style={[
                    styles.settingDescription,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  Switch between light and dark display mode
                </Text>
              </View>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleThemeMode}
              trackColor={{
                false: colors.borderDivider,
                true: colors.primaryGreen,
              }}
            />
          </View>
        </View>

        {/* Upcoming Settings Preview Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
            },
          ]}
        >
          <View style={styles.settingItemRow}>
            <Ionicons
              name="cash-outline"
              size={20}
              color={colors.secondaryMutedText}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                Business Profile & Currency (BDT / INR)
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.secondaryMutedText },
                ]}
              >
                Connects in CP15
              </Text>
            </View>
          </View>

          <View
            style={[styles.divider, { backgroundColor: colors.borderDivider }]}
          />

          <View style={styles.settingItemRow}>
            <Ionicons
              name="language-outline"
              size={20}
              color={colors.secondaryMutedText}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                Language (Bengali / English)
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.secondaryMutedText },
                ]}
              >
                Connects in CP15
              </Text>
            </View>
          </View>

          <View
            style={[styles.divider, { backgroundColor: colors.borderDivider }]}
          />

          <View style={styles.settingItemRow}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={colors.secondaryMutedText}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                App Lock (PIN & Biometric)
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.secondaryMutedText },
                ]}
              >
                Connects in CP16
              </Text>
            </View>
          </View>

          <View
            style={[styles.divider, { backgroundColor: colors.borderDivider }]}
          />

          <View style={styles.settingItemRow}>
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={colors.secondaryMutedText}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                Local Backup & Cloud Sync
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.secondaryMutedText },
                ]}
              >
                Connects in CP17 & Phase 2
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafeArea: {
    paddingTop:
      Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 0) : 0,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.8)",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  settingItemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowIcon: {
    marginRight: 12,
  },
  textColumn: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  settingDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 3,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
});
