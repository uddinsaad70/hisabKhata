// apps/mobile/app/cashbook/entry-form.tsx
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
import DateTimePicker from "@react-native-community/datetimepicker";

import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { getDbAdapter } from "../../db/client";
import {
  addCashbookEntry,
  type CashbookEntryType,
  type PaymentMode,
} from "../../db/cashbookQueries";
import {
  evaluateExpression,
  endsWithOperator,
} from "../../utils/calculatorEngine";
import { CalculatorKeypad } from "../../components/CalculatorKeypad";
import {
  getLocalDateString,
  getLocalTimeString,
  isFutureDate,
} from "../../utils/dateUtils";

export default function CashbookEntryFormScreen() {
  const { type } = useLocalSearchParams<{ type: CashbookEntryType }>();
  const router = useRouter();

  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const colors = getThemeColors(themeMode);

  const isOut = type === "OUT";
  const headerColor = isOut ? colors.primaryRed : colors.primaryGreen;

  // Form State
  const [amountStr, setAmountStr] = useState("0");
  const [details, setDetails] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleKeyPress = (key: string) => {
    setAmountStr((prev) => {
      if (prev === "0" && /[0-9]/.test(key)) return key;
      if (prev === "Error") return key;
      return prev + key;
    });
  };

  const handleDelete = () => {
    setAmountStr((prev) => {
      if (prev === "Error" || prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  };

  const handleSave = async () => {
    if (!activeBusinessId) return;
    if (isSubmitting) return;

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
      await addCashbookEntry(db, {
        businessId: activeBusinessId,
        type: type as CashbookEntryType,
        paymentMode,
        amount: numAmount,
        details: details.trim() || null,
        entryDate: localDateStr,
        entryTime: getLocalTimeString(entryDate),
        timestamp: entryDate.getTime(),
      });

      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save cashbook entry.");
      setIsSubmitting(false);
    }
  };

  const evaluatedAmount = parseFloat(evaluateExpression(amountStr) || "0");
  const isAmountValid = !isNaN(evaluatedAmount) && evaluatedAmount > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isOut ? "CASH OUT [-]" : "CASH IN [+]"}
        </Text>
      </View>

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

      <View style={styles.detailsContainer}>
        {isAmountValid && (
          <>
            {/* Payment Mode Toggle */}
            <View
              style={[styles.toggleContainer, { backgroundColor: "#E5E7EB" }]}
            >
              <Pressable
                style={[
                  styles.toggleBtn,
                  paymentMode === "CASH" && {
                    backgroundColor: colors.cardSurface,
                    shadowOpacity: 0.1,
                  },
                ]}
                onPress={() => setPaymentMode("CASH")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    paymentMode === "CASH"
                      ? { color: colors.primaryTextDark }
                      : { color: colors.secondaryMutedText },
                  ]}
                >
                  Cash
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleBtn,
                  paymentMode === "ONLINE" && {
                    backgroundColor: colors.cardSurface,
                    shadowOpacity: 0.1,
                  },
                ]}
                onPress={() => setPaymentMode("ONLINE")}
              >
                <Text
                  style={[
                    styles.toggleText,
                    paymentMode === "ONLINE"
                      ? { color: colors.primaryTextDark }
                      : { color: colors.secondaryMutedText },
                  ]}
                >
                  Online
                </Text>
              </Pressable>
            </View>

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
                placeholder="Remarks or details..."
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
            </Pressable>

            {showDatePicker && (
              <DateTimePicker
                value={entryDate}
                mode="date"
                display="default"
                maximumDate={new Date()}
                onChange={(e, date) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (date) setEntryDate(date);
                }}
              />
            )}
          </>
        )}
      </View>

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
          <Text style={styles.saveBtnText}>SAVE</Text>
        </Pressable>
      </View>

      <CalculatorKeypad
        onKeyPress={handleKeyPress}
        onDelete={handleDelete}
        onEvaluate={handleEvaluate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 16 : 30,
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
  amountText: { fontFamily: "Inter_700Bold", fontSize: 48 },
  detailsContainer: { flex: 1, padding: 16, gap: 12 },
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 4,
    height: 44,
  },
  toggleBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 1,
  },
  toggleText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  textInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  dateText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  saveBtnContainer: { paddingHorizontal: 16, paddingBottom: 12 },
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
