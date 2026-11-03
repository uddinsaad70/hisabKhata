// apps/mobile/components/UserAccountModal.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { getStrings } from "../constants/translations";
import {
  getCurrentUserProfile,
  loginUserAccount,
  logoutUserAccount,
  registerUserAccount,
  updateActiveUserProfile,
  type UserProfile,
} from "../utils/userAuthService";
import { getDbAdapter } from "../db/client";
import { getBusinessBackupStats } from "../utils/backupService";
import { syncNowWithCloud } from "../db/syncService";
import {
  getAllBusinesses,
  clearLoggedInUserWorkspaceOnLogout,
} from "../db/businessQueries";

export interface UserAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileChanged: (user: UserProfile | null) => void;
}

interface SavedGoogleAccountOption {
  name: string;
  email: string;
}

const KNOWN_GOOGLE_ACCOUNTS_KEY = "hk_known_google_accounts_v1";

export function UserAccountModal({
  visible,
  onClose,
  onProfileChanged,
}: UserAccountModalProps) {
  const themeMode = useUiStore((state) => state.themeMode);
  const language = useUiStore((state) => state.language);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const setActiveBusiness = useUiStore((state) => state.setActiveBusiness);
  const colors = getThemeColors(themeMode);
  const t = getStrings(language);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authTab, setAuthTab] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [draftAvatarBase64, setDraftAvatarBase64] = useState<string | null>(
    null,
  );
  const [isBusy, setIsBusy] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Saved accounts on this device (no hardcoded dummy emails)
  const [googlePickerVisible, setGooglePickerVisible] = useState(false);
  const [knownGoogleAccounts, setKnownGoogleAccounts] = useState<
    SavedGoogleAccountOption[]
  >([]);
  const passwordInputRef = useRef<any>(null);

  const loadKnownGoogleAccounts = async () => {
    if (Platform.OS === "web") return;
    try {
      const raw = await SecureStore.getItemAsync(KNOWN_GOOGLE_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedGoogleAccountOption[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKnownGoogleAccounts(parsed);
        }
      }
    } catch {
      // Ignore
    }
  };

  const rememberGoogleAccount = async (acct: SavedGoogleAccountOption) => {
    if (Platform.OS === "web" || !acct.email.includes("@")) return;
    try {
      const filtered = knownGoogleAccounts.filter(
        (a) => a.email.toLowerCase() !== acct.email.toLowerCase(),
      );
      const next = [acct, ...filtered].slice(0, 5);
      setKnownGoogleAccounts(next);
      await SecureStore.setItemAsync(
        KNOWN_GOOGLE_ACCOUNTS_KEY,
        JSON.stringify(next),
      );
    } catch {
      // Ignore
    }
  };

  const refreshState = async () => {
    const profile = await getCurrentUserProfile();
    setUser(profile);
    if (activeBusinessId && Platform.OS !== "web") {
      try {
        const db = getDbAdapter();
        const stats = await getBusinessBackupStats(db, activeBusinessId);
        setUnsyncedCount(stats.unsyncedCount);
      } catch {
        // Ignore before DB ready
      }
    }
  };

  useEffect(() => {
    if (visible) {
      void refreshState();
      void loadKnownGoogleAccounts();
      setGooglePickerVisible(false);
    }
  }, [visible, activeBusinessId]);

  const handlePickPhoto = async (forLoggedInUser: boolean) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo library access to select a profile photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.35,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (forLoggedInUser) {
        try {
          setIsBusy(true);
          const updated = await updateActiveUserProfile({
            avatarBase64: dataUri,
          });
          setUser(updated);
          onProfileChanged(updated);
        } catch (err: any) {
          Alert.alert("Error", err.message || "Could not update photo.");
        } finally {
          setIsBusy(false);
        }
      } else {
        setDraftAvatarBase64(dataUri);
      }
    }
  };

  const handleAuthSubmit = async () => {
    if (isBusy) return;
    if (!identifier.trim() || !password.trim()) {
      Alert.alert(
        "Required Fields",
        language === "bn"
          ? "অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন।"
          : "Please enter both email and password.",
      );
      return;
    }

    setIsBusy(true);
    try {
      let profile: UserProfile;
      if (authTab === "REGISTER") {
        profile = await registerUserAccount({
          name: name.trim() || identifier.split("@")[0],
          identifier,
          password,
          avatarBase64: draftAvatarBase64,
        });
      } else {
        profile = await loginUserAccount({
          identifier,
          password,
        });
      }

      await rememberGoogleAccount({
        name: profile.name,
        email: profile.email,
      });

      setUser(profile);
      setName("");
      setIdentifier("");
      setPassword("");
      setDraftAvatarBase64(null);

      // Run cloud sync (Push local data + Pull cloud data) upon login/register
      await syncNowWithCloud();

      if (Platform.OS !== "web") {
        const db = getDbAdapter();
        const businesses = await getAllBusinesses(db);
        if (businesses.length > 0) {
          setActiveBusiness(
            businesses[0].id,
            businesses[0].name,
            businesses[0].currency,
          );
        }
      }

      DeviceEventEmitter.emit("WORKSPACE_RESET");
      onProfileChanged(profile);
      await refreshState();
    } catch (err: any) {
      Alert.alert("Authentication Error", err.message || "Please try again.");
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * When user clicks a Google account from the picker, auto-fill Name & Email
   * into the form and focus the Password input so user sets their own password!
   */
  const handleSelectGoogleAccountToFill = (acct: SavedGoogleAccountOption) => {
    setName(acct.name);
    setIdentifier(acct.email);
    setGooglePickerVisible(false);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 150);
  };

  const handleSyncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await syncNowWithCloud();
      const updated = await getCurrentUserProfile();
      setUser(updated);
      await refreshState();
      onProfileChanged(updated);
    } catch (err: any) {
      Alert.alert("Sync Error", err.message || "Could not sync records.");
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Instant Logout (0ms lag):
   * Immediately clears session tokens and wipes the logged-in user's cached records
   * from local SQLite so the previous user's data never stays behind.
   */
  const handleLogout = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      // 1. Immediately clear tokens from SecureStore
      await logoutUserAccount();

      // 2. Immediately clear logged-in user's businesses/customers/entries from local SQLite
      if (Platform.OS !== "web") {
        const db = getDbAdapter();
        const freshGuestBiz = await clearLoggedInUserWorkspaceOnLogout(
          db,
          language === "bn" ? "আমার ব্যবসা" : "My Business",
        );
        setActiveBusiness(
          freshGuestBiz.id,
          freshGuestBiz.name,
          freshGuestBiz.currency,
        );
      }

      setUser(null);
      setUnsyncedCount(0);
      DeviceEventEmitter.emit("WORKSPACE_RESET");
      onProfileChanged(null);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.headerRow,
              { borderBottomColor: colors.borderDivider },
            ]}
          >
            <Text
              style={[styles.headerTitle, { color: colors.primaryTextDark }]}
            >
              {t.accountAndSyncTitle}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons
                name="close"
                size={22}
                color={colors.secondaryMutedText}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: 16 }}
          >
            {user ? (
              /* LOGGED-IN PROFILE & SYNC DASHBOARD */
              <View style={styles.profileContainer}>
                <Pressable
                  onPress={() => void handlePickPhoto(true)}
                  style={styles.avatarWrapper}
                >
                  {user.avatarBase64 ? (
                    <Image
                      source={{ uri: user.avatarBase64 }}
                      style={styles.avatarLarge}
                    />
                  ) : (
                    <View
                      style={[
                        styles.avatarPlaceholder,
                        { backgroundColor: colors.primaryBlue },
                      ]}
                    >
                      <Text style={styles.avatarInitialText}>
                        {user.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.cameraBadge,
                      { backgroundColor: colors.primaryGreen },
                    ]}
                  >
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                </Pressable>
                <Text
                  style={[
                    styles.changePhotoHint,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.changePhotoText}
                </Text>

                <Text
                  style={[styles.userName, { color: colors.primaryTextDark }]}
                >
                  {user.name}
                </Text>
                <Text
                  style={[
                    styles.userIdentifier,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {user.email}
                </Text>

                {/* Cloud Sync Status Box */}
                <View
                  style={[
                    styles.syncBox,
                    {
                      backgroundColor: colors.pageBackgroundGrey,
                      borderColor: colors.borderDivider,
                    },
                  ]}
                >
                  <View style={styles.syncStatusRow}>
                    <Ionicons
                      name={
                        unsyncedCount === 0
                          ? "cloud-done"
                          : "cloud-upload-outline"
                      }
                      size={24}
                      color={
                        unsyncedCount === 0 ? colors.primaryGreen : "#F59E0B"
                      }
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={[
                          styles.syncBoxTitle,
                          { color: colors.primaryTextDark },
                        ]}
                      >
                        {t.cloudSyncStatusTitle}
                      </Text>
                      <Text
                        style={[
                          styles.syncBoxSub,
                          {
                            color:
                              unsyncedCount === 0
                                ? colors.primaryGreen
                                : "#F59E0B",
                          },
                        ]}
                      >
                        {unsyncedCount === 0
                          ? t.allSyncedCloud
                          : `${unsyncedCount} ${t.pendingSyncChanges}`}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => void handleSyncNow()}
                    disabled={isSyncing}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: colors.primaryBlue,
                        marginTop: 14,
                      },
                    ]}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="sync-outline"
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.primaryBtnText}>
                          {t.syncNowBtn}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => void handleLogout()}
                  disabled={isBusy}
                  style={[styles.logoutBtn, { borderColor: colors.primaryRed }]}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color={colors.primaryRed} />
                  ) : (
                    <>
                      <Ionicons
                        name="log-out-outline"
                        size={18}
                        color={colors.primaryRed}
                      />
                      <Text
                        style={[
                          styles.logoutBtnText,
                          { color: colors.primaryRed },
                        ]}
                      >
                        {t.logoutBtn}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : (
              /* LOGIN / REGISTER FORM */
              <View>
                {/* Segmented Tabs */}
                <View
                  style={[
                    styles.tabSwitchRow,
                    { backgroundColor: colors.pageBackgroundGrey },
                  ]}
                >
                  {(["LOGIN", "REGISTER"] as const).map((tab) => {
                    const active = authTab === tab;
                    return (
                      <Pressable
                        key={tab}
                        onPress={() => setAuthTab(tab)}
                        style={[
                          styles.tabOption,
                          active && { backgroundColor: colors.primaryBlue },
                        ]}
                      >
                        <Text
                          style={[
                            styles.tabOptionText,
                            {
                              color: active
                                ? "#FFFFFF"
                                : colors.secondaryMutedText,
                            },
                          ]}
                        >
                          {tab === "LOGIN" ? t.loginTab : t.registerTab}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Google Account Quick-Fill Button & Expandable Account List */}
                <Pressable
                  onPress={() => setGooglePickerVisible((prev) => !prev)}
                  style={[
                    styles.logoutBtn,
                    {
                      borderColor: colors.borderDivider,
                      marginBottom: 14,
                      backgroundColor: colors.pageBackgroundGrey,
                    },
                  ]}
                >
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
                  <Text
                    style={[
                      styles.logoutBtnText,
                      { color: colors.primaryTextDark },
                    ]}
                  >
                    {t.continueWithGoogleBtn}
                  </Text>
                  <Ionicons
                    name={googlePickerVisible ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={colors.secondaryMutedText}
                  />
                </Pressable>

                {googlePickerVisible && (
                  <View
                    style={[
                      styles.googleAccountListBox,
                      {
                        backgroundColor: colors.pageBackgroundGrey,
                        borderColor: colors.borderDivider,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.googlePickerTitle,
                        { color: colors.secondaryMutedText },
                      ]}
                    >
                      {language === "bn"
                        ? "অ্যাকাউন্ট সিলেক্ট করুন (নাম ও ইমেইল অটো বসবে):"
                        : "Select an account to auto-fill Name & Email:"}
                    </Text>
                    {knownGoogleAccounts.map((acct) => (
                      <Pressable
                        key={acct.email}
                        onPress={() => handleSelectGoogleAccountToFill(acct)}
                        style={[
                          styles.googleAccountItem,
                          { borderBottomColor: colors.borderDivider },
                        ]}
                      >
                        <View
                          style={[
                            styles.googleMiniAvatar,
                            { backgroundColor: colors.primaryBlue },
                          ]}
                        >
                          <Text style={styles.googleMiniAvatarText}>
                            {acct.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.googleAcctName,
                              { color: colors.primaryTextDark },
                            ]}
                          >
                            {acct.name}
                          </Text>
                          <Text
                            style={[
                              styles.googleAcctEmail,
                              { color: colors.secondaryMutedText },
                            ]}
                          >
                            {acct.email}
                          </Text>
                        </View>
                        <Ionicons
                          name="checkmark-circle-outline"
                          size={18}
                          color={colors.primaryBlue}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}

                {authTab === "REGISTER" && (
                  <>
                    <Pressable
                      onPress={() => void handlePickPhoto(false)}
                      style={[styles.avatarWrapper, { alignSelf: "center" }]}
                    >
                      {draftAvatarBase64 ? (
                        <Image
                          source={{ uri: draftAvatarBase64 }}
                          style={styles.avatarLarge}
                        />
                      ) : (
                        <View
                          style={[
                            styles.avatarPlaceholder,
                            { backgroundColor: colors.primaryBlue },
                          ]}
                        >
                          <Ionicons
                            name="camera-outline"
                            size={28}
                            color="#FFFFFF"
                          />
                        </View>
                      )}
                    </Pressable>
                    <Text
                      style={[
                        styles.changePhotoHint,
                        {
                          color: colors.secondaryMutedText,
                          textAlign: "center",
                        },
                      ]}
                    >
                      {t.changePhotoText}
                    </Text>

                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: colors.secondaryMutedText },
                      ]}
                    >
                      {t.fullNameLabel}
                    </Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={t.fullNamePlaceholder}
                      placeholderTextColor={colors.secondaryMutedText}
                      style={[
                        styles.input,
                        {
                          color: colors.primaryTextDark,
                          borderColor: colors.borderDivider,
                        },
                      ]}
                    />
                  </>
                )}

                <Text
                  style={[
                    styles.fieldLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.phoneOrEmailLabel}
                </Text>
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={t.phoneOrEmailPlaceholder}
                  placeholderTextColor={colors.secondaryMutedText}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[
                    styles.input,
                    {
                      color: colors.primaryTextDark,
                      borderColor: colors.borderDivider,
                    },
                  ]}
                />

                <Text
                  style={[
                    styles.fieldLabel,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.passwordLabel}
                </Text>
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.passwordPlaceholder}
                  placeholderTextColor={colors.secondaryMutedText}
                  secureTextEntry
                  style={[
                    styles.input,
                    {
                      color: colors.primaryTextDark,
                      borderColor: colors.borderDivider,
                    },
                  ]}
                />

                <Pressable
                  onPress={() => void handleAuthSubmit()}
                  disabled={isBusy}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: colors.primaryBlue, marginTop: 8 },
                  ]}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {authTab === "LOGIN" ? t.loginBtn : t.createAccountBtn}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  sheetCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
    maxHeight: "90%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  profileContainer: {
    alignItems: "center",
  },
  avatarWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginBottom: 6,
    position: "relative",
  },
  avatarLarge: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 24,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  changePhotoHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginBottom: 10,
  },
  userName: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  userIdentifier: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
    marginBottom: 16,
  },
  syncBox: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  syncStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncBoxTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  syncBoxSub: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginTop: 2,
  },
  tabSwitchRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  tabOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  tabOptionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  googleAccountListBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  googlePickerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    marginBottom: 8,
  },
  googleAccountItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  googleMiniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  googleMiniAvatarText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  googleAcctName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  googleAcctEmail: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  fieldLabel: {
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
    marginBottom: 14,
  },
  primaryBtn: {
    height: 46,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  logoutBtn: {
    width: "100%",
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
});
