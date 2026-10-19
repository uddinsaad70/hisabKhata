import {
  v7 as uuidv7,
  validate as uuidValidate,
  version as uuidVersion,
} from "uuid";

/**
 * Generates a time-ordered UUID v7 for offline-first primary keys.
 */
export function generateId(): string {
  return uuidv7();
}

/**
 * Validates whether a given string is a valid version 7 UUID.
 */
export function isValidUuidV7(id: string): boolean {
  return uuidValidate(id) && uuidVersion(id) === 7;
}
