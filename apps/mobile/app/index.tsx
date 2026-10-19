import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { generateId } from "../utils/uuid";

export default function IndexScreen() {
  // Generate initial sample UUID v7 on mount
  const [sampleId, setSampleId] = useState<string>(() => generateId());

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>HisabKhata Ready</Text>
        <Text style={styles.subtitle}>
          Offline-First Customer Ledger & Cashbook
        </Text>

        <View style={styles.uuidBox}>
          <Text style={styles.uuidLabel}>Generated UUID v7:</Text>
          <Text style={styles.uuidValue}>{sampleId}</Text>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => setSampleId(generateId())}
        >
          <Text style={styles.buttonText}>Generate New UUID v7</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F3F6",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1355A3",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
  },
  uuidBox: {
    width: "100%",
    backgroundColor: "#FFF5F6",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  uuidLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  uuidValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  button: {
    backgroundColor: "#1355A3",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
