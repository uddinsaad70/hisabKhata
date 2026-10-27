// apps/mobile/components/UndoSnackbar.tsx
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  DeviceEventEmitter,
} from "react-native";
import { useUiStore } from "../store/uiStore";
import { getDbAdapter } from "../db/client";
import { undoDeleteCustomerEntry } from "../db/customerQueries";
import { undoDeleteCashbookEntry } from "../db/cashbookQueries";

export function UndoSnackbar() {
  const { visible, entryId, entryDomain, customerId, message } = useUiStore(
    (state) => state.undoSnackbar,
  );
  const hideUndoSnackbar = useUiStore((state) => state.hideUndoSnackbar);
  const activeBusinessId = useUiStore((state) => state.activeBusinessId);

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      timer = setTimeout(() => {
        closeSnackbar();
      }, 5000); // 5-second auto hide
    }
    return () => clearTimeout(timer);
  }, [visible]);

  const closeSnackbar = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      hideUndoSnackbar();
    });
  };

  const handleUndo = async () => {
    if (!activeBusinessId || !entryId) return;
    try {
      const db = await getDbAdapter();
      if (entryDomain === "customer" && customerId) {
        await undoDeleteCustomerEntry(
          db,
          activeBusinessId,
          customerId,
          entryId,
        );
        DeviceEventEmitter.emit("REFRESH_LEDGER"); // Trigger UI refresh
      } else if (entryDomain === "cashbook") {
        // Restore deleted cashbook entry and refresh cashbook list
        await undoDeleteCashbookEntry(db, activeBusinessId, entryId);
        DeviceEventEmitter.emit("REFRESH_CASHBOOK");
      }
      closeSnackbar();
    } catch (error) {
      console.error("Undo failed:", error);
    }
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.messageText}>{message}</Text>
      <Pressable onPress={handleUndo} hitSlop={15} style={styles.undoBtn}>
        <Text style={styles.undoText}>UNDO</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 84, // Sit above bottom buttons
    left: 16,
    right: 16,
    backgroundColor: "#333333",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  messageText: {
    color: "#FFFFFF",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  undoBtn: {
    paddingLeft: 16,
  },
  undoText: {
    color: "#4ADE80", // Visible light green
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
});
