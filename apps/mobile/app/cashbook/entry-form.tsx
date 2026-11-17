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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CustomCalendarModal } from "../../components/CustomCalendarModal";
import { useUiStore } from "../../store/uiStore";
import { getThemeColors } from "../../constants/theme";
import { getDbAdapter } from "../../db/client";
import {
  addCashbookEntry,
  updateCashbookEntry,
  getCashbookEntryById,
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
import { getStrings } from "../../constants/translations";
import { TransactionSavedOverlay } from "../../components/TransactionSavedOverlay";
import { animationDuration } from "../../utils/animation";

export default function CashbookEntryFormScreen() {
  const { type, entryId } = useLocalSearchParams<{
    type: CashbookEntryType;
    entryId?: string;
  }>();
  const isEditing = Boolean(entryId);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const themeMode = useUiStore((state) => state.themeMode);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);
  const language = useUiStore((state) => state.language);
  const t = getStrings(language);
  const colors = getThemeColors(themeMode);

  const isOut = type === "OUT";
  const headerColor = isOut ? colors.primaryRed : colors.primaryGreen;

  // Form State
  const [amountStr, setAmountStr] = useState("0");
  const [cursorPos, setCursorPos] = useState<{ start: number; end: number }>({
    start: 1,
    end: 1,
  });
  const [details, setDetails] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
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

  // Load existing entry data when opening in Edit mode
  useEffect(() => {
    if (isEditing && entryId && activeBusinessId) {
      (async () => {
        const db = await getDbAdapter();
        const existingEntry = await getCashbookEntryById(
          db,
          activeBusinessId,
          entryId,
        );
        if (existingEntry) {
          const str = existingEntry.amount.toString();
          setAmountStr(str);
          setCursorPos({ start: str.length, end: str.length });
          setDetails(existingEntry.details || "");
          setPaymentMode(existingEntry.payment_mode);
          if (existingEntry.timestamp) {
            setEntryDate(new Date(existingEntry.timestamp));
          }
        }
      })();
    }
  }, [entryId, isEditing, activeBusinessId]);

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

  // Support direct keyboard input (numbers, +, -, *, /, Backspace, =, C)
  const handleAmountChangeText = (rawText: string) => {
    if (rawText.includes("=")) {
      handleEvaluate();
      return;
    }

    if (/[cC]/.test(rawText)) {
      setAmountStr("0");
      setCursorPos({ start: 1, end: 1 });
      return;
    }

    const cleanedRaw =
      amountStr === "Error" ? rawText.replace(/Error/g, "") : rawText;

    const normalized = cleanedRaw
      .replace(/\*/g, "×")
      .replace(/\//g, "÷")
      .replace(/[^0-9.+\-×÷%]/g, "");

    if (normalized.length === 0) {
      setAmountStr("0");
      setCursorPos({ start: 1, end: 1 });
      return;
    }

    // Replace initial "0" when user types a first digit on keyboard
    if (amountStr === "0" && normalized.length === 2) {
      if (normalized.startsWith("0") && /[0-9]/.test(normalized[1])) {
        const digit = normalized[1];
        setAmountStr(digit);
        setCursorPos({ start: 1, end: 1 });
        return;
      }
      if (normalized.endsWith("0") && /[1-9]/.test(normalized[0])) {
        const digit = normalized[0];
        setAmountStr(digit);
        setCursorPos({ start: 1, end: 1 });
        return;
      }
    }

    setAmountStr(normalized);
  };

  const handleSave = async () => {
    if (!activeBusinessId) return;
    if (isSubmitting) return;

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
        await updateCashbookEntry(db, {
          entryId,
          businessId: activeBusinessId,
          type: type as CashbookEntryType,
          paymentMode,
          amount: numAmount,
          details: finalDetails || null,
          entryDate: localDateStr,
          entryTime: getLocalTimeString(entryDate),
          timestamp: entryDate.getTime(),
        });
      } else {
        await addCashbookEntry(db, {
          businessId: activeBusinessId,
          type: type as CashbookEntryType,
          paymentMode,
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
      Alert.alert("Error", error.message || "Failed to save cashbook entry.");
      setIsSubmitting(false);
    }
  };

  const evaluatedAmount = parseFloat(evaluateExpression(amountStr) || "0");
  const isAmountValid = !isNaN(evaluatedAmount) && evaluatedAmount > 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBackgroundGrey }]}>
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
          {isOut ? t.cashOutHeader : t.cashInHeader}
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
        <TextInput
          value={amountStr}
          autoFocus
          showSoftInputOnFocus={false}
          caretHidden={false}
          selection={cursorPos}
          onChangeText={handleAmountChangeText}
          onSubmitEditing={handleEvaluate}
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
                  {t.cashLabel}
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
                  {t.online}
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
                placeholder={t.remarksPlaceholder}
                placeholderTextColor={colors.secondaryMutedText}
                value={details}
                onChangeText={setDetails}
                maxLength={500}
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
        badgeText={`${isOut ? t.outHeader : t.inHeader} • ${paymentMode === "ONLINE" ? t.online : t.cashLabel}`}
        subtitle={details.trim() || null}
        dateText={getLocalDateString(entryDate)}
        isNegative={isOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 42 : 50,
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