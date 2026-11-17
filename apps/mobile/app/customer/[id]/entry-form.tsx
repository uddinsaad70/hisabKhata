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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
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
  const [cursorPos, setCursorPos] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1,
  });
  const [details, setDetails] = useState("");
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAmountForOverlay, setSavedAmountForOverlay] = useState<
    number | null
  >(null);

// Match existing calculation "(expr = result)" or unparenthesized "expr = result"
  const CALC_EQUATION_REGEX =
    /\s*(?:\(([^()=]+)=\s*([0-9.]+)\)|([0-9.]+(?:\s*[+\-×÷%]\s*[0-9.]+)+)\s*=\s*([0-9.]+))/;

  const upsertCalculationInDetails = (
    prevDetails: string,
    newExpr: string,
    newResult: string,
  ): string => {
    let mergedExpr = newExpr.trim();
    const existingMatch = prevDetails.match(CALC_EQUATION_REGEX);

    if (existingMatch) {
      const oldExpr = (existingMatch[1] || existingMatch[3] || "").trim();
      const oldResult = (existingMatch[2] || existingMatch[4] || "").trim();

      // Chain previous expression if new calculation starts with old result (e.g. 100 + 100 = 200 then 200 + 100 -> 100 + 100 + 100)
      if (oldExpr && oldResult) {
        const oldNum = parseFloat(oldResult);
        const leadingMatch = mergedExpr.match(/^([0-9.]+)(?=\s*[+\-×÷%])/);
        if (
          leadingMatch &&
          !isNaN(oldNum) &&
          parseFloat(leadingMatch[1]) === oldNum
        ) {
          mergedExpr =
            oldExpr + mergedExpr.slice(leadingMatch[1].length);
        }
      }
    }

    const formattedExpr = mergedExpr
      .replace(/\s*([+\-×÷%])\s*/g, " $1 ")
      .replace(/\s+/g, " ")
      .trim();
    const equation = `(${formattedExpr} = ${newResult})`;
    const withoutOldCalc = prevDetails
      .replace(new RegExp(CALC_EQUATION_REGEX.source, "g"), "")
      .trim();
    return withoutOldCalc ? `${withoutOldCalc} ${equation}` : equation;
  };
  // Strip no-op zero additions/subtractions like "+0", "-000", "000+"
  const sanitizeZeroOperations = (expr: string): string => {
    let cleaned = expr.trim();
    while (endsWithOperator(cleaned)) {
      cleaned = cleaned.slice(0, -1).trim();
    }
    cleaned = cleaned
      .replace(/([+\-])\s*0+(?:\.0+)?(?=$|[+\-×÷%])/g, "")
      .replace(/^0+(?:\.0+)?\s*\+\s*/, "");
    return cleaned || "0";
  };

