// apps/mobile/app/(tabs)/more.tsx
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { getDbAdapter } from "../../db/client";
import { updateBusinessProfile } from "../../db/businessQueries";
import { type CurrencyCode } from "../../utils/formatCurrency";
import { BusinessSwitcherModal } from "../../components/BusinessSwitcherModal";

export default function MoreSettingsScreen() {
  const themeMode = useUiStore((state) => state.themeMode);
  const toggleThemeMode = useUiStore((state) => state.toggleThemeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessName = useUiStore((state) => state.activeBusinessName);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const setActiveBusiness = useUiStore((state) => state.setActiveBusiness);
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);

  const colors = getThemeColors(themeMode);
  const isDark = themeMode === "dark";

  // Modal states for CP15 Business Profile & Switcher
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [editName, setEditName] = useState(activeBusinessName);
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>(
    activeBusinessCurrency,
  );

  const handleOpenEditModal = () => {
    setEditName(activeBusinessName);
    setEditCurrency(activeBusinessCurrency);
    setEditModalVisible(true);
  };

  const handleSaveBusinessProfile = async () => {
    if (!activeBusinessId) return;
    if (!editName.trim()) {
      Alert.alert("Validation Error", "Business name cannot be empty.");
      return;
    }
    try {
      const db = getDbAdapter();
      await updateBusinessProfile(
        db,
        activeBusinessId,
        editName.trim(),
        editCurrency,
      );
      setActiveBusiness(activeBusinessId, editName.trim(), editCurrency);
      setEditModalVisible(false);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to update business profile.",
      );
    }
  };

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
          {/* CP15: Active Business Profile & Currency Editor */}
          <Pressable
            onPress={handleOpenEditModal}
            style={styles.settingItemRow}
          >
            <Ionicons
              name="business-outline"
              size={20}
              color={colors.primaryBlue}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                Business Profile & Currency
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.secondaryMutedText },
                ]}
              >
                {activeBusinessName} • Currency: {activeBusinessCurrency} (
                {activeBusinessCurrency === "BDT" ? "৳" : "₹"})
              </Text>
            </View>
            <Ionicons
              name="create-outline"
              size={20}
              color={colors.primaryBlue}
            />
          </Pressable>

          <View
            style={[styles.divider, { backgroundColor: colors.borderDivider }]}
          />

          {/* CP15: Switch or Add Business */}
          <Pressable
            onPress={() => setSwitcherVisible(true)}
            style={styles.settingItemRow}
          >
            <Ionicons
              name="swap-horizontal-outline"
              size={20}
              color={colors.primaryBlue}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                Switch or Add Business
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.secondaryMutedText },
                ]}
              >
                Manage multiple business ledgers
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.secondaryMutedText}
            />
          </Pressable>

          <View
            style={[styles.divider, { backgroundColor: colors.borderDivider }]}
          />

          {/* CP15: Language Selector (English / Bengali) */}
          <Pressable
            onPress={() => setLanguage(language === "en" ? "bn" : "en")}
            style={styles.settingItemRow}
          >
            <Ionicons
              name="language-outline"
              size={20}
              color={colors.primaryBlue}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                Language (বাংলা / English)
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  { color: colors.secondaryMutedText },
                ]}
              >
                Active: {language === "en" ? "English" : "বাংলা (Bengali)"} (Tap
                to switch)
              </Text>
            </View>
            <View
              style={[
                styles.langBadge,
                { backgroundColor: `${colors.primaryBlue}15` },
              ]}
            >
              <Text
                style={[styles.langBadgeText, { color: colors.primaryBlue }]}
              >
                {language === "en" ? "EN" : "বাংলা"}
              </Text>
            </View>
          </Pressable>

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

      {/* Edit Business Profile & Currency Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.modalCard, { backgroundColor: colors.cardSurface }]}
          >
            <Text
              style={[styles.modalTitle, { color: colors.primaryTextDark }]}
            >
              Edit Business Profile
            </Text>

            <Text
              style={[styles.inputLabel, { color: colors.secondaryMutedText }]}
            >
              BUSINESS NAME
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={[
                styles.input,
                {
                  color: colors.primaryTextDark,
                  borderColor: colors.borderDivider,
                },
              ]}
              placeholder="Enter business name"
              placeholderTextColor={colors.secondaryMutedText}
            />

            <Text
              style={[styles.inputLabel, { color: colors.secondaryMutedText }]}
            >
              CURRENCY
            </Text>
            <View style={styles.currencyRow}>
              {(["BDT", "INR"] as const).map((curr) => (
                <Pressable
                  key={curr}
                  onPress={() => setEditCurrency(curr)}
                  style={[
                    styles.currencyOption,
                    {
                      borderColor:
                        editCurrency === curr
                          ? colors.primaryBlue
                          : colors.borderDivider,
                      backgroundColor:
                        editCurrency === curr
                          ? `${colors.primaryBlue}15`
                          : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.currencyOptionText,
                      {
                        color:
                          editCurrency === curr
                            ? colors.primaryBlue
                            : colors.primaryTextDark,
                      },
                    ]}
                  >
                    {curr === "BDT" ? "৳ BDT (Taka)" : "₹ INR (Rupee)"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditModalVisible(false)}
                style={[
                  styles.modalBtn,
                  { borderColor: colors.borderDivider, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  CANCEL
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSaveBusinessProfile}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.primaryBlue },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                  SAVE
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Business Switcher Modal */}
      <BusinessSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
      />
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
  langBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  langBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginBottom: 16,
  },
  currencyRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  currencyOption: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  currencyOptionText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
});
