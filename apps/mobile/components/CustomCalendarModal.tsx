// apps/mobile/components/CustomCalendarModal.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../store/uiStore";
import { getThemeColors } from "../constants/theme";
import { getStrings } from "../constants/translations";
import { getLocalDateString } from "../utils/dateUtils";

export interface CustomCalendarModalProps {
  visible: boolean;
  initialDate: Date;
  activeDates?: ReadonlySet<string> | string[];
  minimumDate?: Date;
  maximumDate?: Date;
  onClose: () => void;
  onSelectDate: (selectedDate: Date) => void;
}

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MONTHS_BN = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export function CustomCalendarModal({
  visible,
  initialDate,
  activeDates,
  minimumDate,
  maximumDate,
  onClose,
  onSelectDate,
}: CustomCalendarModalProps) {
  const themeMode = useUiStore((state) => state.themeMode);
  const language = useUiStore((state) => state.language);
  const colors = getThemeColors(themeMode);
  const t = getStrings(language);

  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());
  const [isMonthYearPickerOpen, setIsMonthYearPickerOpen] =
    useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setViewYear(initialDate.getFullYear());
      setViewMonth(initialDate.getMonth());
      setIsMonthYearPickerOpen(false);
    }
  }, [visible, initialDate]);

  const activeDateSet = useMemo(() => {
    if (!activeDates) return new Set<string>();
    return activeDates instanceof Set ? activeDates : new Set(activeDates);
  }, [activeDates]);

  const selectedDateStr = getLocalDateString(initialDate);
  const todayDateStr = getLocalDateString(new Date());
  const minDateStr = minimumDate ? getLocalDateString(minimumDate) : null;
  const maxDateStr = maximumDate ? getLocalDateString(maximumDate) : null;
  const minYear = minimumDate ? minimumDate.getFullYear() : 1970;
  const maxYear = maximumDate
    ? maximumDate.getFullYear()
    : new Date().getFullYear() + 5;

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y -= 1) {
      years.push(y);
    }
    return years;
  }, [maxYear, minYear]);

  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i += 1) {
      cells.push({ day: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      const mStr = String(viewMonth + 1).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      cells.push({ day: d, dateStr: `${viewYear}-${mStr}-${dStr}` });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const weekdays = language === "bn" ? WEEKDAYS_BN : WEEKDAYS_EN;
  const monthLabel =
    language === "bn"
      ? `${MONTHS_BN[viewMonth]} ${viewYear}`
      : `${MONTHS_EN[viewMonth]} ${viewYear}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardSurface,
              borderColor: colors.borderDivider,
            },
          ]}
        >
          {/* Top Royal Blue Header */}
          <View
            style={[
              styles.headerBanner,
              { backgroundColor: colors.primaryBlue },
            ]}
          >
            <View>
              <Text style={styles.headerSubtitle}>{t.selectDateTitle}</Text>
              <Text style={styles.headerSelectedDate}>{selectedDateStr}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.headerCloseCircle}
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Month & Year Navigation Bar (Tap center pill to open Month/Year selector) */}
          <View style={styles.monthNavRow}>
            <Pressable
              onPress={() => {
                if (isMonthYearPickerOpen) {
                  setViewYear((y) => y - 1);
                } else {
                  handlePrevMonth();
                }
              }}
              hitSlop={10}
              style={[
                styles.navArrowBtn,
                {
                  backgroundColor: colors.pageBackgroundGrey,
                  borderColor: colors.borderDivider,
                },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={colors.primaryTextDark}
              />
            </Pressable>

            <Pressable
              onPress={() => setIsMonthYearPickerOpen((prev) => !prev)}
              style={[
                styles.monthYearTriggerPill,
                {
                  backgroundColor: isMonthYearPickerOpen
                    ? colors.primaryBlue
                    : colors.pageBackgroundGrey,
                  borderColor: isMonthYearPickerOpen
                    ? colors.primaryBlue
                    : colors.borderDivider,
                },
              ]}
            >
              <Text
                style={[
                  styles.monthTitleText,
                  {
                    color: isMonthYearPickerOpen
                      ? "#FFFFFF"
                      : colors.primaryTextDark,
                  },
                ]}
              >
                {monthLabel}
              </Text>
              <Ionicons
                name={isMonthYearPickerOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={
                  isMonthYearPickerOpen ? "#FFFFFF" : colors.primaryTextDark
                }
              />
            </Pressable>

            <Pressable
              onPress={() => {
                if (isMonthYearPickerOpen) {
                  setViewYear((y) => Math.min(maxYear, y + 1));
                } else {
                  handleNextMonth();
                }
              }}
              hitSlop={10}
              style={[
                styles.navArrowBtn,
                {
                  backgroundColor: colors.pageBackgroundGrey,
                  borderColor: colors.borderDivider,
                },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.primaryTextDark}
              />
            </Pressable>
          </View>

          {isMonthYearPickerOpen ? (
            /* Direct Month & Year Selector Grid */
            <View style={styles.pickerContainer}>
              {/* Year Pills */}
              {/* Scrollable Year Selector (1970 -> Present) */}
              <ScrollView
                style={styles.yearScrollArea}
                contentContainerStyle={styles.yearGrid}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                {yearOptions.map((yr) => {
                  const activeYr = yr === viewYear;
                  return (
                    <Pressable
                      key={yr}
                      onPress={() => setViewYear(yr)}
                      style={[
                        styles.yearCell,
                        {
                          backgroundColor: activeYr
                            ? colors.primaryBlue
                            : colors.pageBackgroundGrey,
                          borderColor: activeYr
                            ? colors.primaryBlue
                            : colors.borderDivider,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.yearCellText,
                          {
                            color: activeYr
                              ? "#FFFFFF"
                              : colors.primaryTextDark,
                          },
                        ]}
                      >
                        {yr}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View
                style={[
                  styles.pickerDivider,
                  { backgroundColor: colors.borderDivider },
                ]}
              />

              {/* 12 Months Grid */}
              <View style={styles.monthGrid}>
                {(language === "bn" ? MONTHS_BN : MONTHS_SHORT_EN).map(
                  (mName, mIdx) => {
                    const activeM = mIdx === viewMonth;
                    const isFutureMonth =
                      maximumDate &&
                      viewYear === maximumDate.getFullYear() &&
                      mIdx > maximumDate.getMonth();

                    return (
                      <Pressable
                        key={mName}
                        disabled={Boolean(isFutureMonth)}
                        onPress={() => {
                          setViewMonth(mIdx);
                          setIsMonthYearPickerOpen(false);
                        }}
                        style={[
                          styles.monthCell,
                          {
                            backgroundColor: activeM
                              ? colors.primaryGreen
                              : colors.pageBackgroundGrey,
                            borderColor: activeM
                              ? colors.primaryGreen
                              : colors.borderDivider,
                            opacity: isFutureMonth ? 0.35 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.monthCellText,
                            {
                              color: activeM
                                ? "#FFFFFF"
                                : colors.primaryTextDark,
                            },
                          ]}
                        >
                          {mName}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </View>
          ) : (
            <>
              {/* Weekday Labels */}
              <View style={styles.weekdaysRow}>
                {weekdays.map((wd) => (
                  <View key={wd} style={styles.weekdayCell}>
                    <Text
                      style={[
                        styles.weekdayText,
                        { color: colors.secondaryMutedText },
                      ]}
                    >
                      {wd}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {calendarCells.map((cell, idx) => {
                  if (!cell.day || !cell.dateStr) {
                    return <View key={`empty-${idx}`} style={styles.dayCell} />;
                  }

                  const isSelected = cell.dateStr === selectedDateStr;
                  const isToday = cell.dateStr === todayDateStr;
                  const hasTx = activeDateSet.has(cell.dateStr);
                  const isDisabled =
                    (maxDateStr !== null && cell.dateStr > maxDateStr) ||
                    (minDateStr !== null && cell.dateStr < minDateStr);

                  return (
                    <Pressable
                      key={cell.dateStr}
                      disabled={isDisabled}
                      onPress={() => {
                        const picked = new Date(`${cell.dateStr}T00:00:00`);
                        onSelectDate(picked);
                      }}
                      style={styles.dayCell}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          hasTx &&
                            !isSelected && {
                              backgroundColor: colors.lightGreenBadgeTint,
                              borderWidth: 1,
                              borderColor: colors.primaryGreen,
                            },
                          isToday &&
                            !isSelected && {
                              borderWidth: 1.4,
                              borderColor: colors.primaryBlue,
                            },
                          isSelected && {
                            backgroundColor: colors.primaryBlue,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumberText,
                            {
                              color: isSelected
                                ? "#FFFFFF"
                                : hasTx
                                  ? colors.primaryGreen
                                  : isDisabled
                                    ? colors.secondaryMutedText
                                    : colors.primaryTextDark,
                              opacity: isDisabled ? 0.35 : 1,
                            },
                            (isSelected || hasTx) && {
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {cell.day}
                        </Text>

                        {/* Vivid Green dot indicator if this date has transactions (always green, even when selected!) */}
                        {hasTx && (
                          <View
                            style={[
                              styles.txDot,
                              {
                                backgroundColor: isSelected
                                  ? "#4ADE80"
                                  : colors.primaryGreen,
                              },
                            ]}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* Hint & Bottom Actions */}
          <View
            style={[
              styles.footerRow,
              { borderTopColor: colors.borderDivider },
            ]}
          >
            {activeDateSet.size > 0 && (
              <View style={styles.legendRow}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: "#22C55E" },
                  ]}
                />
                <Text
                  style={[
                    styles.legendText,
                    { color: colors.secondaryMutedText },
                  ]}
                  numberOfLines={1}
                >
                  {t.greenDotHint}
                </Text>
              </View>
            )}

            <View style={styles.footerButtons}>
              <Pressable
                onPress={() => {
                  const now = new Date();
                  onSelectDate(now);
                }}
                style={[
                  styles.todayBtn,
                  {
                    backgroundColor: colors.pageBackgroundGrey,
                    borderColor: colors.borderDivider,
                  },
                ]}
              >
                <Ionicons
                  name="today-outline"
                  size={14}
                  color={colors.primaryBlue}
                />
                <Text
                  style={[styles.todayBtnText, { color: colors.primaryBlue }]}
                >
                  {t.todayBtn}
                </Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                style={[
                  styles.cancelBtn,
                  { borderColor: colors.borderDivider },
                ]}
              >
                <Text
                  style={[
                    styles.cancelBtnText,
                    { color: colors.secondaryMutedText },
                  ]}
                >
                  {t.cancelBtn}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  backdropDismiss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: "100%",
    maxWidth: 370,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
  headerBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginBottom: 2,
  },
  headerSelectedDate: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  headerCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  navArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthYearTriggerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  monthTitleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  pickerContainer: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  yearScrollArea: {
    maxHeight: 132,
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
  },
  yearCell: {
    width: "23%",
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  yearCellText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  pickerDivider: {
    height: 1,
    marginVertical: 10,
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "space-between",
  },
  monthCell: {
    width: "31%",
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  monthCellText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  weekdaysRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  weekdayCell: {
    width: "14.28%",
    alignItems: "center",
  },
  weekdayText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  dayCell: {
    width: "14.28%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: 37,
    height: 37,
    borderRadius: 18.5,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  txDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  footerRow: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    flexShrink: 1,
  },
  footerButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  todayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  todayBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
});