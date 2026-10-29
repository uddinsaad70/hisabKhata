// apps/mobile/app/(tabs)/more.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  exportBusinessBackupJson,
  getBusinessBackupStats,
  pickAndRestoreBackupJson,
  type BackupStats,
} from "../../utils/backupService";
import {
  getAppLockConfig,
  promptBiometricUnlock,
  saveAndEnableAppLockPin,
  setAppLockActive,
  setBiometricUnlockEnabled,
} from "../../utils/appLockService";
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
  ActivityIndicator,
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

  // CP16: App Lock States (PIN persists across ON/OFF toggles)
  const [appLockModalVisible, setAppLockModalVisible] = useState(false);
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [hasSavedPin, setHasSavedPin] = useState(false);
  const [isBioEnabled, setIsBioEnabled] = useState(false);
  const [isBioSupported, setIsBioSupported] = useState(false);
  const [showPinInputForm, setShowPinInputForm] = useState(false);
  const [newPin, setNewPin] = useState("");

  const refreshLockConfig = async () => {
    const cfg = await getAppLockConfig();
    setIsPinEnabled(cfg.isPinEnabled);
    setHasSavedPin(cfg.hasSavedPin);
    setIsBioEnabled(cfg.isBiometricEnabled);
    setIsBioSupported(cfg.isBiometricHardwareAvailable);
  };

  useEffect(() => {
    void refreshLockConfig();
  }, []);

  const handleOpenAppLockModal = () => {
    setNewPin("");
    // Show PIN input box immediately only if no PIN is saved yet
    setShowPinInputForm(!hasSavedPin);
    setAppLockModalVisible(true);
  };

  // Toggle App Lock ON/OFF using the existing saved PIN
  const handleToggleAppLockSwitch = async (enable: boolean) => {
    if (enable && !hasSavedPin) {
      setShowPinInputForm(true);
      return;
    }
    await setAppLockActive(enable);
    await refreshLockConfig();
  };

  const handleSavePin = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      Alert.alert("Invalid PIN", "Please enter an exact 4-digit numeric PIN.");
      return;
    }
    try {
      await saveAndEnableAppLockPin(
        newPin,
        isBioSupported ? isBioEnabled : false,
      );
      setNewPin("");
      setShowPinInputForm(false);
      await refreshLockConfig();
      Alert.alert("PIN Saved", "Your 4-digit App Lock PIN is active.");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not save PIN.");
    }
  };

  // Verify fingerprint immediately when user toggles Biometric ON
  const handleToggleBiometric = async (enable: boolean) => {
    if (enable) {
      const verified = await promptBiometricUnlock();
      if (!verified) {
        Alert.alert(
          "Verification Failed",
          "Could not verify your fingerprint.",
        );
        return;
      }
    }
    setIsBioEnabled(enable);
    await setBiometricUnlockEnabled(enable);
    await refreshLockConfig();
  };

  // CP17: Local Backup & Restore States
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [backupStats, setBackupStats] = useState<BackupStats>({
    totalCustomers: 0,
    totalCustomerEntries: 0,
    totalCashbookEntries: 0,
    unsyncedCount: 0,
  });

  const loadBackupStats = useCallback(async () => {
    if (!activeBusinessId || Platform.OS === "web") return;
    try {
      const db = getDbAdapter();
      const stats = await getBusinessBackupStats(db, activeBusinessId);
      setBackupStats(stats);
    } catch {
      // Ignore stats error before DB is ready
    }
  }, [activeBusinessId]);

  useFocusEffect(
    useCallback(() => {
      void loadBackupStats();
    }, [loadBackupStats]),
  );

  const handleExportBackup = async () => {
    if (!activeBusinessId || isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      const db = getDbAdapter();
      await exportBusinessBackupJson(
        db,
        activeBusinessId,
        activeBusinessName || "Business",
      );
      await loadBackupStats();
    } catch (err: any) {
      Alert.alert("Export Failed", err.message || "Could not export backup.");
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (isBackupBusy) return;
    setIsBackupBusy(true);
    try {
      const db = getDbAdapter();
      const res = await pickAndRestoreBackupJson(db);
      if (res.restored && res.businessId && res.businessName && res.currency) {
        setActiveBusiness(res.businessId, res.businessName, res.currency);
        await loadBackupStats();
        setBackupModalVisible(false);
        Alert.alert(
          "Backup Restored",
          `Successfully restored "${res.businessName}" (${res.customersCount} customers, ${res.entriesCount} entries).`,
        );
      }
    } catch (err: any) {
      Alert.alert("Restore Failed", err.message || "Could not restore backup.");
    } finally {
      setIsBackupBusy(false);
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

          {/* CP16: App Lock (PIN & Biometric) */}
          <Pressable
            onPress={handleOpenAppLockModal}
            style={styles.settingItemRow}
          >
            <Ionicons
              name={isPinEnabled ? "lock-closed" : "lock-open-outline"}
              size={20}
              color={isPinEnabled ? colors.primaryGreen : colors.primaryBlue}
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
                  {
                    color: isPinEnabled
                      ? colors.primaryGreen
                      : colors.secondaryMutedText,
                  },
                ]}
              >
                {isPinEnabled
                  ? `ON (4-Digit PIN${isBioEnabled ? " + Fingerprint" : ""})`
                  : hasSavedPin
                    ? "OFF (Saved PIN ready • Tap to turn ON)"
                    : "OFF • Tap to set 4-digit PIN"}
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

          {/* CP17: Local Backup & Restore */}
          <Pressable
            onPress={() => {
              void loadBackupStats();
              setBackupModalVisible(true);
            }}
            style={styles.settingItemRow}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={colors.primaryBlue}
              style={styles.rowIcon}
            />
            <View style={styles.textColumn}>
              <Text
                style={[styles.settingTitle, { color: colors.primaryTextDark }]}
              >
                Local Backup & Restore
              </Text>
              <Text
                style={[
                  styles.settingDescription,
                  {
                    color:
                      backupStats.unsyncedCount === 0
                        ? colors.primaryGreen
                        : colors.secondaryMutedText,
                  },
                ]}
              >
                {backupStats.unsyncedCount === 0
                  ? `All backed up (${backupStats.totalCustomers} Customers • ${backupStats.totalCustomerEntries + backupStats.totalCashbookEntries} Entries)`
                  : `${backupStats.unsyncedCount} unsynced changes • Tap to backup`}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.secondaryMutedText}
            />
          </Pressable>
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
      {/* CP16: App Lock Configuration Modal */}
      <Modal
        visible={appLockModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAppLockModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.modalCard, { backgroundColor: colors.cardSurface }]}
          >
            <Text
              style={[styles.modalTitle, { color: colors.primaryTextDark }]}
            >
              App Lock Security
            </Text>

            {/* 1. Simple ON/OFF Switch when a PIN is already saved */}
            {hasSavedPin && (
              <View style={[styles.rowBetween, { marginBottom: 16 }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={[
                      styles.settingTitle,
                      { color: colors.primaryTextDark, fontSize: 14 },
                    ]}
                  >
                    Enable App Lock
                  </Text>
                  <Text
                    style={[
                      styles.settingDescription,
                      { color: colors.secondaryMutedText, fontSize: 12 },
                    ]}
                  >
                    Uses your saved 4-digit PIN
                  </Text>
                </View>
                <Switch
                  value={isPinEnabled}
                  onValueChange={(v) => void handleToggleAppLockSwitch(v)}
                  trackColor={{
                    false: colors.borderDivider,
                    true: colors.primaryGreen,
                  }}
                />
              </View>
            )}

            {/* 2. Fingerprint Toggle (Only shown when App Lock is ON) */}
            {isBioSupported && hasSavedPin && isPinEnabled && (
              <View style={[styles.rowBetween, { marginBottom: 16 }]}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={[
                      styles.settingTitle,
                      { color: colors.primaryTextDark, fontSize: 14 },
                    ]}
                  >
                    Unlock with Fingerprint
                  </Text>
                  <Text
                    style={[
                      styles.settingDescription,
                      { color: colors.secondaryMutedText, fontSize: 12 },
                    ]}
                  >
                    Verify fingerprint to unlock without typing PIN
                  </Text>
                </View>
                <Switch
                  value={isBioEnabled}
                  onValueChange={(v) => void handleToggleBiometric(v)}
                  trackColor={{
                    false: colors.borderDivider,
                    true: colors.primaryGreen,
                  }}
                />
              </View>
            )}

            {/* 3. Button to change PIN if PIN already exists */}
            {hasSavedPin && !showPinInputForm && (
              <Pressable
                onPress={() => setShowPinInputForm(true)}
                style={[
                  styles.changePinBtn,
                  { borderColor: colors.primaryBlue },
                ]}
              >
                <Ionicons
                  name="key-outline"
                  size={16}
                  color={colors.primaryBlue}
                />
                <Text
                  style={[styles.changePinText, { color: colors.primaryBlue }]}
                >
                  Change 4-Digit PIN
                </Text>
              </Pressable>
            )}

            {/* 4. PIN Input Box (Shown on first setup or when changing PIN) */}
            {showPinInputForm && (
              <View style={{ marginTop: 4 }}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {hasSavedPin ? "ENTER NEW 4-DIGIT PIN" : "SET 4-DIGIT PIN"}
                </Text>
                <TextInput
                  value={newPin}
                  onChangeText={(txt) =>
                    setNewPin(txt.replace(/[^0-9]/g, "").slice(0, 4))
                  }
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  style={[
                    styles.input,
                    {
                      color: colors.primaryTextDark,
                      borderColor: colors.borderDivider,
                      letterSpacing: 8,
                      fontSize: 18,
                    },
                  ]}
                  placeholder="••••"
                  placeholderTextColor={colors.secondaryMutedText}
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setAppLockModalVisible(false)}
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
                  CLOSE
                </Text>
              </Pressable>

              {showPinInputForm && (
                <Pressable
                  onPress={() => void handleSavePin()}
                  style={[
                    styles.modalBtn,
                    { backgroundColor: colors.primaryBlue },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                    SAVE PIN
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* CP17: Local Backup & Restore Modal */}
      <Modal
        visible={backupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBackupModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[styles.modalCard, { backgroundColor: colors.cardSurface }]}
          >
            <Text
              style={[styles.modalTitle, { color: colors.primaryTextDark }]}
            >
              Local Backup & Restore
            </Text>

            <View
              style={[
                styles.statsBox,
                {
                  backgroundColor: colors.pageBackgroundGrey,
                  borderColor: colors.borderDivider,
                },
              ]}
            >
              <View style={styles.statCol}>
                <Text
                  style={[styles.statVal, { color: colors.primaryTextDark }]}
                >
                  {backupStats.totalCustomers}
                </Text>
                <Text
                  style={[styles.statLbl, { color: colors.secondaryMutedText }]}
                >
                  Customers
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text
                  style={[styles.statVal, { color: colors.primaryTextDark }]}
                >
                  {backupStats.totalCustomerEntries}
                </Text>
                <Text
                  style={[styles.statLbl, { color: colors.secondaryMutedText }]}
                >
                  Ledger Entries
                </Text>
              </View>
              <View style={styles.statCol}>
                <Text
                  style={[styles.statVal, { color: colors.primaryTextDark }]}
                >
                  {backupStats.totalCashbookEntries}
                </Text>
                <Text
                  style={[styles.statLbl, { color: colors.secondaryMutedText }]}
                >
                  Cashbook
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => void handleExportBackup()}
              disabled={isBackupBusy}
              style={[
                styles.backupActionBtn,
                { backgroundColor: colors.primaryGreen },
              ]}
            >
              {isBackupBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.backupActionText}>
                    EXPORT BACKUP FILE (.JSON)
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              onPress={() => void handleRestoreBackup()}
              disabled={isBackupBusy}
              style={[
                styles.backupOutlineBtn,
                { borderColor: colors.primaryBlue },
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={18}
                color={colors.primaryBlue}
              />
              <Text
                style={[
                  styles.backupOutlineText,
                  { color: colors.primaryBlue },
                ]}
              >
                RESTORE FROM BACKUP FILE
              </Text>
            </Pressable>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setBackupModalVisible(false)}
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
                  CLOSE
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  changePinBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    height: 42,
    gap: 8,
    marginBottom: 16,
  },
  changePinText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  statsBox: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  statCol: {
    flex: 1,
    alignItems: "center",
  },
  statVal: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginBottom: 2,
  },
  statLbl: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  backupActionBtn: {
    height: 46,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  backupActionText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  backupOutlineBtn: {
    height: 46,
    borderRadius: 8,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  backupOutlineText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
});
