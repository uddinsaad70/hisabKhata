// apps/mobile/app/customer/add.tsx
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
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as Contacts from "expo-contacts/legacy";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";

import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { getDbAdapter } from "../../db/client";
import { checkDuplicatePhone, createCustomer } from "../../db/customerQueries";
import { getStrings } from "../../constants/translations";

const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required."),
  phone: z.string().trim().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function AddCustomerScreen() {
  const router = useRouter();
  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  const [deviceContacts, setDeviceContacts] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [dbError, setDbError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "" },
  });

  const searchName = watch("name");

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "web") {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status === "granted") {
          const { data } = await Contacts.getContactsAsync({
            fields: [Contacts.Fields.PhoneNumbers],
            sort: Contacts.SortTypes.FirstName,
          });
          // Filter out contacts without phone numbers
          setDeviceContacts(
            data.filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0),
          );
        }
      }
    })();
  }, []);

  const filteredContacts = deviceContacts.filter((c) =>
    c.name?.toLowerCase().includes((contactSearch || "").toLowerCase()),
  );

  const onSubmit = async (data: CustomerFormValues) => {
    if (!activeBusinessId) return;
    setDbError(null);
    try {
      const db = await getDbAdapter();

      if (data.phone) {
        const isDuplicate = await checkDuplicatePhone(
          db,
          activeBusinessId,
          data.phone,
        );
        if (isDuplicate) {
          setDbError(`এই নম্বরে '${isDuplicate.name}' আগে থেকেই যুক্ত আছেন।`);
          return;
        }
      }

      const newCustomer = await createCustomer(db, {
        businessId: activeBusinessId,
        name: data.name,
        phone: data.phone,
      });

      // Redirect directly to the newly created customer's ledger
      // router.replace(`/customer/${newCustomer.id}` as never);
      router.back();
    } catch (err: any) {
      setDbError(err.message || "Failed to add customer.");
    }
  };

  const handleSelectContact = (contact: any) => {
    setValue("name", contact.name || "", { shouldValidate: true });
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      // Clean non-numeric characters from phone except '+'
      const rawPhone = contact.phoneNumbers[0].number || "";
      const cleanedPhone = rawPhone.replace(/[^\d+]/g, "");
      setValue("phone", cleanedPhone, { shouldValidate: true });
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primaryBlue }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>{t.addNewCustomerTitle}</Text>
      </View>

      <View style={styles.content}>
        {/* Name Input */}
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
              placeholder={t.customerNamePlaceholder}
              placeholderTextColor={colors.secondaryMutedText}
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

        {/* Phone Input */}
        <Text
          style={[
            styles.label,
            { color: colors.secondaryMutedText, marginTop: 12 },
          ]}
        >
          {t.mobileNumberOptionalLabel}
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
              placeholder={t.mobileNumberPlaceholder}
              placeholderTextColor={colors.secondaryMutedText}
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
          <Text style={styles.saveBtnText}>
            {isSubmitting ? t.savingBtn : t.saveCustomerBtn}
          </Text>
        </Pressable>

        {/* Contacts List Section */}
        <View style={styles.contactSection}>
          {/* Dedicated Contact Search Bar */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: colors.cardSurface,
                borderColor: colors.borderDivider,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.secondaryMutedText}
            />
            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder={t.searchContactsPlaceholder}
              placeholderTextColor={colors.secondaryMutedText}
              style={[styles.searchInput, { color: colors.primaryTextDark }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FlashList
              data={filteredContacts}
              keyExtractor={(item) => item.id || Math.random().toString()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.contactItem,
                    {
                      borderBottomColor: colors.borderDivider,
                      backgroundColor: pressed
                        ? colors.borderDivider
                        : "transparent",
                    },
                  ]}
                  onPress={() => handleSelectContact(item)}
                >
                  <View
                    style={[
                      styles.contactAvatar,
                      { backgroundColor: colors.lightPinkColumnTint },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.primaryRed,
                        fontFamily: "Inter_700Bold",
                      }}
                    >
                      {item.name ? item.name.charAt(0).toUpperCase() : "#"}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.contactName,
                        { color: colors.primaryTextDark },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.contactPhone,
                        { color: colors.secondaryMutedText },
                      ]}
                    >
                      {item.phoneNumbers?.[0]?.number || t.noNumberText}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      </View>
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
  headerTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  content: {
    flex: 1,
    padding: 16,
  },
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
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
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
  saveBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  contactSection: {
    flex: 1,
    marginTop: 24,
  },
  contactHeader: {
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contactName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  contactPhone: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    paddingVertical: 0,
  },
});
