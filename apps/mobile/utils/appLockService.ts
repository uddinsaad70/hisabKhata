// apps/mobile/utils/appLockService.ts
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

const PIN_STORAGE_KEY = "hisabkhata_app_lock_pin";
const APP_LOCK_ENABLED_KEY = "hisabkhata_app_lock_enabled";
const BIOMETRIC_ENABLED_KEY = "hisabkhata_biometric_enabled";

export interface AppLockConfig {
  isPinEnabled: boolean;
  hasSavedPin: boolean;
  isBiometricEnabled: boolean;
  isBiometricHardwareAvailable: boolean;
}

/**
 * Reads the current App Lock configuration from SecureStore and hardware capabilities.
 */
export async function getAppLockConfig(): Promise<AppLockConfig> {
  if (Platform.OS === "web") {
    return {
      isPinEnabled: false,
      hasSavedPin: false,
      isBiometricEnabled: false,
      isBiometricHardwareAvailable: false,
    };
  }

  const savedPin = await SecureStore.getItemAsync(PIN_STORAGE_KEY);
  const lockEnabledPref = await SecureStore.getItemAsync(APP_LOCK_ENABLED_KEY);
  const bioPref = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  const hasSavedPin = Boolean(savedPin && savedPin.length === 4);
  const isPinEnabled = hasSavedPin && lockEnabledPref === "true";
  const isBiometricHardwareAvailable = hasHardware && isEnrolled;

  return {
    isPinEnabled,
    hasSavedPin,
    isBiometricEnabled:
      isPinEnabled && bioPref === "true" && isBiometricHardwareAvailable,
    isBiometricHardwareAvailable,
  };
}

/**
 * Saves a 4-digit PIN to SecureStore and turns on App Lock.
 */
export async function saveAndEnableAppLockPin(
  pin: string,
  enableBiometric: boolean,
): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
  await SecureStore.setItemAsync(PIN_STORAGE_KEY, pin);
  await SecureStore.setItemAsync(APP_LOCK_ENABLED_KEY, "true");
  await SecureStore.setItemAsync(
    BIOMETRIC_ENABLED_KEY,
    enableBiometric ? "true" : "false",
  );
}

/**
 * Toggles App Lock ON or OFF without deleting the saved 4-digit PIN.
 */
export async function setAppLockActive(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(
    APP_LOCK_ENABLED_KEY,
    enabled ? "true" : "false",
  );
}

/**
 * Updates biometric unlock preference.
 */
export async function setBiometricUnlockEnabled(
  enabled: boolean,
): Promise<void> {
  await SecureStore.setItemAsync(
    BIOMETRIC_ENABLED_KEY,
    enabled ? "true" : "false",
  );
}

/**
 * Verifies whether the entered 4-digit PIN matches the stored PIN.
 */
export async function verifyAppLockPin(enteredPin: string): Promise<boolean> {
  const savedPin = await SecureStore.getItemAsync(PIN_STORAGE_KEY);
  return savedPin !== null && savedPin === enteredPin;
}

/**
 * Triggers the native OS Biometric prompt (Fingerprint / Face Unlock).
 */
export async function promptBiometricUnlock(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock HisabKhata with Fingerprint",
      cancelLabel: "Use PIN",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
