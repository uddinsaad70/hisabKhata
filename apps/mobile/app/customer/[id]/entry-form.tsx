// apps/mobile/app/customer/[id]/entry-form.tsx
import React, { useState, useEffect } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CustomCalendarModal } from "../../../components/CustomCalendarModal";

import { useUiStore } from "../../../store/uiStore";
import { getThemeColors } from "../../../constants/theme";
import { getDbAdapter } from "../../../db/client";
import {
  addCustomerEntry,
  updateCustomerEntry,
  getCustomerEntryById,
  type CustomerEntryType,
} from "../../../db/customerQueries";
import {
  evaluateExpression,
  endsWithOperator,
} from "../../../utils/calculatorEngine";
import { CalculatorKeypad } from "../../../components/CalculatorKeypad";
import {
  getLocalDateString,
  getLocalTimeString,
  isFutureDate,
} from "../../../utils/dateUtils";
import { getStrings } from "../../../constants/translations";
import { TransactionSavedOverlay } from "../../../components/TransactionSavedOverlay";
import { animationDuration } from "../../../utils/animation";

export default function CustomerEntryFormScreen() {
  const { id, type, entryId } = useLocalSearchParams<{
    id: string;
    type: CustomerEntryType;
    entryId?: string;
  }>();
  const isEditing = !!entryId;
  const router = useRouter();

  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const activeBusinessCurrency = useUiStore(
    (state) => state.activeBusinessCurrency,
  );
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);
  const currencySymbol = activeBusinessCurrency === "INR" ? "₹" : "৳";

  // Determine theme colors based on GAVE (Red) or GOT (Green)
  const isGave = type === "GAVE";
  const headerColor = isGave ? colors.primaryRed : colors.primaryGreen;

  // Form State
  const [amountStr, setAmountStr] = useState("0");
  const [details, setDetails] = useState("");
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAmountForOverlay, setSavedAmountForOverlay] = useState<
    number | null
  >(null);

  // Evaluate the current math expression
  const handleEvaluate = () => {
    if (/[\+\-\×\÷\%]/.test(amountStr)) {
      const result = evaluateExpression(amountStr);
      if (result !== "Error") {
        const equation = `${amountStr} = ${result}`;
        setDetails((prev) => (prev ? `${prev}\n${equation}` : equation));
      }
      setAmountStr(result);
    } else {
      const result = evaluateExpression(amountStr);
      setAmountStr(result);
    }
  };

  // Append key to calculator display
  const handleKeyPress = (key: string) => {
    setAmountStr((prev) => {
      if (prev === "0" && /[0-9]/.test(key)) return key;
      if (prev === "Error") return key;
      return prev + key;
    });
  };

  // Delete last character
  const handleDelete = () => {
    setAmountStr((prev) => {
      if (prev === "Error" || prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  };
  useEffect(() => {
    if (isEditing && entryId && activeBusinessId) {
      (async () => {
        const db = await getDbAdapter();
        const existingEntry = await getCustomerEntryById(
          db,
          activeBusinessId,
          entryId,
        );
        if (existingEntry) {
          setAmountStr(existingEntry.amount.toString());
          setDetails(existingEntry.details || "");
          if (existingEntry.timestamp) {
            setEntryDate(new Date(existingEntry.timestamp));
          }
        }
      })();
    }
  }, [entryId, isEditing, activeBusinessId]);

  // Save Entry to Database
  const handleSave = async () => {
    if (!activeBusinessId || !id) return;
    if (isSubmitting) return;

    // 1. Evaluate any pending expression before saving
    let finalAmountStr = amountStr;
    if (endsWithOperator(finalAmountStr) || /[\+\-\×\÷]/.test(finalAmountStr)) {
      finalAmountStr = evaluateExpression(finalAmountStr);
      setAmountStr(finalAmountStr);
    }

    if (finalAmountStr === "Error") {
      Alert.alert(
        "Invalid Calculation",
        "Please fix the amount before saving.",
      );
      return;
    }

    const numAmount = parseFloat(finalAmountStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Invalid Amount", "Amount must be greater than 0.");
      return;
    }

    const localDateStr = getLocalDateString(entryDate);
    if (isFutureDate(localDateStr)) {
      Alert.alert("Invalid Date", "You cannot select a future date.");
      return;
    }

    setIsSubmitting(true);
    try {
      const db = await getDbAdapter();

      if (isEditing && entryId) {
        await updateCustomerEntry(db, {
          entryId,
          businessId: activeBusinessId,
          customerId: id,
          type: type as CustomerEntryType,
          amount: numAmount,
          details: details.trim() || null,
          entryDate: localDateStr,
          entryTime: getLocalTimeString(entryDate),
          timestamp: entryDate.getTime(),
        });
      } else {
        await addCustomerEntry(db, {
          businessId: activeBusinessId,
          customerId: id,
          type: type as CustomerEntryType,
          amount: numAmount,
          details: details.trim() || null,
          entryDate: localDateStr,
          entryTime: getLocalTimeString(entryDate),
          timestamp: entryDate.getTime(),
        });
      }

      setSavedAmountForOverlay(numAmount);
      setTimeout(() => {
        router.back();
      }, animationDuration);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save entry.");
      setIsSubmitting(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setEntryDate(selectedDate);
    }
  };

  // If amount is greater than 0, reveal details input
  const evaluatedAmount = parseFloat(evaluateExpression(amountStr) || "0");
  const isAmountValid = !isNaN(evaluatedAmount) && evaluatedAmount > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isGave
            ? `${t.youGaveCol} ${currencySymbol}`
            : `${t.youGotCol} ${currencySymbol}`}
        </Text>
      </View>

      {/* Amount Display */}
      <View
        style={[
          styles.amountContainer,
          {
            backgroundColor: colors.cardSurface,
            borderBottomColor: colors.borderDivider,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.amountText,
            { color: amountStr === "Error" ? colors.primaryRed : headerColor },
          ]}
        >
          {amountStr}
        </Text>
      </View>

      {/* Details & Date Input (Visible when amount > 0) */}
      <View style={styles.detailsContainer}>
        {isAmountValid && (
          <>
            <View
              style={[
                styles.inputRow,
                {
                  backgroundColor: colors.cardSurface,
                  borderColor: colors.borderDivider,
                },
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.secondaryMutedText}
              />
              <TextInput
                style={[styles.textInput, { color: colors.primaryTextDark }]}
                placeholder={t.enterDetailsPlaceholder}
                placeholderTextColor={colors.secondaryMutedText}
                value={details}
                onChangeText={setDetails}
                maxLength={100}
              />
            </View>

            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dateBtn,
                {
                  backgroundColor: colors.cardSurface,
                  borderColor: colors.borderDivider,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.secondaryMutedText}
              />
              <Text
                style={[styles.dateText, { color: colors.primaryTextDark }]}
              >
                {getLocalDateString(entryDate)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.secondaryMutedText}
                style={{ marginLeft: "auto" }}
              />
            </Pressable>

            <CustomCalendarModal
              visible={showDatePicker}
              initialDate={entryDate}
              maximumDate={new Date()}
              onClose={() => setShowDatePicker(false)}
              onSelectDate={(selectedDate) => {
                setShowDatePicker(false);
                setEntryDate(selectedDate);
              }}
            />
          </>
        )}
      </View>

      {/* Save Button */}
      <View style={styles.saveBtnContainer}>
        <Pressable
          onPress={handleSave}
          disabled={!isAmountValid || isSubmitting}
          style={({ pressed }) => [
            styles.saveBtn,
            {
              backgroundColor: !isAmountValid
                ? colors.secondaryMutedText
                : headerColor,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.saveBtnText}>{t.saveBtn}</Text>
        </Pressable>
      </View>

{/* Custom Calculator Keypad */}
      <CalculatorKeypad
        onKeyPress={handleKeyPress}
        onDelete={handleDelete}
        onEvaluate={handleEvaluate}
      />

      <TransactionSavedOverlay
        visible={savedAmountForOverlay !== null}
        amount={savedAmountForOverlay || 0}
        title={t.transactionSavedTitle}
        accentColor={headerColor}
        badgeText={isGave ? t.youGaveCol : t.youGotCol}
        subtitle={details.trim() || null}
        dateText={getLocalDateString(entryDate)}
        isNegative={isGave}
      />
    </View>
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
  headerTitle: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 16 },
  amountContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "flex-end",
    justifyContent: "center",
    borderBottomWidth: 1,
  },
  amountText: {
    fontFamily: "Inter_700Bold",
    fontSize: 48,
  },
  detailsContainer: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  dateText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  saveBtnContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  saveBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});