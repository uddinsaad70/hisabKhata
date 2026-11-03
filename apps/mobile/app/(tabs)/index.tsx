// apps/mobile/app/(tabs)/index.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  DeviceEventEmitter,
  Image,
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { formatCurrency } from "../../utils/formatCurrency";
import { getDbAdapter, initializeAppDatabase } from "../../db/client";
import { type DatabaseHealthSummary } from "../../db/migrations";
import { BusinessSwitcherModal } from "../../components/BusinessSwitcherModal";
import { getAllBusinesses } from "../../db/businessQueries";
import { CustomersTabView } from "../../components/CustomersTabView";
import { CashbookTabView } from "../../components/CashbookTabView";
import { getStrings } from "../../constants/translations";
import { UserAccountModal } from "../../components/UserAccountModal";
import { syncNowWithCloud } from "../../db/syncService";
import {
  getCurrentUserProfile,
  type UserProfile,
} from "../../utils/userAuthService";
import { getBusinessBackupStats } from "../../utils/backupService";

export default function HomeScreen() {
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const setActiveBusiness = useUiStore((state) => state.setActiveBusiness);
  const activeBusinessName = useUiStore((state) => state.activeBusinessName);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const activeHomeTab = useUiStore((state) => state.activeHomeTab);
  const setActiveHomeTab = useUiStore((state) => state.setActiveHomeTab);
  const themeMode = useUiStore((state) => state.themeMode);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);

  const colors = getThemeColors(themeMode);

  const [dbHealth, setDbHealth] = useState<DatabaseHealthSummary | null>(null);
  const [switcherVisible, setSwitcherVisible] = useState<boolean>(false);
  const [accountModalVisible, setAccountModalVisible] =
    useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

  const refreshHeaderSyncStatus = useCallback(async () => {
    try {
      const profile = await getCurrentUserProfile();
      setUserProfile(profile);
      if (activeBusinessId && Platform.OS !== "web") {
        const db = getDbAdapter();
        const stats = await getBusinessBackupStats(db, activeBusinessId);
        setUnsyncedCount(stats.unsyncedCount);
      }
    } catch {
      // Ignore before DB ready
    }
  }, [activeBusinessId]);

  useEffect(() => {
    initializeAppDatabase()
      .then(async (summary) => {
        setDbHealth(summary);

        if (!useUiStore.getState().activeBusinessId) {
          const db = getDbAdapter();
          const businesses = await getAllBusinesses(db);
          if (businesses.length > 0) {
            useUiStore
              .getState()
              .setActiveBusiness(
                businesses[0].id,
                businesses[0].name,
                businesses[0].currency,
              );
          }
        }
        await refreshHeaderSyncStatus();
      })
      .catch(() => setDbHealth(null));
  }, [refreshHeaderSyncStatus]);

  useFocusEffect(
    useCallback(() => {
      void refreshHeaderSyncStatus();
    }, [refreshHeaderSyncStatus]),
  );

  // Automatic debounced cloud sync (2 seconds after any customer or cashbook change!)
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerAutoSync = () => {
      void refreshHeaderSyncStatus();
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        void syncNowWithCloud().then(() => refreshHeaderSyncStatus());
      }, 2000);
    };

    const sub1 = DeviceEventEmitter.addListener(
      "REFRESH_LEDGER",
      triggerAutoSync,
    );
    const sub2 = DeviceEventEmitter.addListener(
      "REFRESH_CASHBOOK",
      triggerAutoSync,
    );
    const sub3 = DeviceEventEmitter.addListener("SYNC_COMPLETED", () => {
      void refreshHeaderSyncStatus();
    });

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      sub1.remove();
      sub2.remove();
      sub3.remove();
    };
  }, [refreshHeaderSyncStatus]);

  // Silent automatic debounced cloud sync (2 seconds after ANY local SQLite insert/update/delete)
  useEffect(() => {
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerAutoSync = () => {
      void refreshHeaderSyncStatus();
      if (syncTimer) clearTimeout(syncTimer);

      syncTimer = setTimeout(async () => {
        const profile = await getCurrentUserProfile();
        if (!profile) {
          return;
        }
        await syncNowWithCloud();
        await refreshHeaderSyncStatus();
      }, 2000);
    };

    const subMutated = DeviceEventEmitter.addListener(
      "LOCAL_DATA_MUTATED",
      triggerAutoSync,
    );
    const subSyncDone = DeviceEventEmitter.addListener("SYNC_COMPLETED", () => {
      void refreshHeaderSyncStatus();
    });
    const subReset = DeviceEventEmitter.addListener("WORKSPACE_RESET", () => {
      void refreshHeaderSyncStatus();
    });

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      subMutated.remove();
      subSyncDone.remove();
      subReset.remove();
    };
  }, [refreshHeaderSyncStatus]);

  // Initial background cloud sync on app launch
  useEffect(() => {
    void syncNowWithCloud().then(() => refreshHeaderSyncStatus());
  }, [refreshHeaderSyncStatus]);

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      {/* Top Royal Blue Header Container */}
      <SafeAreaView
        style={[styles.headerSafeArea, { backgroundColor: colors.primaryBlue }]}
      >
        <View style={[styles.topBar, { backgroundColor: colors.primaryBlue }]}>
          {/* Left: Business Switcher Pill Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch business"
            onPress={() => setSwitcherVisible(true)}
            style={[
              styles.businessSelector,
              { backgroundColor: colors.darkHeaderAccent },
            ]}
          >
            <View style={styles.businessIconBadge}>
              <Ionicons
                name="storefront-outline"
                size={16}
                color={colors.activeTabIndicator}
              />
            </View>
            <Text style={styles.businessNameText} numberOfLines={1}>
              {activeBusinessName}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color="#FFFFFF"
              style={styles.dropdownChevron}
            />
          </Pressable>

          {/* Right: User Profile Avatar & Cloud Sync Status Dot */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open account and cloud sync"
            onPress={() => setAccountModalVisible(true)}
            style={[
              styles.profileAvatarButton,
              { backgroundColor: colors.darkHeaderAccent },
            ]}
          >
            {userProfile?.avatarBase64 ? (
              <Image
                source={{ uri: userProfile.avatarBase64 }}
                style={styles.headerAvatarImg}
              />
            ) : userProfile ? (
              <Text style={styles.headerAvatarInitials}>
                {userProfile.name.slice(0, 2).toUpperCase()}
              </Text>
            ) : (
              <Ionicons name="person-outline" size={18} color="#FFFFFF" />
            )}

            <View
              style={[
                styles.syncStatusDot,
                {
                  backgroundColor: !userProfile
                    ? "#9CA3AF"
                    : unsyncedCount === 0
                      ? "#22C55E"
                      : "#F59E0B",
                },
              ]}
            />
          </Pressable>
        </View>

        {/* Header Tabs: CUSTOMERS | CASHBOOK */}
        <View
          style={[
            styles.headerTabsRow,
            { backgroundColor: colors.primaryBlue },
          ]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeHomeTab === "customers" }}
            onPress={() => setActiveHomeTab("customers")}
            style={[
              styles.headerTabButton,
              activeHomeTab === "customers" && {
                borderBottomColor: colors.activeTabIndicator,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.headerTabText,
                activeHomeTab === "customers" && styles.headerTabTextActive,
              ]}
            >
              {t.customersHeaderTab}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeHomeTab === "cashbook" }}
            onPress={() => setActiveHomeTab("cashbook")}
            style={[
              styles.headerTabButton,
              activeHomeTab === "cashbook" && {
                borderBottomColor: colors.activeTabIndicator,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.headerTabText,
                activeHomeTab === "cashbook" && styles.headerTabTextActive,
              ]}
            >
              {t.cashbookHeaderTab}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {activeHomeTab === "customers" ? (
          <CustomersTabView />
        ) : (
          <CashbookTabView />
        )}
      </View>
      <BusinessSwitcherModal
        visible={switcherVisible}
        onClose={() => setSwitcherVisible(false)}
      />
      <UserAccountModal
        visible={accountModalVisible}
        onClose={() => setAccountModalVisible(false)}
        onProfileChanged={(updatedProfile) => {
          setUserProfile(updatedProfile);
          void refreshHeaderSyncStatus();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafeArea: {},
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  businessSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: "78%",
  },
  businessIconBadge: {
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  businessNameText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    paddingRight: 2,
  },
  dropdownChevron: {
    marginLeft: 4,
  },
  syncStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  headerAvatarImg: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
  },
  headerAvatarInitials: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  syncStatusDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 1.5,
    borderColor: "#1355A3",
  },
  headerTabsRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  headerTabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  headerTabText: {
    width: "100%",
    textAlign: "center",
    color: "rgba(255, 255, 255, 0.72)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  headerTabTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  dbStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    gap: 8,
  },
  dbStatusText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  summaryCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    flexShrink: 1,
  },
  sectionSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 19,
  },
  summaryPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  summaryColumn: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  verticalDivider: {
    width: 1,
    height: 40,
  },
  summaryLabel: {
    width: "100%",
    textAlign: "center",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginBottom: 4,
  },
  summaryAmount: {
    width: "100%",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    fontSize: 19,
  },
});
