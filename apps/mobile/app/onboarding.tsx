// apps/mobile/app/onboarding.tsx
import React, { useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getDbAdapter } from "../db/client";
import { createBusiness } from "../db/businessQueries";
import { syncNowWithCloud } from "../db/syncService";
import { getCurrentUserProfile } from "../utils/userAuthService";
import { UserAccountModal } from "../components/UserAccountModal";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { type CurrencyCode } from "../utils/formatCurrency";
import { getStrings } from "../constants/translations";

export default function OnboardingScreen() {
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const setActiveBusiness = useUiStore((state) => state.setActiveBusiness);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("BDT");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [accountModalVisible, setAccountModalVisible] = useState(false);

  const handleCreateFirstBusiness = async () => {
    const trimmed = businessName.trim();
    if (!trimmed) {
      setErrorMsg(t.enterBusinessNameError);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      const db = await getDbAdapter();
      const currentUser = await getCurrentUserProfile();

      const created = await createBusiness(db, {
        name: trimmed,
        currency,
        ownerUserId: currentUser?.id ?? null,
      });

setActiveBusiness(created.id, created.name, created.currency);
      DeviceEventEmitter.emit("WORKSPACE_RESET");
      DeviceEventEmitter.emit("LOCAL_DATA_MUTATED");

      if (currentUser) {
        void syncNowWithCloud().catch(() => {});
      }

      router.replace("/(tabs)");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : t.enterBusinessNameError,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.primaryBlue }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "space-between" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Branding Section */}
          <View style={styles.heroSection}>
            {activeBusinessId ? (
              <Pressable
                onPress={() => router.back()}
                style={{ alignSelf: "flex-start", padding: 6, marginBottom: 4 }}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </Pressable>
            ) : null}
            <View
              style={[
                styles.logoBadge,
                { backgroundColor: colors.darkHeaderAccent },
              ]}
            >
              <Ionicons name="book" size={34} color={colors.activeTabIndicator} />
            </View>
            <Text style={styles.brandTitle}>HisabKhata</Text>
            <Text style={styles.brandSubtitle}>{t.onboardingSubtitle}</Text>
          </View>

          {/* Bottom Form Card */}
          <View
            style={[styles.formCard, { backgroundColor: colors.cardSurface }]}
          >
            <Text style={[styles.cardTitle, { color: colors.primaryTextDark }]}>
              {activeBusinessId ? t.addNewBusinessTitle : t.onboardingCardTitle}
            </Text>
          <Text
            style={[
              styles.cardDescription,
              { color: colors.secondaryMutedText },
            ]}
          >
            {t.onboardingCardDesc}
          </Text>

          {/* Business Name Input */}
          <Text style={[styles.fieldLabel, { color: colors.primaryTextDark }]}>
            {t.businessShopNameLabel}
          </Text>
          <TextInput
            value={businessName}
            onChangeText={(text) => {
              setBusinessName(text);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder={t.onboardingPlaceholder}
            placeholderTextColor={colors.secondaryMutedText}
            style={[
              styles.textInput,
              {
                borderColor: errorMsg
                  ? colors.primaryRed
                  : colors.borderDivider,
                color: colors.primaryTextDark,
                backgroundColor: colors.pageBackgroundGrey,
              },
            ]}
            maxLength={60}
            autoCapitalize="words"
          />

          {/* Currency Selector */}
          <Text style={[styles.fieldLabel, { color: colors.primaryTextDark }]}>
            {t.defaultCurrencyLabel}
          </Text>
          <View style={styles.currencyRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCurrency("BDT")}
              style={[
                styles.currencyOption,
                {
                  borderColor:
                    currency === "BDT"
                      ? colors.primaryBlue
                      : colors.borderDivider,
                  backgroundColor:
                    currency === "BDT"
                      ? colors.lightGreenBadgeTint
                      : colors.cardSurface,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencySymbol,
                  {
                    color:
                      currency === "BDT"
                        ? colors.primaryGreen
                        : colors.secondaryMutedText,
                  },
                ]}
              >
                ৳
              </Text>
              <View>
                <Text
                  style={[
                    styles.currencyCode,
                    { color: colors.primaryTextDark },
                  ]}
                >
                  BDT (৳)
                </Text>
                <Text
                  style={[
                    styles.currencyCaption,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.bangladeshiTaka}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setCurrency("INR")}
              style={[
                styles.currencyOption,
                {
                  borderColor:
                    currency === "INR"
                      ? colors.primaryBlue
                      : colors.borderDivider,
                  backgroundColor:
                    currency === "INR"
                      ? colors.lightGreenBadgeTint
                      : colors.cardSurface,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencySymbol,
                  {
                    color:
                      currency === "INR"
                        ? colors.primaryGreen
                        : colors.secondaryMutedText,
                  },
                ]}
              >
                ₹
              </Text>
              <View>
                <Text
                  style={[
                    styles.currencyCode,
                    { color: colors.primaryTextDark },
                  ]}
                >
                  INR (₹)
                </Text>
                <Text
                  style={[
                    styles.currencyCaption,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.indianRupee}
                </Text>
              </View>
            </Pressable>
          </View>

          {errorMsg ? (
            <Text style={[styles.errorText, { color: colors.primaryRed }]}>
              {errorMsg}
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={handleCreateFirstBusiness}
            style={[
              styles.submitButton,
              {
                backgroundColor: colors.primaryBlue,
                opacity: isSaving ? 0.7 : 1,
              },
            ]}
          >
{isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>
                  {activeBusinessId ? t.createBusinessBtn : t.startUsingBtn}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </Pressable>

          {!activeBusinessId && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAccountModalVisible(true)}
              style={{
                marginTop: 16,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Ionicons
                name="person-circle-outline"
                size={20}
                color={colors.primaryBlue}
              />
              <Text
                style={{
                  color: colors.primaryBlue,
                  fontSize: 13,
                  fontFamily: "Inter_700Bold",
                }}
              >
                {t.onboardingLoginBtn}
              </Text>
            </Pressable>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <UserAccountModal
        visible={accountModalVisible}
        onClose={() => setAccountModalVisible(false)}
        onProfileChanged={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  heroSection: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  brandSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    textAlign: "center",
  },
  formCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  cardDescription: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 19,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    marginBottom: 18,
  },
  currencyRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 22,
  },
  currencyOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  currencySymbol: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  currencyCode: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  currencyCaption: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 12,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
