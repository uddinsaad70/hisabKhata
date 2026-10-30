// apps/mobile/app/customer/[id]/settings.tsx
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Ionicons } from "@expo/vector-icons";

import { useUiStore } from "../../../store/uiStore";
import { getThemeColors } from "../../../constants/theme";
import { getDbAdapter } from "../../../db/client";
import {
  checkDuplicatePhone,
  getCustomerById,
  softDeleteCustomerCascade,
  updateCustomer,
} from "../../../db/customerQueries";
import { DeleteConfirmModal } from "../../../components/DeleteConfirmModal";
import { getStrings } from "../../../constants/translations";

const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required."),
  phone: z.string().trim().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomerSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  const [dbError, setDbError] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "" },
  });

  useEffect(() => {
    async function loadCustomer() {
      if (!activeBusinessId || !id) return;
      const db = await getDbAdapter();
      const cust = await getCustomerById(db, activeBusinessId, id);
      if (cust) {
        reset({ name: cust.name, phone: cust.phone || "" });
      }
    }
    void loadCustomer();
  }, [id, activeBusinessId, reset]);

  const onSubmit = async (data: CustomerFormValues) => {
    if (!activeBusinessId || !id) return;
    setDbError(null);
    try {
      const db = await getDbAdapter();

      if (data.phone) {
        const isDup = await checkDuplicatePhone(
          db,
          activeBusinessId,
          data.phone,
          id,
        );
        if (isDup) {
          setDbError(`এই নম্বরে '${isDup.name}' আগে থেকেই যুক্ত আছেন।`);
          return;
        }
      }

      await updateCustomer(db, {
        id,
        businessId: activeBusinessId,
        name: data.name,
        phone: data.phone,
      });

      router.back();
    } catch (err: any) {
      setDbError(err.message || "Failed to update customer.");
    }
  };

  const handleDelete = async () => {
    if (!activeBusinessId || !id) return;
    try {
      const db = await getDbAdapter();
      await softDeleteCustomerCascade(db, activeBusinessId, id);
      setDeleteModalVisible(false);
      // Navigate completely out to the home tabs, so they don't see a deleted ledger
      router.replace("/(tabs)?tab=customers" as never);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { backgroundColor: colors.primaryBlue }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t.customerSettingsTitle}</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.secondaryMutedText }]}>
          {t.customerNameRequiredLabel}
        </Text>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.cardSurface,
                  color: colors.primaryTextDark,
                  borderColor: errors.name
                    ? colors.primaryRed
                    : colors.borderDivider,
                },
              ]}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        {errors.name && (
          <Text style={[styles.errorText, { color: colors.primaryRed }]}>
            {errors.name.message}
          </Text>
        )}

        <Text
          style={[
            styles.label,
            { color: colors.secondaryMutedText, marginTop: 12 },
          ]}
        >
          {t.mobileNumberLabel}
        </Text>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.cardSurface,
                  color: colors.primaryTextDark,
                  borderColor: colors.borderDivider,
                },
              ]}
              keyboardType="phone-pad"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />

        {dbError && (
          <Text style={[styles.dbErrorText, { color: colors.primaryRed }]}>
            {dbError}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit(onSubmit) as any}
          disabled={isSubmitting}
          style={[
            styles.saveBtn,
            {
              backgroundColor: isSubmitting
                ? colors.secondaryMutedText
                : colors.primaryBlue,
            },
          ]}
        >
          <Text style={styles.btnText}>
            {isSubmitting ? t.updatingBtn : t.updateDetailsBtn}
          </Text>
        </Pressable>

        <View style={styles.dangerZone}>
          <Text style={[styles.dangerTitle, { color: colors.primaryRed }]}>
            {t.dangerZoneTitle}
          </Text>
          <Text
            style={[styles.dangerDesc, { color: colors.secondaryMutedText }]}
          >
            {t.deleteCustomerWarning}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeleteModalVisible(true)}
            style={[styles.deleteBtn, { borderColor: colors.primaryRed }]}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={colors.primaryRed}
            />
            <Text style={[styles.deleteBtnText, { color: colors.primaryRed }]}>
              {t.deleteCustomerBtn}
            </Text>
          </Pressable>
        </View>
      </View>

      <DeleteConfirmModal
        visible={deleteModalVisible}
        title={t.deleteCustomerConfirmTitle}
        description={t.deleteCustomerConfirmDesc}
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={handleDelete}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 40 : 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backBtn: { marginRight: 16 },
  headerTitle: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 18 },
  content: { flex: 1, padding: 16 },
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  errorText: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 },
  dbErrorText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  saveBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    elevation: 2,
  },
  btnText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 14 },
  dangerZone: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  dangerTitle: { fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 4 },
  dangerDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: "row",
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteBtnText: { fontFamily: "Inter_700Bold", fontSize: 14 },
});