const handleEvaluate = () => {
    if (/[\+\-\×\÷\%]/.test(amountStr)) {
      const meaningfulExpr = sanitizeZeroOperations(amountStr);
      const result = evaluateExpression(amountStr);

      // Only update details if meaningful math operators remain after removing +000 / -000
      if (result !== "Error" && /[\+\-\×\÷\%]/.test(meaningfulExpr)) {
        setDetails((prev) =>
          upsertCalculationInDetails(prev, meaningfulExpr, result),
        );
      }
      setAmountStr(result);
      setCursorPos({ start: result.length, end: result.length });
    } else {
      const result = evaluateExpression(amountStr);
      setAmountStr(result);
      setCursorPos({ start: result.length, end: result.length });
    }
  };

  // Insert key at current cursor position
  const handleKeyPress = (key: string) => {
    if (key === "C" || key === "AC") {
      setAmountStr("0");
      setCursorPos({ start: 1, end: 1 });
      return;
    }

    if (amountStr === "Error" || (amountStr === "0" && /[0-9]/.test(key))) {
      setAmountStr(key);
      setCursorPos({ start: key.length, end: key.length });
      return;
    }

    const start = Math.max(0, Math.min(cursorPos.start, amountStr.length));
    const end = Math.max(start, Math.min(cursorPos.end, amountStr.length));
    const nextStr = amountStr.slice(0, start) + key + amountStr.slice(end);
    const nextCursor = start + key.length;

    setAmountStr(nextStr);
    setCursorPos({ start: nextCursor, end: nextCursor });
  };

  // Delete character before current cursor position
  const handleDelete = () => {
    if (amountStr === "Error" || amountStr.length <= 1) {
      setAmountStr("0");
      setCursorPos({ start: 1, end: 1 });
      return;
    }

    const start = Math.max(0, Math.min(cursorPos.start, amountStr.length));
    const end = Math.max(start, Math.min(cursorPos.end, amountStr.length));

    if (start !== end) {
      const rawNext = amountStr.slice(0, start) + amountStr.slice(end);
      const nextStr = rawNext.length === 0 ? "0" : rawNext;
      const nextCursor = rawNext.length === 0 ? 1 : start;
      setAmountStr(nextStr);
      setCursorPos({ start: nextCursor, end: nextCursor });
      return;
    }

    if (start === 0) {
      return;
    }

    const rawNext = amountStr.slice(0, start - 1) + amountStr.slice(start);
    const nextStr = rawNext.length === 0 ? "0" : rawNext;
    const nextCursor = rawNext.length === 0 ? 1 : start - 1;

    setAmountStr(nextStr);
    setCursorPos({ start: nextCursor, end: nextCursor });
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
          const str = existingEntry.amount.toString();
          setAmountStr(str);
          setCursorPos({ start: str.length, end: str.length });
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

    // 1. Evaluate any pending expression and replace old calculation in details before saving
    let finalAmountStr = amountStr;
    let finalDetails = details.trim();

    if (
      endsWithOperator(finalAmountStr) ||
      /[\+\-\×\÷\%]/.test(finalAmountStr)
    ) {
      const meaningfulExpr = sanitizeZeroOperations(finalAmountStr);
      const evaluated = evaluateExpression(finalAmountStr);

      // Only update details if meaningful math operators remain after removing +000 / -000
      if (evaluated !== "Error" && /[\+\-\×\÷\%]/.test(meaningfulExpr)) {
        finalDetails = upsertCalculationInDetails(
          finalDetails,
          meaningfulExpr,
          evaluated,
        );
        setDetails(finalDetails);
      }

      finalAmountStr = evaluated;
      setAmountStr(finalAmountStr);
      setCursorPos({
        start: finalAmountStr.length,
        end: finalAmountStr.length,
      });
    } else {
      // If user edited the amount directly without operators, remove stale calculation if result no longer matches
      const match = finalDetails.match(/=\s*([0-9.]+)\)?\s*$/);
      if (match && parseFloat(match[1]) !== parseFloat(finalAmountStr)) {
        finalDetails = finalDetails
          .replace(new RegExp(CALC_EQUATION_REGEX.source, "g"), "")
          .trim();
        setDetails(finalDetails);
      }
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
          details: finalDetails || null,
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
          details: finalDetails || null,
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

  // If amount is greater than 0, reveal details input
  const evaluatedAmount = parseFloat(evaluateExpression(amountStr) || "0");
  const isAmountValid = !isNaN(evaluatedAmount) && evaluatedAmount > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: headerColor,
            paddingTop:
              Math.max(insets.top, Platform.OS === "android" ? 28 : 44) + 12,
          },
        ]}
      >
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

      {/* Amount Display with Cursor Support */}
      <View
        style={[
          styles.amountContainer,
          {
            backgroundColor: colors.cardSurface,
            borderBottomColor: colors.borderDivider,
          },
        ]}
      >
        <TextInput
          value={amountStr}
          showSoftInputOnFocus={false}
          caretHidden={false}
          selection={cursorPos}
          onSelectionChange={(e) => setCursorPos(e.nativeEvent.selection)}
          selectionColor={headerColor}
          style={[
            styles.amountText,
            {
              color: amountStr === "Error" ? colors.primaryRed : headerColor,
              width: "100%",
              textAlign: "right",
              padding: 0,
            },
          ]}
        />
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
      <View
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.cardSurface,
        }}
      >
        <CalculatorKeypad
          onKeyPress={handleKeyPress}
          onDelete={handleDelete}
          onEvaluate={handleEvaluate}
        />
      </View>

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