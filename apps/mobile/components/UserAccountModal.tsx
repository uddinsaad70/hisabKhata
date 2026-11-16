// apps/mobile/components/UserAccountModal.tsx
import React, { useState, useEffect } from "react";
import {
  BackHandler,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  DeviceEventEmitter,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { getStrings } from "../constants/translations";
import {
  deleteCurrentUserAccount,
  getApiBaseUrl,
  getCurrentUserProfile,
  getGoogleOAuthBridgeUrl,
  isPostLogoutGuestSession,
  loginUserAccount,
  loginWithGoogleToken,
  logoutUserAccount,
  registerUserAccount,
  savePendingLogoutSyncSession,
  setPostLogoutGuestSession,
  updateActiveUserProfile,
  wakeUpCloudServer,
  type UserProfile,
} from "../utils/userAuthService";
import { getDbAdapter } from "../db/client";
import { getBusinessBackupStats } from "../utils/backupService";
import {
  flushPendingLogoutSyncIfNeeded,
  syncNowWithCloud,
} from "../db/syncService";
import {
  getAllBusinesses,
  clearLoggedInUserWorkspaceOnLogout,
} from "../db/businessQueries";
import { useThemedAlert } from "./ThemedAlertModal";

WebBrowser.maybeCompleteAuthSession();

export interface UserAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onProfileChanged: (user: UserProfile | null) => void;
}

