// apps/mobile/components/BusinessSwitcherModal.tsx
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getDbAdapter } from "../db/client";
import {
  type BusinessWithCount,
  createBusiness,
  deleteBusiness,
  getAllBusinesses,
} from "../db/businessQueries";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { type CurrencyCode } from "../utils/formatCurrency";
import { getStrings } from "../constants/translations";
import { useEffect, useState } from "react";

export interface BusinessSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export function BusinessSwitcherModal({
  visible,
  onClose,
}: BusinessSwitcherModalProps) {
  const router = useRouter();
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const setActiveBusiness = useUiStore((state) => state.setActiveBusiness);
  const themeMode = useUiStore((state) => state.themeMode);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  const [businesses, setBusinesses] = useState<BusinessWithCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState<CurrencyCode>("BDT");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const db = await getDbAdapter();
      const rows = await getAllBusinesses(db);
      setBusinesses(rows);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not load businesses.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setIsCreatingNew(false);
      setNewName("");
      setNewCurrency("BDT");
      setErrorMsg(null);
      loadBusinesses();
    }
  }, [visible]);

  const handleSelectBusiness = (biz: BusinessWithCount) => {
    setActiveBusiness(biz.id, biz.name, biz.currency);
    onClose();
  };

  const handleCreateBusiness = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMsg(t.enterBusinessNameError);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const db = await getDbAdapter();
      const created = await createBusiness(db, {
        name: trimmed,
        currency: newCurrency,
      });

      setActiveBusiness(created.id, created.name, created.currency);
      DeviceEventEmitter.emit("LOCAL_DATA_MUTATED");
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to create business.",
      );
      setLoading(false);
    }
  };


  const handleDeleteBusiness = (biz: BusinessWithCount) => {
    if (businesses.length <= 1) {
      Alert.alert(t.deleteBusinessConfirmTitle, t.cannotDeleteOnlyBusinessMsg);
      return;
    }

    Alert.alert(
      t.deleteBusinessConfirmTitle,
      `${biz.name} — ${t.deleteBusinessConfirmMsg}`,
      [
        { text: t.cancelBtn, style: "cancel" },
        {
          text: t.deleteBtn,
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const db = await getDbAdapter();
              const nextActive = await deleteBusiness(db, biz.id);
              const updatedList = await getAllBusinesses(db);
              setBusinesses(updatedList);

              if (biz.id === activeBusinessId && nextActive) {
                setActiveBusiness(
                  nextActive.id,
                  nextActive.name,
                  nextActive.currency,
                );
              }

              DeviceEventEmitter.emit("WORKSPACE_RESET");
              DeviceEventEmitter.emit("LOCAL_DATA_MUTATED");
            } catch (err) {
              setErrorMsg(
                err instanceof Error
                  ? err.message
                  : "Failed to delete business.",
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismissArea} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.cardSurface },
          ]}
        >
          {/* Sheet Header */}
          <View
            style={[
              styles.sheetHeader,
              { borderBottomColor: colors.borderDivider },
            ]}
          >
            <Text
              style={[styles.sheetTitle, { color: colors.primaryTextDark }]}
            >
              {isCreatingNew ? t.addNewBusinessTitle : t.selectBusinessTitle}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close business switcher"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons
                name="close"
                size={22}
                color={colors.secondaryMutedText}
              />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primaryBlue} />
            </View>
          ) : isCreatingNew ? (
            /* Add New Business Form inside Sheet */
            <View style={styles.createFormWrap}>
              <Text
                style={[styles.inputLabel, { color: colors.primaryTextDark }]}
              >
                {t.businessShopNameLabel}
              </Text>
              <TextInput
                value={newName}
                onChangeText={(txt) => {
                  setNewName(txt);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder={t.businessShopPlaceholder}
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
                autoFocus
              />

              <Text
                style={[styles.inputLabel, { color: colors.primaryTextDark }]}
              >
                {t.currencyWord}
              </Text>
              <View style={styles.currencyToggleRow}>
                {(["BDT", "INR"] as CurrencyCode[]).map((code) => {
                  const isSelected = newCurrency === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setNewCurrency(code)}
                      style={[
                        styles.currencyPill,
                        {
                          borderColor: isSelected
                            ? colors.primaryBlue
                            : colors.borderDivider,
                          backgroundColor: isSelected
                            ? colors.lightGreenBadgeTint
                            : colors.cardSurface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyPillText,
                          {
                            color: isSelected
                              ? colors.primaryGreen
                              : colors.primaryTextDark,
                          },
                        ]}
                      >
                        {code === "BDT" ? "BDT (৳)" : "INR (₹)"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {errorMsg ? (
                <Text style={[styles.errorText, { color: colors.primaryRed }]}>
                  {errorMsg}
                </Text>
              ) : null}

              <View style={styles.formActionRow}>
                <Pressable
                  onPress={() => setIsCreatingNew(false)}
                  style={[
                    styles.cancelButton,
                    { borderColor: colors.borderDivider },
                  ]}
                >
                  <Text
                    style={[
                      styles.cancelButtonText,
                      { color: colors.secondaryMutedText },
                    ]}
                  >
                    {t.backBtn}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleCreateBusiness}
                  style={[
                    styles.saveButton,
                    { backgroundColor: colors.primaryBlue },
                  ]}
                >
                  <Text style={styles.saveButtonText}>
                    {t.createBusinessBtn}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* Business List */
            <>
              <ScrollView style={styles.listScroll}>
                {businesses.map((biz) => {
                  const isActive = biz.id === activeBusinessId;
                  const initials = biz.name
                    .trim()
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("");

                  return (
                    <Pressable
                      key={biz.id}
                      onPress={() => handleSelectBusiness(biz)}
                      style={[
                        styles.businessItem,
                        {
                          borderBottomColor: colors.borderDivider,
                          backgroundColor: isActive
                            ? colors.lightGreenBadgeTint
                            : colors.cardSurface,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor: isActive
                              ? colors.primaryGreen
                              : colors.primaryBlue,
                          },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {initials || "HK"}
                        </Text>
                      </View>

                      <View style={styles.businessMeta}>
                        <Text
                          style={[
                            styles.businessItemName,
                            { color: colors.primaryTextDark },
                          ]}
                          numberOfLines={1}
                        >
                          {biz.name}
                        </Text>
                        <Text
                          style={[
                            styles.businessItemSub,
                            { color: colors.secondaryMutedText },
                          ]}
                        >
                          {biz.customer_count}{" "}
                          {biz.customer_count === 1
                            ? t.customerSingular
                            : t.customersWord}{" "}
                          • {biz.currency === "INR" ? "INR (₹)" : "BDT (৳)"}
                        </Text>
                      </View>

<View style={styles.rightActionsRow}>
                        {businesses.length > 1 && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Delete ${biz.name}`}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteBusiness(biz);
                            }}
                            hitSlop={10}
                            style={[
                              styles.deleteBizBtn,
                              { backgroundColor: colors.lightPinkColumnTint },
                            ]}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color={colors.primaryRed}
                            />
                          </Pressable>
                        )}

                        {isActive ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={24}
                            color={colors.primaryGreen}
                          />
                        ) : (
                          <Ionicons
                            name="ellipse-outline"
                            size={22}
                            color={colors.secondaryMutedText}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.footerWrap}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    router.push("/onboarding" as any);
                  }}
                  style={[
                    styles.addNewBusinessBtn,
                    { backgroundColor: colors.primaryBlue },
                  ]}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.addNewBusinessBtnText}>
                    {t.addNewBusinessBtn}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  backdropDismissArea: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "78%",
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    padding: 4,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },
  listScroll: {
    maxHeight: 320,
  },
  businessItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  businessMeta: {
    flex: 1,
  },
  businessItemName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  businessItemSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
    rightActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteBizBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  footerWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  addNewBusinessBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  addNewBusinessBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  createFormWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    marginBottom: 16,
  },
  currencyToggleRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  currencyPill: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  currencyPillText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginBottom: 12,
  },
  formActionRow: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  saveButton: {
    flex: 2,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