export function UserAccountModal({
  visible,
  onClose,
  onProfileChanged,
}: UserAccountModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeMode = useUiStore((state) => state.themeMode);
  const language = useUiStore((state) => state.language);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const setActiveBusiness = useUiStore((state) => state.setActiveBusiness);
  const colors = getThemeColors(themeMode);
  const t = getStrings(language);
  const { showAlert, alertElement } = useThemedAlert();

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
  const [photoPickerTarget, setPhotoPickerTarget] = useState<
    "LOGGED_IN" | "REGISTER_DRAFT" | null
  >(null);

  const googleClientId = (
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || ""
  ).trim();

  const refreshState = async () => {
    if (Platform.OS !== "web") {
      await SecureStore.deleteItemAsync("hk_known_google_accounts_v1").catch(
        () => {},
      );
    }

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
    if (!visible) {
      return;
    }

    void refreshState();
    void wakeUpCloudServer(30000);

    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      Keyboard.dismiss();
      onClose();
      return true;
    });

    return () => backSub.remove();
  }, [visible, activeBusinessId]);

  const resolveGuestBusinessesBeforeLogin = async (): Promise<void> => {
    if (Platform.OS === "web") return;
    const isPostLogout = await isPostLogoutGuestSession();
    if (!isPostLogout) return;

    const db = getDbAdapter();
    const guestRow = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM businesses WHERE owner_user_id IS NULL AND is_deleted = 0;`,
    );
    const guestCount = guestRow?.cnt ?? 0;
    if (guestCount === 0) return;

    const shouldMerge = await new Promise<boolean>((resolve) => {
      showAlert(t.mergeGuestDataTitle, t.mergeGuestDataMsg, [
        {
          text: t.noDiscardBtn,
          style: "destructive",
          onPress: () => resolve(false),
        },
        {
          text: t.yesAddBtn,
          onPress: () => resolve(true),
        },
      ]);
    });

    if (!shouldMerge) {
      await db.runAsync(`DELETE FROM businesses WHERE owner_user_id IS NULL;`);
      setActiveBusiness(null as any, "", "BDT");
    }
  };

  const finalizeLoginAndRoute = async (profile: UserProfile) => {
    await setPostLogoutGuestSession(false);
    setUser(profile);
    await syncNowWithCloud();

    let hasExistingBusinesses = false;

    if (Platform.OS !== "web") {
      const db = getDbAdapter();
      const businesses = await getAllBusinesses(db, profile.id);
      if (businesses.length > 0) {
        hasExistingBusinesses = true;
        setActiveBusiness(
          businesses[0].id,
          businesses[0].name,
          businesses[0].currency,
        );
      } else {
        setActiveBusiness(null as any, "", "BDT");
      }
    }

    onProfileChanged(profile);
    await refreshState();
    Keyboard.dismiss();
    onClose();

    if (hasExistingBusinesses) {
      router.replace("/(tabs)");
    }

    setTimeout(() => {
      DeviceEventEmitter.emit("WORKSPACE_RESET");
      DeviceEventEmitter.emit("SYNC_COMPLETED");
    }, 80);
  };

  const handleGooglePopupPress = async () => {
    if (isBusy) return;

    if (!googleClientId) {
      showAlert(
        language === "bn"
          ? "Google Client ID প্রয়োজন"
          : "Google Client ID Required",
        language === "bn"
          ? "আসল Google OAuth পপআপ চালু করতে apps/mobile/.env ফাইলে আপনার EXPO_PUBLIC_GOOGLE_CLIENT_ID দিন।"
          : "Please set EXPO_PUBLIC_GOOGLE_CLIENT_ID in apps/mobile/.env to launch the official Google OAuth popup.",
      );
      return;
    }

    setIsBusy(true);
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let resolvedToken: string | null = null;

    try {
      await wakeUpCloudServer(45000);
      await flushPendingLogoutSyncIfNeeded();

      const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const appReturnUrl = Linking.createURL("google-auth");
      const webRedirectUri = getGoogleOAuthBridgeUrl();
      const baseUrl = getApiBaseUrl();

      const authParams = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: webRedirectUri,
        response_type: "token",
        scope: "openid email profile",
        prompt: "select_account",
        state: `${sessionId}|${appReturnUrl}`,
      });

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

      pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(
            `${baseUrl}/auth/google/bridge-poll?sessionId=${encodeURIComponent(sessionId)}`,
          );
          if (pollRes.ok) {
            const data = await pollRes.json();
            if (data.ready && data.token) {
              resolvedToken = data.token;
              if (pollInterval) clearInterval(pollInterval);
              WebBrowser.dismissBrowser();
            }
          }
        } catch {
          // Ignore transient poll errors while user is in browser
        }
      }, 1000);

      const result = await WebBrowser.openAuthSessionAsync(
        googleAuthUrl,
        appReturnUrl,
      );

      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }

      if (!resolvedToken && result.type === "success" && result.url) {
        const parsed = new URL(result.url);
        const hashParams = new URLSearchParams(
          parsed.hash ? parsed.hash.slice(1) : "",
        );
        resolvedToken =
          parsed.searchParams.get("google_token") ||
          parsed.searchParams.get("access_token") ||
          hashParams.get("access_token") ||
          hashParams.get("id_token");
      }

      if (!resolvedToken) {
        try {
          const finalPoll = await fetch(
            `${baseUrl}/auth/google/bridge-poll?sessionId=${encodeURIComponent(sessionId)}`,
          );
          if (finalPoll.ok) {
            const data = await finalPoll.json();
            if (data.ready && data.token) {
              resolvedToken = data.token;
            }
          }
        } catch {
          // Ignore
        }
      }

      if (resolvedToken) {
        await resolveGuestBusinessesBeforeLogin();
        const profile = await loginWithGoogleToken(resolvedToken);
        await finalizeLoginAndRoute(profile);
      }
    } catch (err: any) {
      showAlert(
        "Google Sign-In Error",
        err.message || "Could not complete Google sign-in.",
      );
    } finally {
      if (pollInterval) clearInterval(pollInterval);
      setIsBusy(false);
    }
  };

  const applyPickedAvatar = async (
    base64Data: string,
    forLoggedInUser: boolean,
  ) => {
    const dataUri = `data:image/jpeg;base64,${base64Data}`;
    if (forLoggedInUser) {
      try {
        setIsBusy(true);
        const updated = await updateActiveUserProfile({
          avatarBase64: dataUri,
        });
        setUser(updated);
        onProfileChanged(updated);
      } catch (err: any) {
        showAlert("Error", err.message || "Could not update photo.");
      } finally {
        setIsBusy(false);
      }
    } else {
      setDraftAvatarBase64(dataUri);
    }
  };

  const launchPhotoSource = async (
    source: "CAMERA" | "GALLERY",
    forLoggedInUser: boolean,
  ) => {
    try {
      if (source === "CAMERA") {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          showAlert(t.cameraPermTitle, t.cameraPermMsg);
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.35,
          base64: true,
        });

        if (!result.canceled && result.assets[0]?.base64) {
          await applyPickedAvatar(result.assets[0].base64, forLoggedInUser);
        }
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          showAlert(t.galleryPermTitle, t.galleryPermMsg);
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
          await applyPickedAvatar(result.assets[0].base64, forLoggedInUser);
        }
      }
    } catch (err: any) {
      showAlert("Error", err.message || "Could not open image picker.");
    }
  };

  const handlePickPhoto = (forLoggedInUser: boolean) => {
    setPhotoPickerTarget(forLoggedInUser ? "LOGGED_IN" : "REGISTER_DRAFT");
  };

  const handleAuthSubmit = async () => {
    if (isBusy) return;
    if (!identifier.trim() || !password.trim()) {
      showAlert(
        "Required Fields",
        language === "bn"
          ? "অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন।"
          : "Please enter both email and password.",
      );
      return;
    }

    setIsBusy(true);
    try {
      await wakeUpCloudServer(45000);
      await flushPendingLogoutSyncIfNeeded();
      await resolveGuestBusinessesBeforeLogin();

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

      setName("");
      setIdentifier("");
      setPassword("");
      setDraftAvatarBase64(null);

      await finalizeLoginAndRoute(profile);
    } catch (err: any) {
      showAlert("Authentication Error", err.message || "Please try again.");
    } finally {
      setIsBusy(false);
    }
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
      showAlert("Sync Error", err.message || "Could not sync records.");
    } finally {
      setIsSyncing(false);
    }
  };

  const resetWorkspaceToOnboarding = async (
    preserveUnsyncedForUserId?: string,
  ) => {
    if (Platform.OS !== "web") {
      const db = getDbAdapter();
      await db.withTransactionAsync(async () => {
        if (preserveUnsyncedForUserId) {
          await db.runAsync(
            `DELETE FROM businesses
             WHERE is_synced = 1
               AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.business_id = businesses.id AND c.is_synced = 0)
               AND NOT EXISTS (SELECT 1 FROM customer_entries ce WHERE ce.business_id = businesses.id AND ce.is_synced = 0)
               AND NOT EXISTS (SELECT 1 FROM cashbook_entries cb WHERE cb.business_id = businesses.id AND cb.is_synced = 0);`,
          );
        } else {
          await db.runAsync(`DELETE FROM businesses;`);
        }
        await db.runAsync(
          `UPDATE sync_state SET last_pulled_cursor = NULL, last_pushed_at = 0 WHERE business_id = 'GLOBAL';`,
        );
      });
    }
    setUser(null);
    setUnsyncedCount(0);
    onProfileChanged(null);
    Keyboard.dismiss();
    onClose();
    setTimeout(() => {
      setActiveBusiness(null as any, "", "BDT");
      DeviceEventEmitter.emit("WORKSPACE_RESET");
    }, 60);
  };

  const handleLogout = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const currentUserId = user?.id;
      await syncNowWithCloud().catch(() => {});

      if (Platform.OS !== "web" && currentUserId) {
        const db = getDbAdapter();
        const row = await db.getFirstAsync<{ total: number }>(
          `SELECT (
            (SELECT COUNT(*) FROM businesses WHERE is_synced = 0 AND owner_user_id = ?) +
            (SELECT COUNT(*) FROM customers WHERE is_synced = 0 AND business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?)) +
            (SELECT COUNT(*) FROM customer_entries WHERE is_synced = 0 AND business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?)) +
            (SELECT COUNT(*) FROM cashbook_entries WHERE is_synced = 0 AND business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?))
          ) as total;`,
          [currentUserId, currentUserId, currentUserId, currentUserId],
        );
        if ((row?.total ?? 0) > 0) {
          await savePendingLogoutSyncSession();
        }
      }

      await logoutUserAccount();
      await resetWorkspaceToOnboarding(currentUserId);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteAccount = () => {
    if (isBusy) return;
    showAlert(t.deleteAccountConfirmTitle, t.deleteAccountConfirmMsg, [
      {
        text: t.cancelBtn,
        style: "cancel",
      },
      {
        text: t.deleteForeverBtn,
        style: "destructive",
        onPress: async () => {
          setIsBusy(true);
          try {
            await deleteCurrentUserAccount();
            await resetWorkspaceToOnboarding();
            showAlert("Deleted", t.accountDeletedMsg);
          } catch (err: any) {
            showAlert("Error", err.message || "Could not delete account.");
          } finally {
            setIsBusy(false);
          }
        },
      },
    ]);
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.overlayRoot}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={styles.dismissArea}
          onPress={() => {
            Keyboard.dismiss();
            onClose();
          }}
        />

        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
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
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                onClose();
              }}
              hitSlop={10}
            >
              <Ionicons
                name="close"
                size={22}
                color={colors.secondaryMutedText}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingVertical: 14,
              paddingBottom: 20,
            }}
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
                <Pressable
                  onPress={handleDeleteAccount}
                  disabled={isBusy}
                  style={{
                    marginTop: 14,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={15}
                    color={colors.secondaryMutedText}
                  />
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 12,
                      color: colors.secondaryMutedText,
                      textDecorationLine: "underline",
                    }}
                  >
                    {t.deleteAccountBtn}
                  </Text>
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
                      autoComplete="name"
                      textContentType="name"
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
                  autoComplete="email"
                  textContentType="emailAddress"
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
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.passwordPlaceholder}
                  placeholderTextColor={colors.secondaryMutedText}
                  secureTextEntry
                  autoComplete={
                    authTab === "REGISTER" ? "new-password" : "current-password"
                  }
                  textContentType={
                    authTab === "REGISTER" ? "newPassword" : "password"
                  }
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

                {/* Official Google OAuth Popup Button */}
                <Pressable
                  onPress={() => void handleGooglePopupPress()}
                  disabled={isBusy}
                  style={[
                    styles.logoutBtn,
                    {
                      borderColor: colors.borderDivider,
                      marginTop: 12,
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
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Custom Styled Photo Source Picker Overlay */}
          {photoPickerTarget !== null && (
            <View style={styles.photoPickerOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setPhotoPickerTarget(null)}
              />
              <View
                style={[
                  styles.photoPickerCard,
                  {
                    backgroundColor: colors.cardSurface,
                    borderColor: colors.borderDivider,
                  },
                ]}
              >
                <View style={styles.photoPickerHandle} />
                <Text
                  style={[
                    styles.photoPickerTitle,
                    { color: colors.primaryTextDark },
                  ]}
                >
                  {t.updateProfilePhotoTitle}
                </Text>
                <Text
                  style={[
                    styles.photoPickerSub,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.updateProfilePhotoPrompt}
                </Text>

                <View style={styles.photoOptionsGrid}>
                  <Pressable
                    onPress={() => {
                      const isLogged = photoPickerTarget === "LOGGED_IN";
                      setPhotoPickerTarget(null);
                      setTimeout(() => {
                        void launchPhotoSource("CAMERA", isLogged);
                      }, 150);
                    }}
                    style={({ pressed }) => [
                      styles.photoOptionBox,
                      {
                        backgroundColor: colors.pageBackgroundGrey,
                        borderColor: colors.borderDivider,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.photoOptionIconCircle,
                        { backgroundColor: "#DBEAFE" },
                      ]}
                    >
                      <Ionicons
                        name="camera"
                        size={26}
                        color={colors.primaryBlue}
                      />
                    </View>
                    <Text
                      style={[
                        styles.photoOptionLabel,
                        { color: colors.primaryTextDark },
                      ]}
                    >
                      {t.takePhotoOption.replace("📷 ", "")}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      const isLogged = photoPickerTarget === "LOGGED_IN";
                      setPhotoPickerTarget(null);
                      setTimeout(() => {
                        void launchPhotoSource("GALLERY", isLogged);
                      }, 150);
                    }}
                    style={({ pressed }) => [
                      styles.photoOptionBox,
                      {
                        backgroundColor: colors.pageBackgroundGrey,
                        borderColor: colors.borderDivider,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.photoOptionIconCircle,
                        { backgroundColor: "#DCFCE7" },
                      ]}
                    >
                      <Ionicons
                        name="images"
                        size={26}
                        color={colors.primaryGreen}
                      />
                    </View>
                    <Text
                      style={[
                        styles.photoOptionLabel,
                        { color: colors.primaryTextDark },
                      ]}
                    >
                      {t.chooseFromGalleryOption.replace("🖼️ ", "")}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setPhotoPickerTarget(null)}
                  style={({ pressed }) => [
                    styles.photoCancelBtn,
                    {
                      borderColor: colors.borderDivider,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.photoCancelText,
                      { color: colors.secondaryMutedText },
                    ]}
                  >
                    {t.cancelBtn}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
        {alertElement}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
  },
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
  photoPickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    zIndex: 50,
  },
  photoPickerCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: "center",
  },
  photoPickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(150,150,150,0.35)",
    marginBottom: 14,
  },
  photoPickerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    marginBottom: 4,
  },
  photoPickerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
  },
  photoOptionsGrid: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginBottom: 16,
  },
  photoOptionBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  photoOptionIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  photoOptionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    textAlign: "center",
  },
  photoCancelBtn: {
    width: "100%",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCancelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
});